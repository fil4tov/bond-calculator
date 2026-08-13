from datetime import UTC, date, datetime
from decimal import Decimal
from types import SimpleNamespace

import pytest
from grpc import StatusCode
from t_tech.invest import InstrumentIdType, InstrumentType
from t_tech.invest import channels
from t_tech.invest.exceptions import AioRequestError
from t_tech.invest.schemas import LastPriceType

from app.errors import ApiError
from app.portfolio.t_invest_gateway import TInvestGateway


def test_sdk_uses_embedded_tbank_root_ca_by_default(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    captured_roots: list[bytes | None] = []
    monkeypatch.delenv("SSL_TBANK_VERIFY", raising=False)
    monkeypatch.setattr(
        channels.grpc,
        "ssl_channel_credentials",
        lambda root_certificates=None: captured_roots.append(root_certificates) or object(),
    )
    monkeypatch.setattr(
        channels.grpc.aio,
        "secure_channel",
        lambda *_args, **_kwargs: object(),
    )

    channels.create_channel(force_async=True)

    assert captured_roots
    assert captured_roots[0] is not None
    assert captured_roots[0].startswith(b"-----BEGIN CERTIFICATE-----")


def money(units: int, nano: int, currency: str = "RUB") -> SimpleNamespace:
    return SimpleNamespace(units=units, nano=nano, currency=currency)


class FakeInstruments:
    async def find_instrument(
        self, *, query: str, instrument_kind: object, api_trade_available_flag: bool
    ) -> SimpleNamespace:
        if (
            query != "ofz"
            or instrument_kind != InstrumentType.INSTRUMENT_TYPE_BOND
            or api_trade_available_flag is not True
        ):
            raise AssertionError("gateway must search API-tradable bonds by the original query")
        instruments = [
            SimpleNamespace(
                uid="duplicate-main",
                position_uid="position-duplicate",
                ticker="OTHER",
                name="Duplicate main",
            ),
            SimpleNamespace(
                uid="duplicate-secondary",
                position_uid="position-duplicate",
                ticker="OFZ",
                name="Duplicate secondary",
            ),
            *[
                SimpleNamespace(
                    uid=f"instrument-{index}",
                    position_uid=f"position-{index}",
                    ticker=f"SU{index:05d}",
                    name=f"OFZ {index}",
                )
                for index in range(10)
            ],
        ]
        return SimpleNamespace(instruments=instruments)

    async def bond_by(self, *, id_type: object, id: str) -> SimpleNamespace:
        if id_type != InstrumentIdType.INSTRUMENT_ID_TYPE_UID or id != "instrument-uid":
            raise AssertionError("gateway must request the bond by UID")
        return SimpleNamespace(
            instrument=SimpleNamespace(
                uid="instrument-uid",
                ticker="SU26238RMFS4",
                name="OFZ 26238",
                nominal=money(1000, 0),
                aci_value=money(12, 345_678_901),
                coupon_quantity_per_year=2,
                placement_date=datetime(2020, 1, 1, tzinfo=UTC),
                maturity_date=datetime(2041, 5, 15, tzinfo=UTC),
            )
        )

    async def get_bond_coupons(
        self, *, instrument_id: str, from_: datetime, to: datetime
    ) -> SimpleNamespace:
        if instrument_id != "instrument-uid" or from_ != datetime(2026, 1, 1, tzinfo=UTC) or to != datetime(
            2026, 12, 31, 23, 59, 59, 999999, tzinfo=UTC
        ):
            raise AssertionError("gateway must request the exact UTC schedule range")
        return SimpleNamespace(
            events=[
                SimpleNamespace(
                    figi="FIGI",
                    coupon_date=datetime(2026, 6, 30, tzinfo=UTC),
                    coupon_number=5,
                    fix_date=datetime(2026, 6, 29, tzinfo=UTC),
                    pay_one_bond=money(12, 345_678_901),
                    coupon_type=1,
                    coupon_start_date=datetime(2025, 12, 31, tzinfo=UTC),
                    coupon_end_date=datetime(2026, 6, 30, tzinfo=UTC),
                    coupon_period=181,
                )
            ]
        )


class FakeMarketData:
    async def get_last_prices(
        self, *, instrument_id: list[str], last_price_type: object
    ) -> SimpleNamespace:
        if instrument_id != ["instrument-uid", "another-uid"]:
            raise AssertionError("gateway must request each UID once in one batch")
        if last_price_type != LastPriceType.LAST_PRICE_EXCHANGE:
            raise AssertionError("gateway must request exchange last prices")
        return SimpleNamespace(
            last_prices=[
                SimpleNamespace(instrument_uid="instrument-uid", price=money(101, 250_000_000)),
                SimpleNamespace(instrument_uid="another-uid", price=money(99, 0)),
            ]
        )


class FakeClient:
    instruments = FakeInstruments()
    market_data = FakeMarketData()

    async def __aenter__(self) -> "FakeClient":
        return self

    async def __aexit__(self, *_args: object) -> None:
        return None


class FailingInstruments:
    def __init__(self, error: Exception) -> None:
        self.error = error

    async def bond_by(self, **_kwargs: object) -> SimpleNamespace:
        raise self.error


class FailingClient:
    def __init__(self, error: Exception) -> None:
        self.instruments = FailingInstruments(error)

    async def __aenter__(self) -> "FailingClient":
        return self

    async def __aexit__(self, *_args: object) -> None:
        return None


@pytest.mark.asyncio
async def test_gateway_converts_t_invest_bond_and_coupon_money_without_float() -> None:
    gateway = TInvestGateway(api_key="token", client_factory=lambda _token: FakeClient())

    bond = await gateway.lookup_bond("instrument-uid")
    coupons = await gateway.get_coupon_schedule("instrument-uid", date(2026, 1, 1), date(2026, 12, 31))

    assert bond is not None
    assert bond.nominal == Decimal("1000.000000000")
    assert bond.aci_value == Decimal("12.345678901")
    assert bond.placement_date == date(2020, 1, 1)
    assert coupons[0].pay_one_bond_amount == Decimal("12.345678901")
    assert coupons[0].coupon_date == date(2026, 6, 30)


@pytest.mark.asyncio
async def test_gateway_gets_unique_exchange_last_prices_as_decimals() -> None:
    gateway = TInvestGateway(api_key="token", client_factory=lambda _token: FakeClient())

    prices = await gateway.get_last_prices(("instrument-uid", "instrument-uid", "another-uid"))

    assert prices == {
        "instrument-uid": Decimal("101.250000000"),
        "another-uid": Decimal("99.000000000"),
    }


@pytest.mark.asyncio
async def test_gateway_searches_bonds_deduplicates_modes_prioritizes_exact_ticker_and_limits() -> None:
    gateway = TInvestGateway(api_key="token", client_factory=lambda _token: FakeClient())

    results = await gateway.search_bonds("ofz")

    assert len(results) == 10
    assert results[0].instrument_uid == "duplicate-secondary"
    assert results[0].ticker == "OFZ"
    assert all(item.instrument_uid != "duplicate-main" for item in results)


@pytest.mark.asyncio
async def test_gateway_maps_missing_key_and_sdk_failure_to_service_unavailable() -> None:
    unconfigured = TInvestGateway(api_key=None)
    unavailable = TInvestGateway(
        api_key="token",
        client_factory=lambda _token: (_ for _ in ()).throw(RuntimeError("offline")),
    )

    with pytest.raises(ApiError, match="T-Invest API key") as missing:
        await unconfigured.lookup_bond("SU26238RMFS4")
    with pytest.raises(ApiError, match="temporarily unavailable") as failed:
        await unavailable.lookup_bond("SU26238RMFS4")

    assert missing.value.status_code == 503
    assert missing.value.code == "t_invest_not_configured"
    assert failed.value.status_code == 503
    assert failed.value.code == "t_invest_unavailable"


@pytest.mark.asyncio
async def test_gateway_treats_sdk_not_found_as_empty_lookup() -> None:
    gateway = TInvestGateway(
        api_key="token",
        client_factory=lambda _token: FailingClient(
            AioRequestError(StatusCode.NOT_FOUND, "not found", None)
        ),
    )

    assert await gateway.lookup_bond("UNKNOWN") is None


@pytest.mark.asyncio
async def test_gateway_maps_sdk_auth_and_transport_errors_to_stable_unavailable() -> None:
    statuses = (
        StatusCode.UNAUTHENTICATED,
        StatusCode.RESOURCE_EXHAUSTED,
        StatusCode.DEADLINE_EXCEEDED,
    )
    for status in statuses:
        gateway = TInvestGateway(
            api_key="token",
            client_factory=lambda _token, status=status: FailingClient(
                AioRequestError(status, "SDK failure", None)
            ),
        )

        with pytest.raises(ApiError) as failed:
            await gateway.lookup_bond("SU26238")

        assert failed.value.status_code == 503
        assert failed.value.code == "t_invest_unavailable"

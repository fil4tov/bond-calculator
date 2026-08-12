from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, date, datetime, time
from decimal import Decimal
from typing import Any, Protocol

from grpc import StatusCode
from t_tech.invest import AsyncClient, InstrumentIdType, InstrumentType
from t_tech.invest.exceptions import AioRequestError
from t_tech.invest.schemas import LastPriceType

from app.errors import ApiError


class AsyncClientContext(Protocol):
    async def __aenter__(self) -> Any: ...

    async def __aexit__(self, *_args: object) -> object: ...


@dataclass(frozen=True)
class TInvestBondSearchItem:
    ticker: str
    instrument_uid: str
    name: str


@dataclass(frozen=True)
class TInvestBond:
    ticker: str
    instrument_uid: str
    name: str
    nominal: Decimal
    payments_per_year: int
    placement_date: date
    maturity_date: date


@dataclass(frozen=True)
class TInvestCoupon:
    figi: str
    coupon_date: date
    coupon_number: int
    fix_date: date | None
    pay_one_bond_amount: Decimal
    pay_one_bond_currency: str
    coupon_type: int
    coupon_start_date: date
    coupon_end_date: date
    coupon_period: int


def _money_value_to_decimal(value: Any) -> Decimal:
    return Decimal(value.units) + Decimal(value.nano).scaleb(-9)


def _as_date(value: datetime | None) -> date | None:
    return value.date() if value is not None else None


def _not_configured() -> ApiError:
    return ApiError(
        status_code=503,
        code="t_invest_not_configured",
        message="T-Invest API key is not configured",
    )


def _unavailable() -> ApiError:
    return ApiError(
        status_code=503,
        code="t_invest_unavailable",
        message="T-Invest service is temporarily unavailable",
    )


class TInvestGateway:
    def __init__(
        self,
        *,
        api_key: str | None,
        client_factory: Callable[[str], AsyncClientContext] = AsyncClient,
    ) -> None:
        self._api_key = api_key
        self._client_factory = client_factory

    def _client(self) -> AsyncClientContext:
        if not self._api_key:
            raise _not_configured()
        try:
            return self._client_factory(self._api_key)
        except Exception as error:
            raise _unavailable() from error

    async def search_bonds(self, query: str) -> tuple[TInvestBondSearchItem, ...]:
        try:
            async with self._client() as client:
                response = await client.instruments.find_instrument(
                    query=query,
                    instrument_kind=InstrumentType.INSTRUMENT_TYPE_BOND,
                    api_trade_available_flag=True,
                )
        except ApiError:
            raise
        except Exception as error:
            raise _unavailable() from error

        normalized_query = query.casefold()
        ordered = sorted(
            enumerate(response.instruments),
            key=lambda item: (
                getattr(item[1], "ticker", "").casefold() != normalized_query,
                item[0],
            ),
        )
        results: list[TInvestBondSearchItem] = []
        seen: set[str] = set()
        for _, instrument in ordered:
            uid = getattr(instrument, "uid", "")
            if not uid:
                continue
            identity = getattr(instrument, "position_uid", "") or uid
            if identity in seen:
                continue
            seen.add(identity)
            results.append(TInvestBondSearchItem(
                ticker=instrument.ticker,
                instrument_uid=uid,
                name=instrument.name,
            ))
            if len(results) == 10:
                break
        return tuple(results)

    async def lookup_bond(self, instrument_uid: str) -> TInvestBond | None:
        try:
            async with self._client() as client:
                response = await client.instruments.bond_by(
                    id_type=InstrumentIdType.INSTRUMENT_ID_TYPE_UID,
                    id=instrument_uid,
                )
        except ApiError:
            raise
        except AioRequestError as error:
            if error.code == StatusCode.NOT_FOUND:
                return None
            raise _unavailable() from error
        except Exception as error:
            raise _unavailable() from error
        instrument = getattr(response, "instrument", None)
        if instrument is None or not getattr(instrument, "uid", ""):
            return None
        return TInvestBond(
            ticker=instrument.ticker,
            instrument_uid=instrument.uid,
            name=instrument.name,
            nominal=_money_value_to_decimal(instrument.nominal),
            payments_per_year=instrument.coupon_quantity_per_year,
            placement_date=instrument.placement_date.date(),
            maturity_date=instrument.maturity_date.date(),
        )

    async def get_last_prices(self, instrument_uids: tuple[str, ...]) -> dict[str, Decimal]:
        unique_uids = list(dict.fromkeys(instrument_uids))
        if not unique_uids:
            return {}
        try:
            async with self._client() as client:
                response = await client.market_data.get_last_prices(
                    instrument_id=unique_uids,
                    last_price_type=LastPriceType.LAST_PRICE_EXCHANGE,
                )
        except ApiError:
            raise
        except Exception as error:
            raise _unavailable() from error
        return {
            item.instrument_uid: _money_value_to_decimal(item.price)
            for item in response.last_prices
            if getattr(item, "instrument_uid", "") and getattr(item, "price", None) is not None
        }

    async def get_coupon_schedule(
        self, uid: str, from_date: date, to_date: date
    ) -> tuple[TInvestCoupon, ...]:
        try:
            async with self._client() as client:
                response = await client.instruments.get_bond_coupons(
                    instrument_id=uid,
                    from_=datetime.combine(from_date, time.min, tzinfo=UTC),
                    to=datetime.combine(to_date, time.max, tzinfo=UTC),
                )
        except ApiError:
            raise
        except Exception as error:
            raise _unavailable() from error
        return tuple(
            TInvestCoupon(
                figi=event.figi,
                coupon_date=event.coupon_date.date(),
                coupon_number=event.coupon_number,
                fix_date=_as_date(event.fix_date),
                pay_one_bond_amount=_money_value_to_decimal(event.pay_one_bond),
                pay_one_bond_currency=event.pay_one_bond.currency,
                coupon_type=int(event.coupon_type),
                coupon_start_date=event.coupon_start_date.date(),
                coupon_end_date=event.coupon_end_date.date(),
                coupon_period=event.coupon_period,
            )
            for event in response.events
        )

from datetime import date, datetime, timedelta
from decimal import Decimal
from uuid import UUID

import pytest
from httpx import AsyncClient
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.main import app
from app.errors import ApiError
from app.portfolio import clock
from app.portfolio.models import Bond, BondCouponSchedule, BondOperation
from app.portfolio.router import get_t_invest_gateway
from app.portfolio.t_invest_gateway import TInvestBond, TInvestCoupon, TInvestGateway


class ScheduleGateway:
    async def get_coupon_schedule(
        self, _uid: str, from_date: date, to_date: date
    ) -> tuple[TInvestCoupon, ...]:
        return (
            TInvestCoupon(
                figi="FIGI",
                coupon_date=to_date,
                coupon_number=1,
                fix_date=None,
                pay_one_bond_amount=Decimal("35.400000000"),
                pay_one_bond_currency="RUB",
                coupon_type=1,
                coupon_start_date=from_date,
                coupon_end_date=to_date,
                coupon_period=(to_date - from_date).days,
            ),
        )


class MarketGateway(ScheduleGateway):
    async def lookup_bond(self, uid: str) -> TInvestBond:
        return TInvestBond(
            ticker="SU26238RMFS4",
            instrument_uid=uid,
            name="OFZ 26238",
            nominal=Decimal("1000.00"),
            aci_value=Decimal("1.234567890"),
            payments_per_year=2,
            placement_date=clock.utc_today() - timedelta(days=365),
            maturity_date=clock.utc_today() + timedelta(days=365),
        )

    async def get_last_prices(self, uids: tuple[str, ...]) -> dict[str, Decimal]:
        return {uid: Decimal("101.250000000") for uid in uids}


class UnavailableMarketGateway(MarketGateway):
    async def get_last_prices(self, _uids: tuple[str, ...]) -> dict[str, Decimal]:
        raise ApiError(
            status_code=503,
            code="t_invest_unavailable",
            message="T-Invest service is temporarily unavailable",
        )


class CountingMarketGateway(MarketGateway):
    def __init__(self) -> None:
        self.lookup_calls = 0

    async def lookup_bond(self, uid: str) -> TInvestBond:
        self.lookup_calls += 1
        return await super().lookup_bond(uid)


@pytest.fixture(autouse=True)
def fake_t_invest() -> None:
    app.dependency_overrides[get_t_invest_gateway] = lambda: ScheduleGateway()
    yield
    app.dependency_overrides.pop(get_t_invest_gateway, None)


async def register(client: AsyncClient, username: str) -> None:
    response = await client.post("/api/auth/register", json={"username": username, "password": "password123"})
    assert response.status_code == 201


def valid_bond_payload(name: str = "OFZ 26238") -> dict[str, object]:
    today = clock.utc_today()
    return {
        "instrument_uid": "instrument-uid",
        "ticker": "SU26238RMFS4",
        "name": name,
        "nominal": "1000.00",
        "payments_per_year": 2,
        "placement_date": (today - timedelta(days=365)).isoformat(),
        "maturity_date": (today + timedelta(days=365)).isoformat(),
        "amount_spent": "50000.35",
        "quantity": 50,
        "purchase_date": (today - timedelta(days=1)).isoformat(),
    }


@pytest.mark.asyncio
async def test_portfolio_requires_authentication_and_clears_invalid_cookie(client: AsyncClient) -> None:
    client.cookies.set("bonds_session", "not-a-session", path="/api")
    response = await client.get("/api/portfolio/bonds")
    assert response.status_code == 401
    assert response.json() == {"code": "unauthenticated", "message": "Authentication required"}
    assert "max-age=0" in response.headers["set-cookie"].lower()


@pytest.mark.asyncio
async def test_create_list_and_add_purchase_return_stored_schedule_card(client: AsyncClient) -> None:
    await register(client, "PortfolioOwner")
    payload = valid_bond_payload("  OFZ 26238  ")
    payload["purchase_date"] = (clock.utc_today() - timedelta(days=2)).isoformat()
    created = await client.post("/api/portfolio/bonds", json=payload)
    assert created.status_code == 201
    card = created.json()
    created_at = datetime.fromisoformat(card["created_at"])
    assert created_at.tzinfo is not None
    assert card["name"] == "OFZ 26238"
    assert card["ticker"] == "SU26238RMFS4"
    assert "coupon_amount" not in card and "coupon_period_days" not in card
    assert card["total_quantity"] == 50 and card["total_spent"] == "50000.35"
    assert card["next_coupon"]["amount_per_bond"] == "35.40"
    assert card["annual_coupon_yield_percent"] == "7.0800"
    added = await client.post(f"/api/portfolio/bonds/{card['id']}/purchases", json={"amount_spent": "25000.35", "quantity": 25, "purchase_date": (clock.utc_today() - timedelta(days=1)).isoformat()})
    assert added.status_code == 201
    assert added.json()["created_at"] == card["created_at"]
    assert added.json()["total_quantity"] == 75
    assert added.json()["total_spent"] == "75000.70"
    assert added.json()["annual_coupon_yield_percent"] == "7.0799"
    assert "purchases" not in added.json()
    assert [operation["operation_date"] for operation in added.json()["operations"]] == [
        (clock.utc_today() - timedelta(days=1)).isoformat(),
        (clock.utc_today() - timedelta(days=2)).isoformat(),
    ]
    assert added.json()["operations"][0] == {
        "id": added.json()["operations"][0]["id"],
        "operation_type": "purchase",
        "amount": "25000.35",
        "realized_result": None,
        "quantity": 25,
        "operation_date": (clock.utc_today() - timedelta(days=1)).isoformat(),
    }
    assert (await client.get("/api/portfolio/bonds")).json() == {"items": [added.json()]}


@pytest.mark.asyncio
async def test_list_enriches_active_open_position_with_market_value_and_calendar_coupon_income(
    client: AsyncClient,
) -> None:
    app.dependency_overrides[get_t_invest_gateway] = lambda: MarketGateway()
    await register(client, "MarketValueOwner")
    created = await client.post("/api/portfolio/bonds", json=valid_bond_payload())

    listed = await client.get("/api/portfolio/bonds")

    assert created.status_code == 201
    card = listed.json()["items"][0]
    assert card["market_value_without_aci"] == "50625.00"
    assert card["accrued_coupon_income"] == "61.73"
    assert card["calendar_year_coupon_income"] == "0.00"
    assert card["annual_coupon_yield_percent"] == "7.0800"

    added = await client.post(
        f"/api/portfolio/bonds/{card['id']}/purchases",
        json={
            "amount_spent": "1000.00",
            "quantity": 1,
            "purchase_date": clock.utc_today().isoformat(),
        },
    )
    assert added.status_code == 201
    assert added.json()["accrued_coupon_income"] == "62.96"
    assert added.json()["annual_coupon_yield_percent"] == "7.0800"


@pytest.mark.asyncio
async def test_sale_recalculates_accrued_coupon_income_for_remaining_position(
    client: AsyncClient,
) -> None:
    app.dependency_overrides[get_t_invest_gateway] = lambda: MarketGateway()
    await register(client, "SaleAciOwner")
    created = await client.post("/api/portfolio/bonds", json=valid_bond_payload())
    assert created.status_code == 201
    assert (await client.get("/api/portfolio/bonds")).status_code == 200

    sold = await client.post(
        f"/api/portfolio/bonds/{created.json()['id']}/sales",
        json={
            "amount_received": "1000.00",
            "quantity": 1,
            "sale_date": clock.utc_today().isoformat(),
        },
    )
    assert sold.status_code == 201
    assert sold.json()["accrued_coupon_income"] == "60.49"


@pytest.mark.asyncio
async def test_list_keeps_open_position_when_market_data_is_unavailable(client: AsyncClient) -> None:
    app.dependency_overrides[get_t_invest_gateway] = lambda: UnavailableMarketGateway()
    await register(client, "UnavailableMarketOwner")
    assert (await client.post("/api/portfolio/bonds", json=valid_bond_payload())).status_code == 201

    listed = await client.get("/api/portfolio/bonds")

    assert listed.status_code == 200
    assert listed.json()["items"][0]["market_value_without_aci"] is None
    assert listed.json()["items"][0]["accrued_coupon_income"] == "61.73"


@pytest.mark.asyncio
async def test_list_keeps_open_position_when_t_invest_key_is_unavailable(client: AsyncClient) -> None:
    await register(client, "UnavailableKeyOwner")
    assert (await client.post("/api/portfolio/bonds", json=valid_bond_payload())).status_code == 201
    app.dependency_overrides[get_t_invest_gateway] = lambda: TInvestGateway(api_key=None)

    listed = await client.get("/api/portfolio/bonds")

    assert listed.status_code == 200
    assert listed.json()["items"][0]["market_value_without_aci"] is None
    assert listed.json()["items"][0]["accrued_coupon_income"] is None


@pytest.mark.asyncio
async def test_list_refreshes_instrument_values_at_most_once_per_utc_day(
    client: AsyncClient,
    session_factory: async_sessionmaker[AsyncSession],
) -> None:
    gateway = CountingMarketGateway()
    app.dependency_overrides[get_t_invest_gateway] = lambda: gateway
    await register(client, "DailyNominalOwner")
    assert (await client.post("/api/portfolio/bonds", json=valid_bond_payload())).status_code == 201

    assert (await client.get("/api/portfolio/bonds")).status_code == 200
    assert (await client.get("/api/portfolio/bonds")).status_code == 200

    assert gateway.lookup_calls == 1
    async with session_factory() as session:
        bond = (await session.scalars(select(Bond))).one()
        assert bond.nominal == Decimal("1000.00")
        assert bond.aci_value == Decimal("1.234567890")
        assert bond.instrument_checked_on == clock.utc_today()


@pytest.mark.asyncio
async def test_list_refreshes_current_instrument_marker_when_aci_is_missing(
    client: AsyncClient,
    session_factory: async_sessionmaker[AsyncSession],
) -> None:
    gateway = CountingMarketGateway()
    app.dependency_overrides[get_t_invest_gateway] = lambda: gateway
    await register(client, "MigratedAciOwner")
    assert (await client.post("/api/portfolio/bonds", json=valid_bond_payload())).status_code == 201
    async with session_factory() as session:
        bond = (await session.scalars(select(Bond))).one()
        bond.instrument_checked_on = clock.utc_today()
        bond.aci_value = None
        await session.commit()

    listed = await client.get("/api/portfolio/bonds")

    assert listed.status_code == 200
    assert listed.json()["items"][0]["accrued_coupon_income"] == "61.73"
    assert gateway.lookup_calls == 1


@pytest.mark.asyncio
async def test_list_marks_closed_position_as_zero_without_a_quote(client: AsyncClient) -> None:
    app.dependency_overrides[get_t_invest_gateway] = lambda: MarketGateway()
    await register(client, "ClosedMarketOwner")
    payload = valid_bond_payload()
    payload["purchase_date"] = (clock.utc_today() - timedelta(days=2)).isoformat()
    created = await client.post("/api/portfolio/bonds", json=payload)
    bond_id = created.json()["id"]
    assert (
        await client.post(
            f"/api/portfolio/bonds/{bond_id}/sales",
            json={
                "amount_received": "50000.00",
                "quantity": 50,
                "sale_date": (clock.utc_today() - timedelta(days=1)).isoformat(),
            },
        )
    ).status_code == 201

    listed = await client.get("/api/portfolio/bonds")

    assert listed.status_code == 200
    assert listed.json()["items"][0]["market_value_without_aci"] == "0.00"
    assert listed.json()["items"][0]["accrued_coupon_income"] == "0.00"
    assert listed.json()["items"][0]["annual_coupon_yield_percent"] is None


@pytest.mark.asyncio
async def test_name_availability_and_duplicates_are_case_insensitive_per_user(client: AsyncClient) -> None:
    await register(client, "FirstOwner")
    assert (await client.post("/api/portfolio/bonds", json=valid_bond_payload(" Alpha Bond "))).status_code == 201
    availability = await client.get("/api/portfolio/bonds/name-availability", params={"name": " alpha bond "})
    duplicate = await client.post("/api/portfolio/bonds", json=valid_bond_payload("ALPHA BOND"))
    assert availability.json() == {"available": False}
    assert duplicate.status_code == 409 and duplicate.json()["code"] == "bond_name_taken"
    await client.post("/api/auth/logout")
    await register(client, "SecondOwner")
    assert (await client.post("/api/portfolio/bonds", json=valid_bond_payload("alpha bond"))).status_code == 201


@pytest.mark.asyncio
async def test_foreign_and_missing_purchase_and_delete_are_indistinguishable(client: AsyncClient) -> None:
    await register(client, "Owner")
    bond_id = (await client.post("/api/portfolio/bonds", json=valid_bond_payload())).json()["id"]
    await client.post("/api/auth/logout")
    await register(client, "Intruder")
    purchase = {"amount_spent": "1.00", "quantity": 1, "purchase_date": (clock.utc_today() - timedelta(days=1)).isoformat()}
    for url, method in ((f"/api/portfolio/bonds/{bond_id}/purchases", "post"), (f"/api/portfolio/bonds/{bond_id}", "delete")):
        response = await getattr(client, method)(url, json=purchase) if method == "post" else await client.delete(url)
        assert response.status_code == 404 and response.json()["code"] == "bond_not_found"


@pytest.mark.asyncio
async def test_delete_cascades_operations_and_schedule(client: AsyncClient, session_factory: async_sessionmaker[AsyncSession]) -> None:
    await register(client, "DeleteOwner")
    bond_id = UUID((await client.post("/api/portfolio/bonds", json=valid_bond_payload())).json()["id"])
    assert (await client.delete(f"/api/portfolio/bonds/{bond_id}")).status_code == 204
    async with session_factory() as session:
        assert await session.scalar(select(Bond.id).where(Bond.id == bond_id)) is None
        assert await session.scalar(select(BondOperation.id).where(BondOperation.bond_id == bond_id)) is None
        assert await session.scalar(select(BondCouponSchedule.id).where(BondCouponSchedule.bond_id == bond_id)) is None


@pytest.mark.asyncio
async def test_delete_works_on_migrated_schema_without_legacy_purchases_table(
    client: AsyncClient,
    session_factory: async_sessionmaker[AsyncSession],
) -> None:
    await register(client, "MigratedDeleteOwner")
    bond_id = (await client.post("/api/portfolio/bonds", json=valid_bond_payload())).json()["id"]
    async with session_factory() as session:
        await session.execute(text("DROP TABLE IF EXISTS bond_purchases"))
        await session.commit()

    response = await client.delete(f"/api/portfolio/bonds/{bond_id}")

    assert response.status_code == 204


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("changes", "field"),
    [
        ({"name": "   "}, "name"), ({"instrument_uid": ""}, "instrument_uid"),
        ({"ticker": ""}, "ticker"), ({"nominal": "0.00"}, "nominal"),
        ({"nominal": "1e3"}, "nominal"), ({"amount_spent": "0.00"}, "amount_spent"),
        ({"amount_spent": 10}, "amount_spent"), ({"payments_per_year": -1}, "payments_per_year"),
        ({"payments_per_year": True}, "payments_per_year"), ({"quantity": 0}, "quantity"),
        ({"quantity": True}, "quantity"), ({"quantity": 2_147_483_648}, "quantity"),
        ({"purchase_date": (clock.utc_today() + timedelta(days=1)).isoformat()}, "purchase_date"),
    ],
)
async def test_create_validation_uses_existing_422_contract(client: AsyncClient, changes: dict[str, object], field: str) -> None:
    await register(client, f"Valid{field}{len(str(changes))}")
    payload = valid_bond_payload(); payload.update(changes)
    response = await client.post("/api/portfolio/bonds", json=payload)
    assert response.status_code == 422 and field in response.json()["field_errors"]


@pytest.mark.asyncio
async def test_purchase_rejects_dates_before_the_earliest_purchase(client: AsyncClient) -> None:
    await register(client, "DatesOwner")
    created = await client.post("/api/portfolio/bonds", json=valid_bond_payload())
    bond_id = created.json()["id"]
    invalid = await client.post(
        f"/api/portfolio/bonds/{bond_id}/purchases",
        json={"amount_spent": "1.00", "quantity": 1, "purchase_date": date.min.isoformat()},
    )
    assert invalid.status_code == 422 and "purchase_date" in invalid.json()["field_errors"]
    backdated = await client.post(
        f"/api/portfolio/bonds/{bond_id}/purchases",
        json={
            "amount_spent": "1.00",
            "quantity": 1,
            "purchase_date": (clock.utc_today() - timedelta(days=2)).isoformat(),
        },
    )
    assert backdated.status_code == 422
    assert backdated.json()["code"] == "validation_error"
    assert "purchase_date" in backdated.json()["field_errors"]


@pytest.mark.asyncio
async def test_list_sorts_active_by_maturity_and_name(client: AsyncClient) -> None:
    await register(client, "SortOwner")
    today = clock.utc_today()
    for name, maturity in (("Zulu", 2), ("beta", 1), ("Alpha", 1)):
        payload = valid_bond_payload(name); payload["maturity_date"] = (today + timedelta(days=365 * maturity)).isoformat()
        assert (await client.post("/api/portfolio/bonds", json=payload)).status_code == 201
    listed = await client.get("/api/portfolio/bonds")
    assert [item["name"] for item in listed.json()["items"]] == ["Alpha", "beta", "Zulu"]

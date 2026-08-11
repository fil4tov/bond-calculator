from datetime import date, timedelta
from decimal import Decimal

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.main import app
from app.errors import ApiError
from app.portfolio import clock
from app.portfolio.models import Bond, BondCouponSchedule, BondOperation
from app.portfolio.router import get_t_invest_gateway
from app.portfolio.t_invest_gateway import TInvestBond, TInvestBondSearchItem, TInvestCoupon


class Gateway:
    async def search_bonds(self, query: str) -> tuple[TInvestBondSearchItem, ...]:
        if query == "none":
            return ()
        return (
            TInvestBondSearchItem(ticker="SU26238", instrument_uid="uid-1", name="ОФЗ 26238"),
            TInvestBondSearchItem(ticker="RU000A", instrument_uid="uid-2", name="Корпоративная"),
        )

    async def lookup_bond(self, instrument_uid: str) -> TInvestBond | None:
        today = clock.utc_today()
        if instrument_uid == "missing":
            return None
        placement_date = today - timedelta(days=365)
        maturity_date = today + timedelta(days=365)
        if instrument_uid == "matured":
            maturity_date = today
        if instrument_uid == "not-placed":
            placement_date = today + timedelta(days=1)
        return TInvestBond(ticker="SU26238", instrument_uid=instrument_uid, name="ОФЗ 26238", nominal=Decimal("1000"), payments_per_year=2, placement_date=placement_date, maturity_date=maturity_date)

    async def get_coupon_schedule(self, uid: str, from_date: date, to_date: date) -> tuple[TInvestCoupon, ...]:
        if uid == "fail": raise ApiError(status_code=503, code="t_invest_unavailable", message="offline")
        return (TInvestCoupon(figi="FIGI", coupon_date=to_date, coupon_number=1, fix_date=None, pay_one_bond_amount=Decimal("10.000000000"), pay_one_bond_currency="RUB", coupon_type=1, coupon_start_date=from_date, coupon_end_date=to_date, coupon_period=(to_date-from_date).days),)


async def register(client: AsyncClient) -> None:
    assert (await client.post("/api/auth/register", json={"username": "Owner", "password": "password123"})).status_code == 201


def payload(name: str = "OFZ") -> dict[str, object]:
    today = clock.utc_today()
    return {"instrument_uid": "uid", "ticker": "ofz", "name": name, "nominal": "1000.00", "payments_per_year": 2, "placement_date": (today-timedelta(days=365)).isoformat(), "maturity_date": (today+timedelta(days=365)).isoformat(), "amount_spent": "900.00", "quantity": 2, "purchase_date": (today-timedelta(days=1)).isoformat()}


@pytest.mark.asyncio
async def test_search_and_uid_lookup_require_auth_and_return_separate_contracts(client: AsyncClient) -> None:
    app.dependency_overrides[get_t_invest_gateway] = lambda: Gateway()
    unauthenticated = await client.get("/api/portfolio/bonds/t-invest-search", params={"query": "офз"})
    assert unauthenticated.status_code == 401
    await register(client)
    search = await client.get("/api/portfolio/bonds/t-invest-search", params={"query": " офз "})
    empty = await client.get("/api/portfolio/bonds/t-invest-search", params={"query": "none"})
    found = await client.get("/api/portfolio/bonds/t-invest-lookup", params={"instrument_uid": "uid-1"})
    missing = await client.get("/api/portfolio/bonds/t-invest-lookup", params={"instrument_uid": "missing"})
    assert search.json() == {"items": [
        {"ticker": "SU26238", "instrument_uid": "uid-1", "name": "ОФЗ 26238"},
        {"ticker": "RU000A", "instrument_uid": "uid-2", "name": "Корпоративная"},
    ]}
    assert empty.json() == {"items": []}
    assert found.json()["item"] == {
        "ticker": "SU26238",
        "instrument_uid": "uid-1",
        "name": "ОФЗ 26238",
        "nominal": "1000.00",
        "payments_per_year": 2,
        "placement_date": (clock.utc_today() - timedelta(days=365)).isoformat(),
        "maturity_date": (clock.utc_today() + timedelta(days=365)).isoformat(),
    }
    assert missing.json() == {"item": None}


@pytest.mark.asyncio
async def test_search_validates_trimmed_length_and_lookup_rejects_ineligible_bonds(client: AsyncClient) -> None:
    app.dependency_overrides[get_t_invest_gateway] = lambda: Gateway()
    await register(client)

    too_short = await client.get("/api/portfolio/bonds/t-invest-search", params={"query": " я "})
    blank_uid = await client.get("/api/portfolio/bonds/t-invest-lookup", params={"instrument_uid": "   "})
    matured = await client.get("/api/portfolio/bonds/t-invest-lookup", params={"instrument_uid": "matured"})
    not_placed = await client.get("/api/portfolio/bonds/t-invest-lookup", params={"instrument_uid": "not-placed"})

    assert too_short.status_code == 422
    assert blank_uid.status_code == 422
    assert matured.status_code == 422
    assert matured.json()["code"] == "t_invest_bond_matured"
    assert not_placed.status_code == 422
    assert not_placed.json()["code"] == "t_invest_bond_not_placed"


@pytest.mark.asyncio
async def test_create_persists_external_schedule_atomically_and_cascades(client: AsyncClient, session_factory: async_sessionmaker[AsyncSession]) -> None:
    app.dependency_overrides[get_t_invest_gateway] = lambda: Gateway()
    await register(client)
    response = await client.post("/api/portfolio/bonds", json=payload())
    assert response.status_code == 201
    assert "coupon_amount" not in response.json()
    assert "annual_coupon_yield_percent" not in response.json()
    assert response.json()["calendar_year_coupon_yield_percent"] == "0.0000"
    assert response.json()["coupon_yield_year"] == clock.utc_today().year
    assert response.json()["next_coupon"]["amount_per_bond"] == "10.00"
    async with session_factory() as session:
        bond = (await session.scalars(select(Bond))).one()
        assert (await session.scalars(select(BondCouponSchedule))).one().figi == "FIGI"
        bond_id = bond.id
    assert (await client.delete(f"/api/portfolio/bonds/{bond_id}")).status_code == 204
    async with session_factory() as session:
        assert list(await session.scalars(select(BondOperation))) == []
        assert list(await session.scalars(select(BondCouponSchedule))) == []


@pytest.mark.asyncio
async def test_schedule_failure_does_not_persist_bond_or_purchase(client: AsyncClient, session_factory: async_sessionmaker[AsyncSession]) -> None:
    app.dependency_overrides[get_t_invest_gateway] = lambda: Gateway()
    await register(client)
    failed = payload(); failed["instrument_uid"] = "fail"
    response = await client.post("/api/portfolio/bonds", json=failed)
    assert response.status_code == 503
    async with session_factory() as session:
        assert list(await session.scalars(select(Bond))) == []


@pytest.mark.asyncio
async def test_add_purchase_rejects_a_date_before_the_stored_coupon_schedule(client: AsyncClient) -> None:
    app.dependency_overrides[get_t_invest_gateway] = lambda: Gateway()
    await register(client)
    created = await client.post("/api/portfolio/bonds", json=payload())
    response = await client.post(f"/api/portfolio/bonds/{created.json()['id']}/purchases", json={"amount_spent": "10.00", "quantity": 1, "purchase_date": (clock.utc_today()-timedelta(days=2)).isoformat()})
    assert response.status_code == 422
    assert response.json()["code"] == "validation_error"
    assert "purchase_date" in response.json()["field_errors"]

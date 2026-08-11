from datetime import date, timedelta
from decimal import Decimal

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.main import app
from app.errors import ApiError
from app.portfolio import clock
from app.portfolio.models import Bond, BondCouponSchedule, BondPurchase
from app.portfolio.router import get_t_invest_gateway
from app.portfolio.t_invest_gateway import TInvestBond, TInvestCoupon


class Gateway:
    async def lookup_bond(self, ticker: str) -> TInvestBond | None:
        return None if ticker == "NONE" else TInvestBond(ticker=ticker, instrument_uid="uid", name="OFZ", nominal=Decimal("1000"), payments_per_year=2, placement_date=date(2020, 1, 1), maturity_date=date(2030, 1, 1))

    async def get_coupon_schedule(self, uid: str, from_date: date, to_date: date) -> tuple[TInvestCoupon, ...]:
        if uid == "fail": raise ApiError(status_code=503, code="t_invest_unavailable", message="offline")
        return (TInvestCoupon(figi="FIGI", coupon_date=to_date, coupon_number=1, fix_date=None, pay_one_bond_amount=Decimal("10.000000000"), pay_one_bond_currency="RUB", coupon_type=1, coupon_start_date=from_date, coupon_end_date=to_date, coupon_period=(to_date-from_date).days),)


async def register(client: AsyncClient) -> None:
    assert (await client.post("/api/auth/register", json={"username": "Owner", "password": "password123"})).status_code == 201


def payload(name: str = "OFZ") -> dict[str, object]:
    today = clock.utc_today()
    return {"instrument_uid": "uid", "ticker": "ofz", "name": name, "nominal": "1000.00", "payments_per_year": 2, "placement_date": (today-timedelta(days=365)).isoformat(), "maturity_date": (today+timedelta(days=365)).isoformat(), "amount_spent": "900.00", "quantity": 2, "purchase_date": (today-timedelta(days=1)).isoformat()}


@pytest.mark.asyncio
async def test_lookup_requires_auth_and_normalizes_contract_ticker(client: AsyncClient) -> None:
    app.dependency_overrides[get_t_invest_gateway] = lambda: Gateway()
    unauthenticated = await client.get("/api/portfolio/bonds/t-invest-lookup", params={"ticker": "ofz"})
    assert unauthenticated.status_code == 401
    await register(client)
    found = await client.get("/api/portfolio/bonds/t-invest-lookup", params={"ticker": " ofz "})
    missing = await client.get("/api/portfolio/bonds/t-invest-lookup", params={"ticker": "none"})
    assert found.json() == {"item": {"ticker": "OFZ", "instrument_uid": "uid", "name": "OFZ", "nominal": "1000.00", "payments_per_year": 2, "placement_date": "2020-01-01", "maturity_date": "2030-01-01"}}
    assert missing.json() == {"item": None}


@pytest.mark.asyncio
async def test_create_persists_external_schedule_atomically_and_cascades(client: AsyncClient, session_factory: async_sessionmaker[AsyncSession]) -> None:
    app.dependency_overrides[get_t_invest_gateway] = lambda: Gateway()
    await register(client)
    response = await client.post("/api/portfolio/bonds", json=payload())
    assert response.status_code == 201
    assert "coupon_amount" not in response.json()
    assert response.json()["next_coupon"]["amount_per_bond"] == "10.00"
    async with session_factory() as session:
        bond = (await session.scalars(select(Bond))).one()
        assert (await session.scalars(select(BondCouponSchedule))).one().figi == "FIGI"
        bond_id = bond.id
    assert (await client.delete(f"/api/portfolio/bonds/{bond_id}")).status_code == 204
    async with session_factory() as session:
        assert list(await session.scalars(select(BondPurchase))) == []
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
async def test_add_purchase_rejects_date_before_the_first_purchase(client: AsyncClient) -> None:
    app.dependency_overrides[get_t_invest_gateway] = lambda: Gateway()
    await register(client)
    created = await client.post("/api/portfolio/bonds", json=payload())
    response = await client.post(f"/api/portfolio/bonds/{created.json()['id']}/purchases", json={"amount_spent": "10.00", "quantity": 1, "purchase_date": (clock.utc_today()-timedelta(days=2)).isoformat()})
    assert response.status_code == 422
    assert "purchase_date" in response.json()["field_errors"]

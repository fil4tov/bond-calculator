from datetime import date, timedelta
from decimal import Decimal
from uuid import UUID, uuid4

import pytest
from httpx import AsyncClient
from sqlalchemy import BigInteger, select, text
from sqlalchemy.orm import selectinload
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.errors import ApiError
from app.portfolio import clock, service
from app.portfolio.models import (
    Bond,
    BondCouponSchedule,
    BondCouponScheduleSync,
    BondOperation,
)
from app.portfolio.schemas import BondCreate
from app.portfolio.t_invest_gateway import TInvestCoupon
from app.users.models import User


class EmptyGateway:
    async def get_coupon_schedule(self, *_args: object) -> tuple[TInvestCoupon, ...]:
        return ()


def bond_data(name: str) -> BondCreate:
    today = clock.utc_today()
    return BondCreate.model_validate({"instrument_uid": "uid", "ticker": "TICK", "name": name, "nominal": "1000.00", "payments_per_year": 0, "placement_date": (today - timedelta(days=365)).isoformat(), "maturity_date": (today + timedelta(days=365)).isoformat(), "amount_spent": "900.00", "quantity": 1, "purchase_date": (today - timedelta(days=1)).isoformat()})


def test_coupon_number_uses_big_integer_metadata() -> None:
    assert type(BondCouponSchedule.__table__.c.coupon_number.type) is BigInteger


@pytest.mark.asyncio
async def test_unique_index_race_is_mapped_to_bond_name_taken(client: AsyncClient, session_factory: async_sessionmaker[AsyncSession], monkeypatch: pytest.MonkeyPatch) -> None:
    user_id = UUID((await client.post("/api/auth/register", json={"username": "RaceOwner", "password": "password123"})).json()["id"])
    async with session_factory() as session:
        await service.create_bond(session, user_id, bond_data("Race Bond"), EmptyGateway())
    async def stale_available(*_args: object) -> bool: return True
    monkeypatch.setattr(service, "is_name_available", stale_available)
    async with session_factory() as session:
        with pytest.raises(ApiError, match="already taken"):
            await service.create_bond(session, user_id, bond_data("race bond"), EmptyGateway())


@pytest.mark.asyncio
async def test_non_name_integrity_error_is_not_mapped_to_duplicate(session_factory: async_sessionmaker[AsyncSession]) -> None:
    async with session_factory() as session:
        if session.get_bind().dialect.name == "sqlite":
            await session.execute(text("PRAGMA foreign_keys = ON"))
            await session.commit()
        with pytest.raises(IntegrityError):
            await service.create_bond(session, uuid4(), bond_data("Orphan Bond"), EmptyGateway())


@pytest.mark.asyncio
async def test_database_rejects_invalid_bond_and_operation_constraints(client: AsyncClient, session_factory: async_sessionmaker[AsyncSession]) -> None:
    await client.post("/api/auth/register", json={"username": "ConstraintOwner", "password": "password123"})
    async with session_factory() as session:
        user = (await session.scalars(select(User))).one()
        session.add(Bond(user_id=user.id, instrument_uid="uid", ticker="T", name="Invalid", nominal=Decimal("0"), payments_per_year=-1, placement_date=date(2027, 1, 1), maturity_date=date(2027, 1, 1)))
        with pytest.raises(IntegrityError): await session.commit()
    async with session_factory() as session:
        user = (await session.scalars(select(User))).one()
        bond = Bond(user_id=user.id, instrument_uid="uid", ticker="T", name="Valid", nominal=Decimal("1"), payments_per_year=0, placement_date=date(2026, 1, 1), maturity_date=date(2027, 1, 1))
        bond.operations.append(BondOperation(user_id=user.id, operation_type="purchase", amount=Decimal("0"), quantity=0, operation_date=date(2026, 1, 1)))
        session.add(bond)
        with pytest.raises(IntegrityError): await session.commit()


@pytest.mark.asyncio
async def test_metadata_defaults_populate_created_at_and_schedule_precision(client: AsyncClient, session_factory: async_sessionmaker[AsyncSession]) -> None:
    await client.post("/api/auth/register", json={"username": "RawInsertOwner", "password": "password123"})
    async with session_factory() as session:
        user = (await session.scalars(select(User))).one()
        bond = Bond(user_id=user.id, instrument_uid="uid", ticker="T", name="Raw", nominal=Decimal("1000"), payments_per_year=0, placement_date=date(2026, 1, 1), maturity_date=date(2027, 1, 1))
        bond.operations.append(BondOperation(user_id=user.id, operation_type="purchase", amount=Decimal("0.01"), quantity=2_147_483_647, operation_date=date(2026, 1, 1)))
        schedule_sync = BondCouponScheduleSync(instrument_uid="uid")
        schedule_sync.coupon_schedules.append(BondCouponSchedule(figi="F", coupon_date=date(2026, 6, 1), coupon_number=1, fix_date=None, pay_one_bond_amount=Decimal("0.123456789"), pay_one_bond_currency="RUB", coupon_type=1, coupon_start_date=date(2026, 1, 1), coupon_end_date=date(2026, 6, 1), coupon_period=151))
        session.add_all((bond, schedule_sync)); await session.commit()
        persisted = (await session.scalars(select(Bond).options(selectinload(Bond.operations)))).one()
        persisted_sync = (await session.scalars(select(BondCouponScheduleSync).options(selectinload(BondCouponScheduleSync.coupon_schedules)))).one()
        assert persisted.created_at is not None and persisted.operations[0].created_at is not None
        assert persisted_sync.updated_at is not None
        assert persisted_sync.coupon_schedules[0].pay_one_bond_amount == Decimal("0.123456789")


@pytest.mark.asyncio
async def test_cascade_deletes_schedule_at_orm_level(client: AsyncClient, session_factory: async_sessionmaker[AsyncSession]) -> None:
    await client.post("/api/auth/register", json={"username": "CascadeOwner", "password": "password123"})
    async with session_factory() as session:
        user = (await session.scalars(select(User))).one()
        schedule_sync = BondCouponScheduleSync(instrument_uid="uid")
        schedule_sync.coupon_schedules.append(BondCouponSchedule(figi="F", coupon_date=date(2026, 6, 1), coupon_number=1, fix_date=None, pay_one_bond_amount=Decimal("1"), pay_one_bond_currency="RUB", coupon_type=1, coupon_start_date=date(2026, 1, 1), coupon_end_date=date(2026, 6, 1), coupon_period=1))
        session.add(schedule_sync); await session.commit(); await session.delete(schedule_sync); await session.commit()
        assert list(await session.scalars(select(BondCouponSchedule))) == []


@pytest.mark.asyncio
async def test_database_rejects_invalid_schedule_constraints(client: AsyncClient, session_factory: async_sessionmaker[AsyncSession]) -> None:
    await client.post("/api/auth/register", json={"username": "ScheduleOwner", "password": "password123"})
    async with session_factory() as session:
        user = (await session.scalars(select(User))).one()
        schedule_sync = BondCouponScheduleSync(instrument_uid="uid")
        schedule_sync.coupon_schedules.append(BondCouponSchedule(figi="F", coupon_date=date(2026, 6, 1), coupon_number=1, fix_date=None, pay_one_bond_amount=Decimal("-1"), pay_one_bond_currency="RUB", coupon_type=1, coupon_start_date=date(2026, 6, 2), coupon_end_date=date(2026, 6, 1), coupon_period=-1))
        session.add(schedule_sync)
        with pytest.raises(IntegrityError):
            await session.commit()

from datetime import date, timedelta
from decimal import Decimal
from uuid import UUID, uuid4

import pytest
from httpx import AsyncClient
from sqlalchemy import SmallInteger, select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.errors import ApiError
from app.portfolio import clock, service
from app.portfolio.models import Bond, BondPurchase
from app.portfolio.schemas import BondCreate
from app.portfolio.service import build_bond_card
from app.users.models import User


def bond_data(name: str) -> BondCreate:
    today = clock.utc_today()
    return BondCreate.model_validate(
        {
            "name": name,
            "coupon_amount": "10.00",
            "nominal": "1000.00",
            "payments_per_year": 2,
            "placement_date": (today - timedelta(days=365)).isoformat(),
            "maturity_date": (today + timedelta(days=365)).isoformat(),
            "amount_spent": "900.00",
            "quantity": 1,
            "purchase_date": (today - timedelta(days=1)).isoformat(),
        }
    )


def test_coupon_period_days_uses_small_integer_metadata() -> None:
    assert type(Bond.__table__.c.coupon_period_days.type) is SmallInteger


@pytest.mark.asyncio
async def test_unique_index_race_is_mapped_to_bond_name_taken(
    client: AsyncClient,
    session_factory: async_sessionmaker[AsyncSession],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    registered = await client.post(
        "/api/auth/register", json={"username": "RaceOwner", "password": "password123"}
    )
    user_id = UUID(registered.json()["id"])
    async with session_factory() as session:
        await service.create_bond(session, user_id, bond_data("Race Bond"))

    async def simulate_stale_available(*_args: object) -> bool:
        return True

    monkeypatch.setattr(service, "is_name_available", simulate_stale_available)
    async with session_factory() as session:
        with pytest.raises(ApiError) as raised:
            await service.create_bond(session, user_id, bond_data("race bond"))

    assert raised.value.code == "bond_name_taken"


@pytest.mark.asyncio
async def test_non_name_integrity_error_is_not_mapped_to_duplicate(
    session_factory: async_sessionmaker[AsyncSession],
) -> None:
    async with session_factory() as session:
        await session.execute(text("PRAGMA foreign_keys = ON"))
        await session.commit()
        with pytest.raises(IntegrityError):
            await service.create_bond(session, uuid4(), bond_data("Orphan Bond"))


@pytest.mark.asyncio
async def test_metadata_server_defaults_populate_created_at_for_raw_inserts(
    client: AsyncClient,
    session_factory: async_sessionmaker[AsyncSession],
) -> None:
    await client.post(
        "/api/auth/register", json={"username": "RawInsertOwner", "password": "password123"}
    )
    bond_id = uuid4()
    purchase_id = uuid4()
    async with session_factory() as session:
        user = (await session.scalars(select(User))).one()
        await session.execute(
            text(
                "INSERT INTO bonds "
                "(id, user_id, name, coupon_amount, nominal, payments_per_year, "
                "coupon_period_days, placement_date, maturity_date) "
                "VALUES (:id, :user_id, :name, :coupon, :nominal, :frequency, "
                ":coupon_period_days, :placement, :maturity)"
            ),
            {
                "id": bond_id.hex,
                "user_id": user.id.hex,
                "name": "Raw Bond",
                "coupon": "10.00",
                "nominal": "1000.00",
                "frequency": 2,
                "coupon_period_days": 182,
                "placement": (clock.utc_today() - timedelta(days=365)).isoformat(),
                "maturity": (clock.utc_today() + timedelta(days=365)).isoformat(),
            },
        )
        await session.execute(
            text(
                "INSERT INTO bond_purchases "
                "(id, bond_id, user_id, amount_spent, quantity, purchase_date) "
                "VALUES (:id, :bond_id, :user_id, :spent, :quantity, :purchased)"
            ),
            {
                "id": purchase_id.hex,
                "bond_id": bond_id.hex,
                "user_id": user.id.hex,
                "spent": "900.00",
                "quantity": 1,
                "purchased": (clock.utc_today() - timedelta(days=1)).isoformat(),
            },
        )
        await session.commit()
        bond_created_at = await session.scalar(
            text("SELECT created_at FROM bonds WHERE id = :id"), {"id": bond_id.hex}
        )
        purchase_created_at = await session.scalar(
            text("SELECT created_at FROM bond_purchases WHERE id = :id"),
            {"id": purchase_id.hex},
        )

    assert bond_created_at is not None
    assert purchase_created_at is not None


@pytest.mark.asyncio
async def test_database_rejects_placement_on_or_after_maturity(
    client: AsyncClient,
    session_factory: async_sessionmaker[AsyncSession],
) -> None:
    await client.post(
        "/api/auth/register",
        json={"username": "InvalidPlacementOwner", "password": "password123"},
    )
    async with session_factory() as session:
        user = (await session.scalars(select(User))).one()
        invalid_date = clock.utc_today() + timedelta(days=365)
        session.add(
            Bond(
                user_id=user.id,
                name="Invalid placement",
                coupon_amount=Decimal("10.00"),
                nominal=Decimal("1000.00"),
                payments_per_year=2,
                coupon_period_days=182,
                placement_date=invalid_date,
                maturity_date=invalid_date,
            )
        )
        with pytest.raises(IntegrityError):
            await session.commit()


def test_maximum_storage_values_build_an_exact_formatted_card() -> None:
    today = date(2026, 8, 9)
    user_id = uuid4()
    bond = Bond(
        id=uuid4(),
        user_id=user_id,
        name="Maximum aggregate",
        coupon_amount=Decimal("9999999999999999.99"),
        nominal=Decimal("9999999999999999.99"),
        payments_per_year=12,
        coupon_period_days=30,
        placement_date=today - timedelta(days=365),
        maturity_date=today + timedelta(days=1),
    )
    bond.purchases.append(
        BondPurchase(
            id=uuid4(),
            user_id=user_id,
            amount_spent=Decimal("0.01"),
            quantity=2_147_483_647,
            purchase_date=today,
        )
    )

    card = build_bond_card(bond, today=today)

    assert card.total_quantity == 2_147_483_647
    assert card.total_spent == "0.01"
    assert card.annual_coupon_yield_percent == "2576980376399999997423019623600.0000"
    assert card.next_coupon is not None
    assert card.next_coupon.amount == "21474836469999999978525163.53"


@pytest.mark.asyncio
async def test_database_rejects_coupon_period_days_outside_contract(
    client: AsyncClient,
    session_factory: async_sessionmaker[AsyncSession],
) -> None:
    await client.post(
        "/api/auth/register", json={"username": "InvalidPeriodOwner", "password": "password123"}
    )
    async with session_factory() as session:
        user = (await session.scalars(select(User))).one()
        session.add(
            Bond(
                user_id=user.id,
                name="Invalid coupon period",
                coupon_amount=Decimal("10.00"),
                nominal=Decimal("1000.00"),
                payments_per_year=2,
                coupon_period_days=0,
                placement_date=clock.utc_today() - timedelta(days=365),
                maturity_date=clock.utc_today() + timedelta(days=365),
            )
        )
        with pytest.raises(IntegrityError):
            await session.commit()

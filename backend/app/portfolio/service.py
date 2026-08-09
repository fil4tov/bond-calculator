from datetime import date
from decimal import Decimal, ROUND_HALF_UP, localcontext
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.errors import ApiError

from . import clock
from .calculations import PurchasePosition, calculate_bond_metrics
from .models import Bond, BondPurchase
from .schemas import BondCard, BondCreate, MaturityRemaining, NextCoupon, PurchaseCreate

_NAME_UNIQUE_CONSTRAINT = "uq_bonds_user_name_normalized"


def _fixed_decimal(value: Decimal, places: int) -> str:
    integer_digits = max(1, value.adjusted() + 1) if value else 1
    with localcontext() as context:
        context.prec = max(28, integer_digits + places + 2, len(value.as_tuple().digits) + 2)
        quantum = Decimal(1).scaleb(-places)
        rounded = value.quantize(quantum, rounding=ROUND_HALF_UP)
    return format(rounded, f".{places}f")


def _money(value: Decimal) -> str:
    return _fixed_decimal(value, 2)


def _percent(value: Decimal) -> str:
    return _fixed_decimal(value, 4)


def _name_taken() -> ApiError:
    return ApiError(
        status_code=409,
        code="bond_name_taken",
        message="Bond name is already taken",
        field_errors={"name": "Bond name is already taken"},
    )


def _bond_not_found() -> ApiError:
    return ApiError(status_code=404, code="bond_not_found", message="Bond not found")


def _is_name_unique_violation(error: IntegrityError) -> bool:
    original = error.orig
    diagnostic = getattr(original, "diag", None)
    constraint_names = (
        getattr(original, "constraint_name", None),
        getattr(original, "constraint", None),
        getattr(diagnostic, "constraint_name", None),
    )
    return _NAME_UNIQUE_CONSTRAINT in constraint_names or _NAME_UNIQUE_CONSTRAINT in str(
        original
    )


def build_bond_card(bond: Bond, *, today: date) -> BondCard:
    metrics = calculate_bond_metrics(
        coupon_amount=bond.coupon_amount,
        nominal=bond.nominal,
        payments_per_year=bond.payments_per_year,
        coupon_period_days=bond.coupon_period_days,
        placement_date=bond.placement_date,
        maturity_date=bond.maturity_date,
        purchases=tuple(
            PurchasePosition(p.amount_spent, p.quantity, p.purchase_date) for p in bond.purchases
        ),
        today=today,
    )
    next_coupon = None
    if metrics.next_coupon_pay_date is not None:
        assert metrics.next_coupon_period_start is not None
        assert metrics.next_coupon_period_end is not None
        assert metrics.next_coupon_amount is not None
        assert metrics.next_coupon_days_until is not None
        assert metrics.next_coupon_period_days is not None
        assert metrics.next_coupon_elapsed_period_days is not None
        next_coupon = NextCoupon(
            period_start=metrics.next_coupon_period_start,
            period_end=metrics.next_coupon_period_end,
            pay_date=metrics.next_coupon_pay_date,
            amount=_money(metrics.next_coupon_amount),
            days_until=metrics.next_coupon_days_until,
            period_days=metrics.next_coupon_period_days,
            elapsed_period_days=metrics.next_coupon_elapsed_period_days,
        )
    return BondCard(
        id=bond.id,
        name=bond.name,
        coupon_amount=_money(bond.coupon_amount),
        nominal=_money(bond.nominal),
        payments_per_year=bond.payments_per_year,
        placement_date=bond.placement_date,
        maturity_date=bond.maturity_date,
        coupon_period_days=bond.coupon_period_days,
        status=metrics.status,
        total_quantity=metrics.total_quantity,
        total_spent=_money(metrics.total_spent),
        paid_coupon_total=_money(metrics.paid_coupon_total),
        annual_coupon_yield_percent=_percent(metrics.annual_coupon_yield_percent),
        maturity_remaining=MaturityRemaining(
            years=metrics.remaining_years,
            months=metrics.remaining_months,
            days_until=metrics.remaining_days_until,
        ),
        next_coupon=next_coupon,
    )


async def list_bonds(db: AsyncSession, user_id: UUID, *, today: date) -> list[BondCard]:
    bonds = list(
        await db.scalars(
            select(Bond)
            .options(selectinload(Bond.purchases))
            .where(Bond.user_id == user_id)
        )
    )
    cards = [build_bond_card(bond, today=today) for bond in bonds]
    status_order = {"active": 0, "payment_pending": 1, "matured": 2}
    cards.sort(
        key=lambda card: (
            status_order[card.status],
            card.maturity_date,
            card.name.casefold(),
        )
    )
    return cards


async def is_name_available(db: AsyncSession, user_id: UUID, name: str) -> bool:
    bond_id = await db.scalar(
        select(Bond.id).where(
            Bond.user_id == user_id,
            func.lower(func.trim(Bond.name)) == func.lower(func.trim(name)),
        )
    )
    return bond_id is None


async def create_bond(db: AsyncSession, user_id: UUID, data: BondCreate) -> BondCard:
    if not await is_name_available(db, user_id, data.name):
        raise _name_taken()
    assert data.coupon_period_days is not None
    bond = Bond(
        user_id=user_id,
        name=data.name,
        coupon_amount=data.coupon_amount,
        nominal=data.nominal,
        payments_per_year=data.payments_per_year,
        coupon_period_days=data.coupon_period_days,
        placement_date=data.placement_date,
        maturity_date=data.maturity_date,
    )
    bond.purchases.append(
        BondPurchase(
            user_id=user_id,
            amount_spent=data.amount_spent,
            quantity=data.quantity,
            purchase_date=data.purchase_date,
        )
    )
    db.add(bond)
    try:
        await db.flush()
        card = build_bond_card(bond, today=clock.utc_today())
        await db.commit()
    except IntegrityError as error:
        await db.rollback()
        if _is_name_unique_violation(error):
            raise _name_taken() from error
        raise
    except Exception:
        await db.rollback()
        raise
    return card


async def add_purchase(
    db: AsyncSession,
    user_id: UUID,
    bond_id: UUID,
    data: PurchaseCreate,
) -> BondCard:
    bond = await db.scalar(
        select(Bond)
        .options(selectinload(Bond.purchases))
        .where(Bond.id == bond_id, Bond.user_id == user_id)
    )
    if bond is None:
        raise _bond_not_found()
    if data.purchase_date < bond.placement_date:
        raise ApiError(
            status_code=422,
            code="validation_error",
            message="Request validation failed",
            field_errors={"purchase_date": "Purchase date must not be before placement date"},
        )
    if data.purchase_date >= bond.maturity_date:
        raise ApiError(
            status_code=422,
            code="validation_error",
            message="Request validation failed",
            field_errors={"purchase_date": "Purchase date must be before maturity date"},
        )
    bond.purchases.append(
        BondPurchase(
            user_id=user_id,
            amount_spent=data.amount_spent,
            quantity=data.quantity,
            purchase_date=data.purchase_date,
        )
    )
    try:
        await db.flush()
        card = build_bond_card(bond, today=clock.utc_today())
        await db.commit()
    except Exception:
        await db.rollback()
        raise
    return card


async def delete_bond(db: AsyncSession, user_id: UUID, bond_id: UUID) -> None:
    bond = await db.scalar(
        select(Bond)
        .options(selectinload(Bond.purchases))
        .where(Bond.id == bond_id, Bond.user_id == user_id)
    )
    if bond is None:
        raise _bond_not_found()
    try:
        await db.delete(bond)
        await db.commit()
    except Exception:
        await db.rollback()
        raise

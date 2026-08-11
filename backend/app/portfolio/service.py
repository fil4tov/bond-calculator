from datetime import date
from decimal import Decimal, ROUND_HALF_UP, localcontext
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.errors import ApiError

from . import clock
from .calculations import CouponPosition, PurchasePosition, calculate_bond_metrics
from .models import Bond, BondCouponSchedule, BondPurchase
from .schemas import BondCard, BondCreate, BondPurchaseItem, MaturityRemaining, NextCoupon, PurchaseCreate
from .t_invest_gateway import TInvestGateway

_NAME_UNIQUE_CONSTRAINT = "uq_bonds_user_name_normalized"


def _fixed_decimal(value: Decimal, places: int) -> str:
    integer_digits = max(1, value.adjusted() + 1) if value else 1
    with localcontext() as context:
        context.prec = max(28, integer_digits + places + 2, len(value.as_tuple().digits) + 2)
        rounded = value.quantize(Decimal(1).scaleb(-places), rounding=ROUND_HALF_UP)
    return format(rounded, f".{places}f")


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
    names = (
        getattr(original, "constraint_name", None),
        getattr(original, "constraint", None),
        getattr(diagnostic, "constraint_name", None),
    )
    return _NAME_UNIQUE_CONSTRAINT in names or _NAME_UNIQUE_CONSTRAINT in str(original)


def _coupon_position(coupon: BondCouponSchedule) -> CouponPosition:
    return CouponPosition(
        coupon_number=coupon.coupon_number,
        coupon_date=coupon.coupon_date,
        pay_one_bond_amount=coupon.pay_one_bond_amount,
        coupon_start_date=coupon.coupon_start_date,
        coupon_end_date=coupon.coupon_end_date,
        coupon_period=coupon.coupon_period,
        fix_date=coupon.fix_date,
    )


def build_bond_card(bond: Bond, *, today: date) -> BondCard:
    metrics = calculate_bond_metrics(
        maturity_date=bond.maturity_date,
        purchases=tuple(PurchasePosition(p.amount_spent, p.quantity, p.purchase_date) for p in bond.purchases),
        coupons=tuple(_coupon_position(coupon) for coupon in bond.coupon_schedules),
        today=today,
    )
    next_coupon = None
    if metrics.next_coupon_pay_date is not None:
        next_coupon = NextCoupon(
            period_start=metrics.next_coupon_period_start,
            period_end=metrics.next_coupon_period_end,
            pay_date=metrics.next_coupon_pay_date,
            amount=_fixed_decimal(metrics.next_coupon_amount, 2),
            amount_per_bond=_fixed_decimal(metrics.next_coupon_amount_per_bond, 2),
            days_until=metrics.next_coupon_days_until,
            period_days=metrics.next_coupon_period_days,
            elapsed_period_days=metrics.next_coupon_elapsed_period_days,
        )
    return BondCard(
        id=bond.id,
        instrument_uid=bond.instrument_uid,
        ticker=bond.ticker,
        name=bond.name,
        nominal=_fixed_decimal(bond.nominal, 2),
        payments_per_year=bond.payments_per_year,
        placement_date=bond.placement_date,
        maturity_date=bond.maturity_date,
        status=metrics.status,
        total_quantity=metrics.total_quantity,
        total_spent=_fixed_decimal(metrics.total_spent, 2),
        paid_coupon_total=_fixed_decimal(metrics.paid_coupon_total, 2),
        annual_coupon_yield_percent=_fixed_decimal(metrics.annual_coupon_yield_percent, 4),
        maturity_remaining=MaturityRemaining(
            years=metrics.remaining_years,
            months=metrics.remaining_months,
            days_until=metrics.remaining_days_until,
        ),
        next_coupon=next_coupon,
        purchases=[
            BondPurchaseItem(
                id=purchase.id,
                amount_spent=_fixed_decimal(purchase.amount_spent, 2),
                quantity=purchase.quantity,
                purchase_date=purchase.purchase_date,
            )
            for purchase in sorted(
                bond.purchases,
                key=lambda item: (item.purchase_date, item.created_at, item.id.hex),
                reverse=True,
            )
        ],
    )


def _load_bond_relations() -> tuple[object, object]:
    return selectinload(Bond.purchases), selectinload(Bond.coupon_schedules)


async def is_name_available(db: AsyncSession, user_id: UUID, name: str) -> bool:
    bond_id = await db.scalar(
        select(Bond.id).where(
            Bond.user_id == user_id,
            func.lower(func.trim(Bond.name)) == func.lower(func.trim(name)),
        )
    )
    return bond_id is None


async def list_bonds(db: AsyncSession, user_id: UUID, *, today: date) -> list[BondCard]:
    bonds = list(
        await db.scalars(
            select(Bond).options(*_load_bond_relations()).where(Bond.user_id == user_id)
        )
    )
    cards = [build_bond_card(bond, today=today) for bond in bonds]
    status_order = {"active": 0, "payment_pending": 1, "matured": 2}
    return sorted(
        cards,
        key=lambda card: (status_order[card.status], card.maturity_date, card.name.casefold()),
    )


async def create_bond(
    db: AsyncSession,
    user_id: UUID,
    data: BondCreate,
    gateway: TInvestGateway,
) -> BondCard:
    if not await is_name_available(db, user_id, data.name):
        raise _name_taken()
    schedule = await gateway.get_coupon_schedule(
        data.instrument_uid, data.purchase_date, data.maturity_date
    )
    bond = Bond(
        user_id=user_id,
        instrument_uid=data.instrument_uid,
        ticker=data.ticker,
        name=data.name,
        nominal=data.nominal,
        payments_per_year=data.payments_per_year,
        placement_date=data.placement_date,
        maturity_date=data.maturity_date,
    )
    bond.purchases.append(BondPurchase(user_id=user_id, amount_spent=data.amount_spent, quantity=data.quantity, purchase_date=data.purchase_date))
    bond.coupon_schedules = [
        BondCouponSchedule(
            figi=coupon.figi, coupon_date=coupon.coupon_date, coupon_number=coupon.coupon_number,
            fix_date=coupon.fix_date, pay_one_bond_amount=coupon.pay_one_bond_amount,
            pay_one_bond_currency=coupon.pay_one_bond_currency, coupon_type=coupon.coupon_type,
            coupon_start_date=coupon.coupon_start_date, coupon_end_date=coupon.coupon_end_date,
            coupon_period=coupon.coupon_period,
        )
        for coupon in schedule
    ]
    db.add(bond)
    try:
        await db.flush()
        card = build_bond_card(bond, today=clock.utc_today())
        await db.commit()
        return card
    except IntegrityError as error:
        await db.rollback()
        if _is_name_unique_violation(error):
            raise _name_taken() from error
        raise
    except Exception:
        await db.rollback()
        raise


async def add_purchase(db: AsyncSession, user_id: UUID, bond_id: UUID, data: PurchaseCreate) -> BondCard:
    bond = await db.scalar(
        select(Bond).options(*_load_bond_relations()).where(Bond.id == bond_id, Bond.user_id == user_id)
    )
    if bond is None:
        raise _bond_not_found()
    if data.purchase_date < bond.placement_date:
        raise ApiError(status_code=422, code="validation_error", message="Request validation failed", field_errors={"purchase_date": "Purchase date must not be before placement date"})
    if data.purchase_date >= bond.maturity_date:
        raise ApiError(status_code=422, code="validation_error", message="Request validation failed", field_errors={"purchase_date": "Purchase date must be before maturity date"})
    if bond.purchases and data.purchase_date < min(purchase.purchase_date for purchase in bond.purchases):
        raise ApiError(status_code=422, code="validation_error", message="Request validation failed", field_errors={"purchase_date": "Purchase date must not be earlier than the first purchase"})
    bond.purchases.append(BondPurchase(user_id=user_id, amount_spent=data.amount_spent, quantity=data.quantity, purchase_date=data.purchase_date))
    try:
        await db.flush()
        card = build_bond_card(bond, today=clock.utc_today())
        await db.commit()
        return card
    except Exception:
        await db.rollback()
        raise


async def delete_bond(db: AsyncSession, user_id: UUID, bond_id: UUID) -> None:
    bond = await db.scalar(
        select(Bond).options(*_load_bond_relations()).where(Bond.id == bond_id, Bond.user_id == user_id)
    )
    if bond is None:
        raise _bond_not_found()
    try:
        await db.delete(bond)
        await db.commit()
    except Exception:
        await db.rollback()
        raise

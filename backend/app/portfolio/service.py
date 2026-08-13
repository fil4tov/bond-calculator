from datetime import UTC, date, datetime
from decimal import Decimal, ROUND_HALF_UP, localcontext
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.errors import ApiError

from . import clock
from .calculations import (
    CouponPosition,
    OperationPosition,
    calculate_bond_metrics,
    calculate_operation_realized_results,
)
from .models import Bond, BondCouponSchedule, BondOperation
from .schemas import (
    BondCard,
    BondCreate,
    BondOperationItem,
    MaturityRemaining,
    NextCoupon,
    OperationDeleteResponse,
    PurchaseCreate,
    SaleCreate,
)
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


def _operation_position(operation: BondOperation) -> OperationPosition:
    return OperationPosition(
        operation_type=operation.operation_type,  # type: ignore[arg-type]
        amount=operation.amount,
        quantity=operation.quantity,
        operation_date=operation.operation_date,
        created_at=operation.created_at,
        operation_id=operation.id.hex,
    )


def _ordered_operations(bond: Bond, *, reverse: bool = False) -> list[BondOperation]:
    return sorted(
        bond.operations,
        key=lambda item: (item.operation_date, item.created_at, item.id.hex),
        reverse=reverse,
    )


def build_bond_card(
    bond: Bond, *, today: date, market_value_without_aci: str | None = None
) -> BondCard:
    ordered_operations = _ordered_operations(bond)
    operation_positions = tuple(_operation_position(item) for item in ordered_operations)
    metrics = calculate_bond_metrics(
        maturity_date=bond.maturity_date,
        payments_per_year=bond.payments_per_year,
        operations=operation_positions,
        coupons=tuple(_coupon_position(coupon) for coupon in bond.coupon_schedules),
        today=today,
    )
    operation_realized_results = calculate_operation_realized_results(operation_positions)
    if metrics.total_quantity == 0:
        accrued_coupon_income = "0.00"
    elif bond.aci_value is not None and bond.instrument_checked_on == today:
        accrued_coupon_income = _fixed_decimal(
            bond.aci_value * metrics.total_quantity,
            2,
        )
    else:
        accrued_coupon_income = None
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
        created_at=(
            bond.created_at.replace(tzinfo=UTC)
            if bond.created_at.tzinfo is None
            else bond.created_at
        ),
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
        position_cost_basis=_fixed_decimal(metrics.position_cost_basis, 2),
        realized_result=_fixed_decimal(metrics.realized_result, 2),
        position_status=metrics.position_status,
        paid_coupon_total=_fixed_decimal(metrics.paid_coupon_total, 2),
        calendar_year_paid_coupon_income=_fixed_decimal(
            metrics.calendar_year_paid_coupon_income,
            2,
        ),
        market_value_without_aci=market_value_without_aci,
        accrued_coupon_income=accrued_coupon_income,
        calendar_year_coupon_income=_fixed_decimal(metrics.calendar_year_coupon_income, 2),
        calendar_month_coupon_income=_fixed_decimal(metrics.calendar_month_coupon_income, 2),
        calendar_year_coupon_yield_percent=_fixed_decimal(
            metrics.calendar_year_coupon_yield_percent, 4
        ),
        annual_coupon_yield_percent=(
            _fixed_decimal(metrics.annual_coupon_yield_percent, 4)
            if metrics.annual_coupon_yield_percent is not None
            else None
        ),
        coupon_yield_year=metrics.coupon_yield_year,
        maturity_remaining=MaturityRemaining(
            years=metrics.remaining_years,
            months=metrics.remaining_months,
            days_until=metrics.remaining_days_until,
        ),
        next_coupon=next_coupon,
        operations=[
            BondOperationItem(
                id=operation.id,
                operation_type=operation.operation_type,  # type: ignore[arg-type]
                amount=_fixed_decimal(operation.amount, 2),
                realized_result=(
                    _fixed_decimal(operation_realized_results[operation.id.hex], 2)
                    if operation_realized_results[operation.id.hex] is not None
                    else None
                ),
                quantity=operation.quantity,
                operation_date=operation.operation_date,
            )
            for operation in _ordered_operations(bond, reverse=True)
        ],
    )


def _load_bond_relations() -> tuple[object, object]:
    return selectinload(Bond.operations), selectinload(Bond.coupon_schedules)


async def is_name_available(db: AsyncSession, user_id: UUID, name: str) -> bool:
    bond_id = await db.scalar(
        select(Bond.id).where(
            Bond.user_id == user_id,
            func.lower(func.trim(Bond.name)) == func.lower(func.trim(name)),
        )
    )
    return bond_id is None


async def list_bonds(
    db: AsyncSession, user_id: UUID, *, today: date, gateway: TInvestGateway
) -> list[BondCard]:
    bonds = list(
        await db.scalars(
            select(Bond).options(*_load_bond_relations()).where(Bond.user_id == user_id)
        )
    )
    refresh_failed: set[UUID] = set()
    refresh_succeeded = False
    for bond in bonds:
        if bond.instrument_checked_on == today and bond.aci_value is not None:
            continue
        try:
            current_bond = await gateway.lookup_bond(bond.instrument_uid)
        except Exception:
            refresh_failed.add(bond.id)
            continue
        if current_bond is None:
            refresh_failed.add(bond.id)
            continue
        bond.nominal = current_bond.nominal
        bond.aci_value = current_bond.aci_value
        bond.instrument_checked_on = today
        refresh_succeeded = True
    if refresh_succeeded:
        await db.commit()

    cards = [build_bond_card(bond, today=today) for bond in bonds]
    eligible = [
        (bond, card)
        for bond, card in zip(bonds, cards, strict=True)
        if card.status == "active" and card.position_status == "open" and bond.id not in refresh_failed
    ]
    prices: dict[str, Decimal] = {}
    if eligible:
        try:
            prices = await gateway.get_last_prices(
                tuple(bond.instrument_uid for bond, _card in eligible)
            )
        except Exception:
            prices = {}
    for index, (bond, card) in enumerate(zip(bonds, cards, strict=True)):
        if card.position_status == "closed":
            cards[index] = build_bond_card(bond, today=today, market_value_without_aci="0.00")
            continue
        if card.status != "active" or bond.id in refresh_failed:
            continue
        price = prices.get(bond.instrument_uid)
        if price is not None:
            cards[index] = build_bond_card(
                bond,
                today=today,
                market_value_without_aci=_fixed_decimal(
                    price / Decimal("100") * bond.nominal * card.total_quantity, 2
                ),
            )
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
    bond.operations.append(
        BondOperation(
            user_id=user_id,
            operation_type="purchase",
            amount=data.amount_spent,
            quantity=data.quantity,
            operation_date=data.purchase_date,
        )
    )
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
        select(Bond)
        .options(*_load_bond_relations())
        .where(Bond.id == bond_id, Bond.user_id == user_id)
        .with_for_update()
    )
    if bond is None:
        raise _bond_not_found()
    earliest_purchase_date = min(
        (
            operation.operation_date
            for operation in bond.operations
            if operation.operation_type == "purchase"
        ),
        default=bond.placement_date,
    )
    if data.purchase_date < earliest_purchase_date:
        raise ApiError(status_code=422, code="validation_error", message="Request validation failed", field_errors={"purchase_date": "Purchase date must not be before the earliest purchase date"})
    if data.purchase_date >= bond.maturity_date:
        raise ApiError(status_code=422, code="validation_error", message="Request validation failed", field_errors={"purchase_date": "Purchase date must be before maturity date"})
    bond.operations.append(
        BondOperation(
            user_id=user_id,
            operation_type="purchase",
            amount=data.amount_spent,
            quantity=data.quantity,
            operation_date=data.purchase_date,
        )
    )
    try:
        await db.flush()
        card = build_bond_card(bond, today=clock.utc_today())
        await db.commit()
        return card
    except Exception:
        await db.rollback()
        raise


def _validate_operation_date(bond: Bond, operation_date: date, *, field: str) -> None:
    if operation_date < bond.placement_date:
        raise ApiError(
            status_code=422,
            code="validation_error",
            message="Request validation failed",
            field_errors={field: "Operation date must not be before placement date"},
        )
    if operation_date >= bond.maturity_date:
        raise ApiError(
            status_code=422,
            code="validation_error",
            message="Request validation failed",
            field_errors={field: "Operation date must be before maturity date"},
        )


async def add_sale(db: AsyncSession, user_id: UUID, bond_id: UUID, data: SaleCreate) -> BondCard:
    bond = await db.scalar(
        select(Bond)
        .options(*_load_bond_relations())
        .where(Bond.id == bond_id, Bond.user_id == user_id)
        .with_for_update()
    )
    if bond is None:
        raise _bond_not_found()
    _validate_operation_date(bond, data.sale_date, field="sale_date")
    prospective_operations = tuple(
        [
            *(_operation_position(item) for item in _ordered_operations(bond)),
            OperationPosition(
                "sale",
                data.amount_received,
                data.quantity,
                data.sale_date,
                datetime.now(UTC),
            ),
        ]
    )
    try:
        calculate_bond_metrics(
            maturity_date=bond.maturity_date,
            payments_per_year=bond.payments_per_year,
            operations=prospective_operations,
            coupons=(),
            today=clock.utc_today(),
        )
    except ValueError as error:
        raise ApiError(
            status_code=422,
            code="validation_error",
            message="Request validation failed",
            field_errors={
                "quantity": "Sale quantity must not exceed the open position at the sale date"
            },
        ) from error
    bond.operations.append(
        BondOperation(
            user_id=user_id,
            operation_type="sale",
            amount=data.amount_received,
            quantity=data.quantity,
            operation_date=data.sale_date,
        )
    )
    try:
        await db.flush()
        card = build_bond_card(bond, today=clock.utc_today())
        await db.commit()
        return card
    except Exception:
        await db.rollback()
        raise


async def delete_operation(
    db: AsyncSession, user_id: UUID, bond_id: UUID, operation_id: UUID
) -> OperationDeleteResponse:
    bond = await db.scalar(
        select(Bond)
        .options(*_load_bond_relations())
        .where(Bond.id == bond_id, Bond.user_id == user_id)
        .with_for_update()
    )
    if bond is None:
        raise _bond_not_found()
    operation = next((item for item in bond.operations if item.id == operation_id), None)
    if operation is None:
        raise ApiError(status_code=404, code="operation_not_found", message="Operation not found")
    remaining = tuple(
        _operation_position(item)
        for item in _ordered_operations(bond)
        if item.id != operation_id
    )
    try:
        calculate_bond_metrics(
            maturity_date=bond.maturity_date,
            payments_per_year=bond.payments_per_year,
            operations=remaining,
            coupons=(),
            today=clock.utc_today(),
        )
    except ValueError as error:
        raise ApiError(
            status_code=422,
            code="operation_delete_blocked",
            message="Operation cannot be deleted because it would oversell the position",
            field_errors={"operation_id": str(error)},
        ) from error
    try:
        if len(remaining) == 0:
            await db.delete(bond)
            await db.commit()
            return OperationDeleteResponse(item=None)
        bond.operations.remove(operation)
        await db.flush()
        card = build_bond_card(bond, today=clock.utc_today())
        await db.commit()
        return OperationDeleteResponse(item=card)
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

import calendar
from dataclasses import dataclass
from datetime import UTC, date, datetime
from decimal import Decimal, ROUND_HALF_UP, localcontext
from typing import Literal


@dataclass(frozen=True)
class PurchasePosition:
    amount_spent: Decimal
    quantity: int
    purchase_date: date


@dataclass(frozen=True)
class OperationPosition:
    operation_type: Literal["purchase", "sale"]
    amount: Decimal
    quantity: int
    operation_date: date
    created_at: datetime | None = None
    operation_id: str = ""


@dataclass(frozen=True)
class CouponPosition:
    coupon_number: int
    coupon_date: date
    pay_one_bond_amount: Decimal
    coupon_start_date: date
    coupon_end_date: date
    coupon_period: int
    fix_date: date | None


@dataclass(frozen=True)
class BondMetrics:
    status: Literal["active", "payment_pending", "matured"]
    total_quantity: int
    total_spent: Decimal
    position_cost_basis: Decimal
    realized_result: Decimal
    position_status: Literal["open", "closed"]
    paid_coupon_total: Decimal
    calendar_year_paid_coupon_income: Decimal
    calendar_year_coupon_income: Decimal
    calendar_month_coupon_income: Decimal
    calendar_year_coupon_yield_percent: Decimal
    annual_coupon_yield_percent: Decimal | None
    coupon_yield_year: int
    remaining_years: int
    remaining_months: int
    remaining_days_until: int
    next_coupon_period_start: date | None
    next_coupon_period_end: date | None
    next_coupon_pay_date: date | None
    next_coupon_amount: Decimal | None
    next_coupon_amount_per_bond: Decimal | None
    next_coupon_days_until: int | None
    next_coupon_period_days: int | None
    next_coupon_elapsed_period_days: int | None


def _shift_forward_from_anchor(anchor: date, months_forward: int) -> date:
    month_index = anchor.year * 12 + anchor.month - 1 + months_forward
    year, zero_based_month = divmod(month_index, 12)
    return date(year, zero_based_month + 1, min(anchor.day, calendar.monthrange(year, zero_based_month + 1)[1]))


def _remaining_calendar_parts(today: date, maturity_date: date) -> tuple[int, int, int]:
    if maturity_date <= today:
        return 0, 0, 0
    full_months = (maturity_date.year - today.year) * 12 + maturity_date.month - today.month
    if _shift_forward_from_anchor(today, full_months) > maturity_date:
        full_months -= 1
    years, months = divmod(full_months, 12)
    return years, months, (maturity_date - today).days


def _operation_sort_key(operation: OperationPosition) -> tuple[date, datetime, str]:
    return operation.operation_date, operation.created_at or datetime.min.replace(tzinfo=UTC), operation.operation_id


def _replay_operations(
    operations: tuple[OperationPosition, ...],
) -> tuple[int, Decimal, Decimal, dict[str, Decimal | None]]:
    quantity = 0
    cost_basis = Decimal("0.00")
    realized_result = Decimal("0.00")
    operation_realized_results: dict[str, Decimal | None] = {}
    with localcontext() as context:
        context.prec = 48
        for operation in sorted(operations, key=_operation_sort_key):
            if operation.operation_type == "purchase":
                quantity += operation.quantity
                cost_basis += operation.amount
                operation_realized_results[operation.operation_id] = None
                continue
            if operation.quantity > quantity:
                raise ValueError("Sale quantity exceeds the open position")
            sold_cost = cost_basis * Decimal(operation.quantity) / Decimal(quantity)
            quantity -= operation.quantity
            cost_basis -= sold_cost
            sale_realized_result = operation.amount - sold_cost
            realized_result += sale_realized_result
            operation_realized_results[operation.operation_id] = sale_realized_result
    return quantity, cost_basis, realized_result, operation_realized_results


def calculate_operation_realized_results(
    operations: tuple[OperationPosition, ...],
) -> dict[str, Decimal | None]:
    return _replay_operations(operations)[3]


def _position_at_coupon_cutoff(
    coupon: CouponPosition, operations: tuple[OperationPosition, ...]
) -> tuple[int, Decimal]:
    if coupon.fix_date is not None:
        applicable = tuple(item for item in operations if item.operation_date <= coupon.fix_date)
    else:
        applicable = tuple(item for item in operations if item.operation_date < coupon.coupon_end_date)
    quantity, cost_basis, _, _ = _replay_operations(applicable)
    return quantity, cost_basis


def _payment_amount(coupon: CouponPosition, operations: tuple[OperationPosition, ...]) -> Decimal:
    quantity, _ = _position_at_coupon_cutoff(coupon, operations)
    return coupon.pay_one_bond_amount * quantity


def _coupon_event_yield_percent(
    coupon: CouponPosition, operations: tuple[OperationPosition, ...]
) -> Decimal:
    quantity, cost_basis = _position_at_coupon_cutoff(coupon, operations)
    if cost_basis == 0:
        return Decimal("0")
    return coupon.pay_one_bond_amount * quantity / cost_basis * Decimal("100")


def calculate_bond_metrics(
    *,
    maturity_date: date,
    payments_per_year: int,
    purchases: tuple[PurchasePosition, ...] = (),
    operations: tuple[OperationPosition, ...] | None = None,
    coupons: tuple[CouponPosition, ...],
    today: date,
) -> BondMetrics:
    replay_operations = operations if operations is not None else tuple(
        OperationPosition("purchase", item.amount_spent, item.quantity, item.purchase_date)
        for item in purchases
    )
    total_quantity, position_cost_basis, realized_result, _ = _replay_operations(
        replay_operations
    )
    total_spent = sum(
        (item.amount for item in replay_operations if item.operation_type == "purchase"),
        start=Decimal("0.00"),
    )
    ordered_coupons = tuple(sorted(coupons, key=lambda item: (item.coupon_date, item.coupon_number)))
    with localcontext() as context:
        context.prec = 48
        paid_total = sum(
            (
                _payment_amount(coupon, replay_operations)
                for coupon in ordered_coupons
                if coupon.coupon_date <= today
            ),
            start=Decimal("0.00"),
        )
        calendar_year_start = date(today.year, 1, 1)
        calendar_year_end = date(today.year, 12, 31)
        calendar_month_start = date(today.year, today.month, 1)
        calendar_month_end = date(
            today.year,
            today.month,
            calendar.monthrange(today.year, today.month)[1],
        )
        calendar_year_paid_coupon_income = sum(
            (
                _payment_amount(coupon, replay_operations)
                for coupon in ordered_coupons
                if calendar_year_start <= coupon.coupon_date <= today
            ),
            start=Decimal("0.00"),
        )
        calendar_year_yield = sum(
            (
                _coupon_event_yield_percent(coupon, replay_operations)
                for coupon in ordered_coupons
                if calendar_year_start <= coupon.coupon_date <= calendar_year_end
            ),
            start=Decimal("0"),
        ).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)
        calendar_year_coupon_income = sum(
            (
                _payment_amount(coupon, replay_operations)
                for coupon in ordered_coupons
                if calendar_year_start <= coupon.coupon_date <= calendar_year_end
            ),
            start=Decimal("0.00"),
        )
        calendar_month_coupon_income = sum(
            (
                _payment_amount(coupon, replay_operations)
                for coupon in ordered_coupons
                if calendar_month_start <= coupon.coupon_date <= calendar_month_end
            ),
            start=Decimal("0.00"),
        )
        next_coupon = next(
            (
                coupon
                for coupon in ordered_coupons
                if coupon.coupon_date > today
                and coupon.pay_one_bond_amount > 0
                and _position_at_coupon_cutoff(coupon, replay_operations)[0] > 0
            ),
            None,
        )
        annual_coupon_yield_percent = (
            (
                next_coupon.pay_one_bond_amount
                * Decimal(payments_per_year)
                * Decimal(total_quantity)
                / position_cost_basis
                * Decimal("100")
            ).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)
            if next_coupon is not None
            and payments_per_year > 0
            and total_quantity > 0
            and position_cost_basis != 0
            else None
        )
    future_payment_exists = next_coupon is not None
    status: Literal["active", "payment_pending", "matured"]
    if today < maturity_date:
        status = "active"
    elif future_payment_exists:
        status = "payment_pending"
    else:
        status = "matured"
    years, months, days = _remaining_calendar_parts(today, maturity_date)
    if next_coupon is None:
        return BondMetrics(
            status=status,
            total_quantity=total_quantity,
            total_spent=total_spent,
            position_cost_basis=position_cost_basis,
            realized_result=realized_result,
            position_status="open" if total_quantity else "closed",
            paid_coupon_total=paid_total,
            calendar_year_paid_coupon_income=calendar_year_paid_coupon_income,
            calendar_year_coupon_income=calendar_year_coupon_income,
            calendar_month_coupon_income=calendar_month_coupon_income,
            calendar_year_coupon_yield_percent=calendar_year_yield,
            annual_coupon_yield_percent=annual_coupon_yield_percent,
            coupon_yield_year=today.year,
            remaining_years=years,
            remaining_months=months,
            remaining_days_until=days,
            next_coupon_period_start=None,
            next_coupon_period_end=None,
            next_coupon_pay_date=None,
            next_coupon_amount=None,
            next_coupon_amount_per_bond=None,
            next_coupon_days_until=None,
            next_coupon_period_days=None,
            next_coupon_elapsed_period_days=None,
        )
    period_days = next_coupon.coupon_period
    elapsed = min(period_days, max(0, (min(today, next_coupon.coupon_end_date) - next_coupon.coupon_start_date).days))
    return BondMetrics(
        status=status,
        total_quantity=total_quantity,
        total_spent=total_spent,
        position_cost_basis=position_cost_basis,
        realized_result=realized_result,
        position_status="open" if total_quantity else "closed",
        paid_coupon_total=paid_total,
        calendar_year_paid_coupon_income=calendar_year_paid_coupon_income,
        calendar_year_coupon_income=calendar_year_coupon_income,
        calendar_month_coupon_income=calendar_month_coupon_income,
        calendar_year_coupon_yield_percent=calendar_year_yield,
        annual_coupon_yield_percent=annual_coupon_yield_percent,
        coupon_yield_year=today.year,
        remaining_years=years,
        remaining_months=months,
        remaining_days_until=days,
        next_coupon_period_start=next_coupon.coupon_start_date,
        next_coupon_period_end=next_coupon.coupon_end_date,
        next_coupon_pay_date=next_coupon.coupon_date,
        next_coupon_amount=_payment_amount(next_coupon, replay_operations),
        next_coupon_amount_per_bond=next_coupon.pay_one_bond_amount,
        next_coupon_days_until=(next_coupon.coupon_date - today).days,
        next_coupon_period_days=period_days,
        next_coupon_elapsed_period_days=elapsed,
    )

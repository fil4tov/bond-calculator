import calendar
from dataclasses import dataclass
from datetime import date
from decimal import Decimal, ROUND_HALF_UP, localcontext
from typing import Literal


@dataclass(frozen=True)
class PurchasePosition:
    amount_spent: Decimal
    quantity: int
    purchase_date: date


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
    paid_coupon_total: Decimal
    annual_coupon_yield_percent: Decimal
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


def _anniversary(today: date) -> date:
    try:
        return today.replace(year=today.year + 1)
    except ValueError:
        return today.replace(year=today.year + 1, day=28)


def _eligible_quantity(coupon: CouponPosition, purchases: tuple[PurchasePosition, ...]) -> int:
    return sum(
        purchase.quantity
        for purchase in purchases
        if purchase.purchase_date <= coupon.fix_date
        if coupon.fix_date is not None
    ) if coupon.fix_date is not None else sum(
        purchase.quantity for purchase in purchases if purchase.purchase_date < coupon.coupon_end_date
    )


def _payment_amount(coupon: CouponPosition, purchases: tuple[PurchasePosition, ...]) -> Decimal:
    return coupon.pay_one_bond_amount * _eligible_quantity(coupon, purchases)


def calculate_bond_metrics(
    *,
    maturity_date: date,
    purchases: tuple[PurchasePosition, ...],
    coupons: tuple[CouponPosition, ...],
    today: date,
) -> BondMetrics:
    total_quantity = sum(purchase.quantity for purchase in purchases)
    total_spent = sum((purchase.amount_spent for purchase in purchases), start=Decimal("0.00"))
    ordered_coupons = tuple(sorted(coupons, key=lambda item: (item.coupon_date, item.coupon_number)))
    with localcontext() as context:
        context.prec = 48
        paid_total = sum(
            (
                _payment_amount(coupon, purchases)
                for coupon in ordered_coupons
                if coupon.coupon_date <= today
            ),
            start=Decimal("0.00"),
        )
        annual_payments = sum(
            (
                _payment_amount(coupon, purchases)
                for coupon in ordered_coupons
                if today < coupon.coupon_date <= _anniversary(today)
            ),
            start=Decimal("0.00"),
        )
        annual_yield = (
            (annual_payments / total_spent * Decimal("100")).quantize(
                Decimal("0.0001"), rounding=ROUND_HALF_UP
            )
            if total_spent
            else Decimal("0.0000")
        )
    next_coupon = next(
        (
            coupon
            for coupon in ordered_coupons
            if coupon.coupon_date > today
            and coupon.pay_one_bond_amount > 0
            and _eligible_quantity(coupon, purchases) > 0
        ),
        None,
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
        return BondMetrics(status, total_quantity, total_spent, paid_total, annual_yield, years, months, days, None, None, None, None, None, None, None, None)
    period_days = next_coupon.coupon_period
    elapsed = min(period_days, max(0, (min(today, next_coupon.coupon_end_date) - next_coupon.coupon_start_date).days))
    return BondMetrics(
        status, total_quantity, total_spent, paid_total, annual_yield, years, months, days,
        next_coupon.coupon_start_date, next_coupon.coupon_end_date, next_coupon.coupon_date,
        _payment_amount(next_coupon, purchases), next_coupon.pay_one_bond_amount,
        (next_coupon.coupon_date - today).days, period_days, elapsed,
    )

import calendar
from dataclasses import dataclass
from datetime import date, timedelta
from decimal import Decimal, ROUND_HALF_UP, localcontext
from typing import Literal

from .business_calendar import next_business_day


DEFAULT_COUPON_PERIOD_DAYS = {1: 365, 2: 182, 3: 122, 4: 91, 6: 61, 12: 30}


@dataclass(frozen=True)
class PurchasePosition:
    amount_spent: Decimal
    quantity: int
    purchase_date: date


@dataclass(frozen=True)
class CouponPeriod:
    start: date
    end: date
    pay_date: date


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
    next_coupon_days_until: int | None
    next_coupon_period_days: int | None
    next_coupon_elapsed_period_days: int | None


def _shift_forward_from_anchor(anchor: date, months_forward: int) -> date:
    month_index = anchor.year * 12 + anchor.month - 1 + months_forward
    year, zero_based_month = divmod(month_index, 12)
    month = zero_based_month + 1
    day = min(anchor.day, calendar.monthrange(year, month)[1])
    return date(year, month, day)


def infer_coupon_period_days(payments_per_year: int) -> int:
    return DEFAULT_COUPON_PERIOD_DAYS[payments_per_year]


def _period_count(
    *, placement_date: date, maturity_date: date, payments_per_year: int
) -> int:
    lifetime_days = (maturity_date - placement_date).days
    raw_count = Decimal(lifetime_days * payments_per_year) / Decimal(365)
    return max(1, int(raw_count.quantize(Decimal("1"), rounding=ROUND_HALF_UP)))


def coupon_period_count(
    *, placement_date: date, maturity_date: date, payments_per_year: int
) -> int:
    return _period_count(
        placement_date=placement_date,
        maturity_date=maturity_date,
        payments_per_year=payments_per_year,
    )


def _period_at(
    *,
    placement_date: date,
    maturity_date: date,
    payments_per_year: int,
    coupon_period_days: int,
    index: int,
    period_count: int | None = None,
) -> CouponPeriod:
    count = period_count or _period_count(
        placement_date=placement_date,
        maturity_date=maturity_date,
        payments_per_year=payments_per_year,
    )
    if index < 0 or index >= count:
        raise IndexError("coupon period index out of range")
    step = timedelta(days=coupon_period_days)
    start = (
        placement_date
        if index == 0
        else maturity_date - step * (count - index)
    )
    end = (
        maturity_date
        if index == count - 1
        else maturity_date - step * (count - index - 1)
    )
    if end <= start:
        raise ValueError("coupon period is incompatible with bond dates")
    return CouponPeriod(start=start, end=end, pay_date=next_business_day(end))


def _first_period_index(
    *,
    placement_date: date,
    maturity_date: date,
    payments_per_year: int,
    coupon_period_days: int,
    predicate: Literal["end_after", "pay_after"],
    bound: date,
) -> int:
    count = _period_count(
        placement_date=placement_date,
        maturity_date=maturity_date,
        payments_per_year=payments_per_year,
    )
    low = 0
    high = count
    while low < high:
        middle = (low + high) // 2
        period = _period_at(
            placement_date=placement_date,
            maturity_date=maturity_date,
            payments_per_year=payments_per_year,
            coupon_period_days=coupon_period_days,
            index=middle,
            period_count=count,
        )
        value = period.end if predicate == "end_after" else period.pay_date
        if value > bound:
            high = middle
        else:
            low = middle + 1
    return low


def _paid_coupon_count(
    *,
    placement_date: date,
    maturity_date: date,
    payments_per_year: int,
    coupon_period_days: int,
    purchase_date: date,
    today: date,
) -> int:
    first_eligible = _first_period_index(
        placement_date=placement_date,
        maturity_date=maturity_date,
        payments_per_year=payments_per_year,
        coupon_period_days=coupon_period_days,
        predicate="end_after",
        bound=purchase_date,
    )
    first_unpaid = _first_period_index(
        placement_date=placement_date,
        maturity_date=maturity_date,
        payments_per_year=payments_per_year,
        coupon_period_days=coupon_period_days,
        predicate="pay_after",
        bound=today,
    )
    return max(0, first_unpaid - first_eligible)


def coupon_dates_between(
    *,
    placement_date: date,
    maturity_date: date,
    payments_per_year: int,
    coupon_period_days: int,
    after: date,
    through: date,
) -> tuple[date, ...]:
    """Return actual payment dates satisfying ``after < pay_date <= through``."""
    count = _period_count(
        placement_date=placement_date,
        maturity_date=maturity_date,
        payments_per_year=payments_per_year,
    )
    index = _first_period_index(
        placement_date=placement_date,
        maturity_date=maturity_date,
        payments_per_year=payments_per_year,
        coupon_period_days=coupon_period_days,
        predicate="pay_after",
        bound=after,
    )
    dates: list[date] = []
    while index < count:
        period = _period_at(
            placement_date=placement_date,
            maturity_date=maturity_date,
            payments_per_year=payments_per_year,
            coupon_period_days=coupon_period_days,
            index=index,
            period_count=count,
        )
        if period.pay_date > through:
            break
        dates.append(period.pay_date)
        index += 1
    return tuple(dates)


def _remaining_calendar_parts(today: date, maturity_date: date) -> tuple[int, int, int]:
    if maturity_date <= today:
        return 0, 0, 0
    full_months = (maturity_date.year - today.year) * 12 + maturity_date.month - today.month
    if _shift_forward_from_anchor(today, full_months) > maturity_date:
        full_months -= 1
    years, months = divmod(full_months, 12)
    return years, months, (maturity_date - today).days


def _decimal_width(value: Decimal) -> int:
    _, digits, exponent = value.as_tuple()
    integer_digits = max(1, value.adjusted() + 1) if value else 1
    return max(len(digits), integer_digits) + max(0, -exponent)


def _calculation_precision(
    coupon_amount: Decimal,
    purchases: tuple[PurchasePosition, ...],
    total_quantity: int,
    coupon_counts: tuple[int, ...],
    payments_per_year: int,
) -> int:
    money_values = (coupon_amount, *(purchase.amount_spent for purchase in purchases))
    money_width = max((_decimal_width(value) for value in money_values), default=1)
    quantity_width = len(str(abs(total_quantity))) if total_quantity else 1
    count_width = len(str(max(coupon_counts, default=0))) or 1
    purchase_growth = len(str(max(1, len(purchases))))
    frequency_width = len(str(payments_per_year))
    return max(
        28,
        money_width
        + quantity_width
        + count_width
        + purchase_growth
        + frequency_width
        + 12,
    )


def calculate_bond_metrics(
    *,
    coupon_amount: Decimal,
    nominal: Decimal,
    payments_per_year: int,
    coupon_period_days: int,
    placement_date: date,
    maturity_date: date,
    purchases: tuple[PurchasePosition, ...],
    today: date,
) -> BondMetrics:
    del nominal
    total_quantity = sum(purchase.quantity for purchase in purchases)
    coupon_counts = tuple(
        _paid_coupon_count(
            placement_date=placement_date,
            maturity_date=maturity_date,
            payments_per_year=payments_per_year,
            coupon_period_days=coupon_period_days,
            purchase_date=purchase.purchase_date,
            today=today,
        )
        for purchase in purchases
    )
    precision = _calculation_precision(
        coupon_amount,
        purchases,
        total_quantity,
        coupon_counts,
        payments_per_year,
    )
    with localcontext() as context:
        context.prec = precision
        total_spent = sum(
            (purchase.amount_spent for purchase in purchases), start=Decimal("0.00")
        )
        annual_flow = coupon_amount * payments_per_year * total_quantity
        annual_yield = (annual_flow / total_spent * 100).quantize(
            Decimal("0.0001"),
            rounding=ROUND_HALF_UP,
        )
        paid_total = sum(
            (
                coupon_amount * purchase.quantity * coupon_count
                for purchase, coupon_count in zip(purchases, coupon_counts, strict=True)
            ),
            start=Decimal("0.00"),
        )

    count = _period_count(
        placement_date=placement_date,
        maturity_date=maturity_date,
        payments_per_year=payments_per_year,
    )
    final_period = _period_at(
        placement_date=placement_date,
        maturity_date=maturity_date,
        payments_per_year=payments_per_year,
        coupon_period_days=coupon_period_days,
        index=count - 1,
        period_count=count,
    )
    final_payment_amount_is_positive = coupon_amount > 0 and any(
        purchase.quantity > 0 and purchase.purchase_date < final_period.end
        for purchase in purchases
    )
    if today < maturity_date:
        status: Literal["active", "payment_pending", "matured"] = "active"
    elif today < final_period.pay_date and final_payment_amount_is_positive:
        status = "payment_pending"
    else:
        status = "matured"

    next_period: CouponPeriod | None = None
    next_amount: Decimal | None = None
    next_index = _first_period_index(
        placement_date=placement_date,
        maturity_date=maturity_date,
        payments_per_year=payments_per_year,
        coupon_period_days=coupon_period_days,
        predicate="pay_after",
        bound=today,
    )
    while coupon_amount > 0 and next_index < count:
        candidate = _period_at(
            placement_date=placement_date,
            maturity_date=maturity_date,
            payments_per_year=payments_per_year,
            coupon_period_days=coupon_period_days,
            index=next_index,
            period_count=count,
        )
        eligible_quantity = sum(
            purchase.quantity for purchase in purchases if purchase.purchase_date < candidate.end
        )
        if eligible_quantity > 0:
            next_period = candidate
            with localcontext() as context:
                context.prec = precision
                next_amount = coupon_amount * eligible_quantity
            break
        next_index += 1

    years, months, days_until_maturity = _remaining_calendar_parts(today, maturity_date)
    if next_period is None:
        next_days = None
        next_period_days = None
        elapsed_period_days = None
    else:
        next_days = (next_period.pay_date - today).days
        next_period_days = (next_period.end - next_period.start).days
        elapsed_period_days = min(
            next_period_days,
            max(0, (min(today, next_period.end) - next_period.start).days),
        )

    return BondMetrics(
        status=status,
        total_quantity=total_quantity,
        total_spent=total_spent,
        paid_coupon_total=paid_total,
        annual_coupon_yield_percent=annual_yield,
        remaining_years=years,
        remaining_months=months,
        remaining_days_until=days_until_maturity,
        next_coupon_period_start=next_period.start if next_period else None,
        next_coupon_period_end=next_period.end if next_period else None,
        next_coupon_pay_date=next_period.pay_date if next_period else None,
        next_coupon_amount=next_amount,
        next_coupon_days_until=next_days,
        next_coupon_period_days=next_period_days,
        next_coupon_elapsed_period_days=elapsed_period_days,
    )

from datetime import date
from decimal import Decimal

from app.portfolio.calculations import (
    CouponPosition,
    OperationPosition,
    PurchasePosition,
    calculate_bond_metrics,
    calculate_coupon_schedule_events,
)


def coupon(
    *,
    coupon_date: date,
    amount: str,
    start: date,
    end: date,
    fix_date: date | None = None,
) -> CouponPosition:
    return CouponPosition(
        coupon_number=1,
        coupon_date=coupon_date,
        pay_one_bond_amount=Decimal(amount),
        coupon_start_date=start,
        coupon_end_date=end,
        coupon_period=(end - start).days,
        fix_date=fix_date,
    )


def test_metrics_use_stored_coupon_dates_and_fix_date_inclusive_entitlement() -> None:
    metrics = calculate_bond_metrics(
        maturity_date=date(2027, 12, 31),
        payments_per_year=2,
        purchases=(
            PurchasePosition(Decimal("1000.00"), 2, date(2026, 6, 30)),
            PurchasePosition(Decimal("1000.00"), 3, date(2026, 7, 1)),
        ),
        coupons=(
            coupon(
                coupon_date=date(2026, 7, 1),
                amount="10.00",
                start=date(2026, 1, 1),
                end=date(2026, 6, 30),
                fix_date=date(2026, 6, 30),
            ),
            coupon(
                coupon_date=date(2027, 1, 1),
                amount="12.50",
                start=date(2026, 7, 1),
                end=date(2026, 12, 31),
            ),
        ),
        today=date(2026, 7, 1),
    )

    assert metrics.paid_coupon_total == Decimal("20.00")
    assert len(metrics.coupon_payments) == 1
    assert metrics.coupon_payments[0].pay_date == date(2026, 7, 1)
    assert metrics.coupon_payments[0].amount_per_bond == Decimal("10.00")
    assert metrics.coupon_payments[0].quantity == 2
    assert metrics.coupon_payments[0].amount == Decimal("20.00")
    assert metrics.next_coupon_amount == Decimal("62.50")
    assert metrics.next_coupon_amount_per_bond == Decimal("12.50")
    assert metrics.next_coupon_pay_date == date(2027, 1, 1)
    assert metrics.calendar_year_coupon_yield_percent == Decimal("2.0000")
    assert metrics.coupon_yield_year == 2026


def test_metrics_accept_purchase_before_coupon_end_without_fix_date_and_mark_pending() -> None:
    metrics = calculate_bond_metrics(
        maturity_date=date(2026, 6, 30),
        payments_per_year=2,
        purchases=(PurchasePosition(Decimal("500.00"), 4, date(2026, 6, 29)),),
        coupons=(
            coupon(
                coupon_date=date(2026, 7, 5),
                amount="2.50",
                start=date(2026, 1, 1),
                end=date(2026, 6, 30),
            ),
        ),
        today=date(2026, 6, 30),
    )

    assert metrics.status == "payment_pending"
    assert metrics.next_coupon_amount == Decimal("10.00")


def test_empty_stored_schedule_has_zero_metrics_and_no_next_coupon() -> None:
    metrics = calculate_bond_metrics(
        maturity_date=date(2027, 1, 1),
        payments_per_year=2,
        purchases=(PurchasePosition(Decimal("100.00"), 1, date(2026, 1, 1)),),
        coupons=(),
        today=date(2026, 8, 11),
    )

    assert metrics.paid_coupon_total == Decimal("0.00")
    assert metrics.holding_period_coupon_income == Decimal("0.00")
    assert metrics.calendar_year_coupon_yield_percent == Decimal("0.0000")
    assert metrics.annual_coupon_yield_percent is None
    assert metrics.coupon_yield_year == 2026
    assert metrics.next_coupon_pay_date is None
    assert metrics.coupon_payments == ()


def test_holding_period_coupon_income_replays_entitlement_for_all_known_coupons() -> None:
    metrics = calculate_bond_metrics(
        maturity_date=date(2027, 1, 1),
        payments_per_year=4,
        operations=(
            OperationPosition("purchase", Decimal("1000.00"), 2, date(2026, 1, 1)),
            OperationPosition("purchase", Decimal("1500.00"), 3, date(2026, 1, 15)),
            OperationPosition("sale", Decimal("2600.00"), 5, date(2026, 2, 15)),
        ),
        coupons=(
            coupon(
                coupon_date=date(2025, 12, 31),
                amount="100.00",
                start=date(2025, 7, 1),
                end=date(2025, 12, 30),
            ),
            coupon(
                coupon_date=date(2026, 1, 10),
                amount="10.00",
                start=date(2026, 1, 1),
                end=date(2026, 1, 5),
                fix_date=date(2026, 1, 5),
            ),
            coupon(
                coupon_date=date(2026, 2, 10),
                amount="12.00",
                start=date(2026, 1, 6),
                end=date(2026, 2, 5),
                fix_date=date(2026, 2, 5),
            ),
            coupon(
                coupon_date=date(2026, 3, 10),
                amount="15.00",
                start=date(2026, 2, 6),
                end=date(2026, 3, 5),
                fix_date=date(2026, 3, 5),
            ),
        ),
        today=date(2026, 2, 20),
    )

    assert metrics.paid_coupon_total == Decimal("80.00")
    assert metrics.holding_period_coupon_income == Decimal("80.00")
    assert [payment.pay_date for payment in metrics.coupon_payments] == [
        date(2026, 2, 10),
        date(2026, 1, 10),
    ]
    assert [payment.quantity for payment in metrics.coupon_payments] == [5, 2]
    assert [payment.amount for payment in metrics.coupon_payments] == [
        Decimal("60.00"),
        Decimal("20.00"),
    ]


def test_full_coupon_schedule_replays_position_for_every_event() -> None:
    coupons = (
        coupon(
            coupon_date=date(2025, 12, 31),
            amount="10.00",
            start=date(2025, 7, 1),
            end=date(2025, 12, 30),
        ),
        coupon(
            coupon_date=date(2026, 6, 30),
            amount="12.00",
            start=date(2026, 1, 1),
            end=date(2026, 6, 29),
        ),
        coupon(
            coupon_date=date(2026, 12, 31),
            amount="0.00",
            start=date(2026, 7, 1),
            end=date(2026, 12, 30),
        ),
    )
    operations = (
        OperationPosition("purchase", Decimal("2000.00"), 2, date(2026, 1, 15)),
        OperationPosition("sale", Decimal("2100.00"), 2, date(2026, 7, 15)),
    )

    schedule = calculate_coupon_schedule_events(coupons, operations)

    assert [event.pay_date for event in schedule] == [
        date(2026, 12, 31),
        date(2026, 6, 30),
        date(2025, 12, 31),
    ]
    assert [event.quantity for event in schedule] == [0, 2, 0]
    assert [event.amount for event in schedule] == [
        Decimal("0.00"),
        Decimal("24.00"),
        Decimal("0.00"),
    ]


def test_only_positive_future_eligible_event_is_next_and_maturity_without_it_is_matured() -> None:
    metrics = calculate_bond_metrics(
        maturity_date=date(2026, 1, 10),
        payments_per_year=2,
        purchases=(PurchasePosition(Decimal("0.01"), 2_147_483_647, date(2025, 1, 1)),),
        coupons=(
            coupon(coupon_date=date(2026, 1, 11), amount="0.00", start=date(2025, 7, 1), end=date(2026, 1, 1)),
            coupon(coupon_date=date(2026, 1, 12), amount="0.000000001", start=date(2026, 1, 1), end=date(2026, 1, 10)),
        ),
        today=date(2026, 1, 10),
    )

    assert metrics.status == "payment_pending"
    assert metrics.next_coupon_pay_date == date(2026, 1, 12)
    assert metrics.next_coupon_amount == Decimal("2.147483647")
    assert metrics.remaining_days_until == 0


def test_purchase_on_coupon_end_is_not_eligible_without_fix_date() -> None:
    metrics = calculate_bond_metrics(
        maturity_date=date(2027, 1, 1),
        payments_per_year=2,
        purchases=(PurchasePosition(Decimal("100.00"), 1, date(2026, 6, 30)),),
        coupons=(coupon(coupon_date=date(2026, 7, 1), amount="10.00", start=date(2026, 1, 1), end=date(2026, 6, 30)),),
        today=date(2026, 7, 1),
    )

    assert metrics.paid_coupon_total == Decimal("0.00")


def test_calendar_year_yield_includes_past_and_future_entitled_coupons() -> None:
    metrics = calculate_bond_metrics(
        maturity_date=date(2026, 12, 31),
        payments_per_year=2,
        purchases=(
            PurchasePosition(Decimal("1000.00"), 2, date(2025, 12, 30)),
            PurchasePosition(Decimal("900.00"), 3, date(2026, 6, 1)),
        ),
        coupons=(
            coupon(
                coupon_date=date(2026, 1, 1),
                amount="10.00",
                start=date(2025, 7, 1),
                end=date(2025, 12, 31),
                fix_date=date(2025, 12, 31),
            ),
            coupon(
                coupon_date=date(2026, 7, 1),
                amount="10.00",
                start=date(2026, 1, 1),
                end=date(2026, 6, 30),
            ),
            coupon(
                coupon_date=date(2026, 12, 31),
                amount="10.00",
                start=date(2026, 7, 1),
                end=date(2026, 12, 30),
            ),
            coupon(
                coupon_date=date(2027, 1, 1),
                amount="100.00",
                start=date(2026, 7, 1),
                end=date(2026, 12, 31),
            ),
        ),
        today=date(2026, 8, 11),
    )

    assert metrics.calendar_year_coupon_yield_percent == Decimal("7.2632")
    assert metrics.coupon_yield_year == 2026


def test_calendar_year_coupon_income_includes_known_events_using_coupon_cutoff_position() -> None:
    metrics = calculate_bond_metrics(
        maturity_date=date(2027, 1, 1),
        payments_per_year=2,
        operations=(
            OperationPosition("purchase", Decimal("1000.00"), 5, date(2025, 12, 30)),
            OperationPosition("sale", Decimal("300.00"), 2, date(2026, 4, 15)),
        ),
        coupons=(
            coupon(
                coupon_date=date(2026, 3, 1),
                amount="10.00",
                start=date(2025, 9, 1),
                end=date(2026, 2, 28),
            ),
            coupon(
                coupon_date=date(2026, 9, 1),
                amount="12.00",
                start=date(2026, 3, 1),
                end=date(2026, 8, 31),
            ),
            coupon(
                coupon_date=date(2027, 3, 1),
                amount="100.00",
                start=date(2026, 9, 1),
                end=date(2027, 2, 28),
            ),
        ),
        today=date(2026, 6, 1),
    )

    assert metrics.calendar_year_coupon_income == Decimal("86.00")


def test_coupon_income_splits_current_year_paid_and_current_month_totals() -> None:
    metrics = calculate_bond_metrics(
        maturity_date=date(2027, 12, 31),
        payments_per_year=4,
        purchases=(PurchasePosition(Decimal("2000.00"), 2, date(2025, 1, 1)),),
        coupons=(
            coupon(
                coupon_date=date(2025, 12, 31),
                amount="100.00",
                start=date(2025, 9, 1),
                end=date(2025, 12, 30),
            ),
            coupon(
                coupon_date=date(2026, 5, 31),
                amount="10.00",
                start=date(2026, 2, 1),
                end=date(2026, 5, 30),
            ),
            coupon(
                coupon_date=date(2026, 8, 5),
                amount="20.00",
                start=date(2026, 5, 31),
                end=date(2026, 8, 4),
            ),
            coupon(
                coupon_date=date(2026, 8, 28),
                amount="30.00",
                start=date(2026, 8, 5),
                end=date(2026, 8, 27),
            ),
            coupon(
                coupon_date=date(2026, 9, 1),
                amount="40.00",
                start=date(2026, 8, 28),
                end=date(2026, 8, 31),
            ),
        ),
        today=date(2026, 8, 13),
    )

    assert metrics.paid_coupon_total == Decimal("260.00")
    assert metrics.calendar_year_paid_coupon_income == Decimal("60.00")
    assert metrics.calendar_year_coupon_income == Decimal("200.00")
    assert metrics.calendar_month_coupon_income == Decimal("100.00")


def test_annual_coupon_yield_matches_calculator_for_the_next_coupon() -> None:
    metrics = calculate_bond_metrics(
        maturity_date=date(2028, 6, 22),
        payments_per_year=12,
        purchases=(PurchasePosition(Decimal("199957.00"), 200, date(2026, 7, 10)),),
        coupons=(
            coupon(
                coupon_date=date(2026, 9, 1),
                amount="11.67",
                start=date(2026, 8, 1),
                end=date(2026, 8, 31),
            ),
        ),
        today=date(2026, 8, 12),
    )

    assert metrics.annual_coupon_yield_percent == Decimal("14.0070")


def test_annual_coupon_yield_rounds_exact_halfway_value_up() -> None:
    metrics = calculate_bond_metrics(
        maturity_date=date(2027, 1, 1),
        payments_per_year=1,
        purchases=(PurchasePosition(Decimal("2000000.00"), 1, date(2026, 1, 1)),),
        coupons=(
            coupon(
                coupon_date=date(2026, 9, 1),
                amount="1.00",
                start=date(2026, 1, 1),
                end=date(2026, 8, 31),
            ),
        ),
        today=date(2026, 8, 12),
    )

    assert metrics.annual_coupon_yield_percent == Decimal("0.0001")


def test_annual_coupon_yield_is_none_without_a_positive_payment_frequency() -> None:
    metrics = calculate_bond_metrics(
        maturity_date=date(2027, 1, 1),
        payments_per_year=0,
        purchases=(PurchasePosition(Decimal("100.00"), 1, date(2026, 1, 1)),),
        coupons=(
            coupon(
                coupon_date=date(2026, 9, 1),
                amount="10.00",
                start=date(2026, 1, 1),
                end=date(2026, 8, 31),
            ),
        ),
        today=date(2026, 8, 12),
    )

    assert metrics.annual_coupon_yield_percent is None


def test_annual_coupon_yield_is_none_without_an_eligible_positive_future_coupon() -> None:
    metrics = calculate_bond_metrics(
        maturity_date=date(2027, 1, 1),
        payments_per_year=2,
        purchases=(PurchasePosition(Decimal("100.00"), 1, date(2026, 1, 1)),),
        coupons=(
            coupon(
                coupon_date=date(2026, 9, 1),
                amount="0.00",
                start=date(2026, 1, 1),
                end=date(2026, 8, 31),
            ),
        ),
        today=date(2026, 8, 12),
    )

    assert metrics.annual_coupon_yield_percent is None


def test_annual_coupon_yield_is_none_after_the_position_is_fully_sold() -> None:
    metrics = calculate_bond_metrics(
        maturity_date=date(2027, 1, 1),
        payments_per_year=2,
        operations=(
            OperationPosition("purchase", Decimal("100.00"), 1, date(2026, 1, 1)),
            OperationPosition("sale", Decimal("100.00"), 1, date(2026, 8, 1)),
        ),
        coupons=(
            coupon(
                coupon_date=date(2026, 9, 1),
                amount="10.00",
                start=date(2026, 1, 1),
                end=date(2026, 8, 31),
            ),
        ),
        today=date(2026, 8, 12),
    )

    assert metrics.annual_coupon_yield_percent is None


def test_annual_coupon_yield_uses_current_quantity_and_remaining_cost_basis_after_sale() -> None:
    metrics = calculate_bond_metrics(
        maturity_date=date(2027, 1, 1),
        payments_per_year=2,
        operations=(
            OperationPosition("purchase", Decimal("1000.00"), 10, date(2026, 1, 1)),
            OperationPosition("sale", Decimal("600.00"), 5, date(2026, 8, 1)),
        ),
        coupons=(
            coupon(
                coupon_date=date(2026, 9, 1),
                amount="10.00",
                start=date(2026, 1, 1),
                end=date(2026, 8, 31),
            ),
        ),
        today=date(2026, 8, 12),
    )

    assert metrics.total_quantity == 5
    assert metrics.position_cost_basis == Decimal("500.00")
    assert metrics.annual_coupon_yield_percent == Decimal("20.0000")

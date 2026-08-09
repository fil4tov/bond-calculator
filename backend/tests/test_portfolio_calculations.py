from datetime import date
from decimal import Decimal

import pytest

import app.portfolio.calculations as calculations
from app.portfolio.calculations import (
    PurchasePosition,
    _period_at,
    _period_count,
    calculate_bond_metrics,
    coupon_dates_between,
    infer_coupon_period_days,
)


@pytest.mark.parametrize(
    ("frequency", "expected_days"),
    [(1, 365), (2, 182), (3, 122), (4, 91), (6, 61), (12, 30)],
)
def test_coupon_period_days_are_inferred_from_frequency(
    frequency: int, expected_days: int
) -> None:
    assert infer_coupon_period_days(frequency) == expected_days


@pytest.mark.parametrize(
    ("placement", "maturity", "payments_per_year", "coupon_period_days", "expected"),
    [
        (
            date(2025, 4, 22),
            date(2028, 4, 6),
            12,
            30,
            (date(2025, 4, 22), date(2025, 5, 22), date(2025, 6, 21)),
        ),
        (
            date(2025, 9, 12),
            date(2028, 8, 27),
            12,
            30,
            (date(2025, 9, 12), date(2025, 10, 12), date(2025, 11, 11)),
        ),
        (
            date(2026, 7, 3),
            date(2029, 6, 17),
            12,
            30,
            (date(2026, 7, 3), date(2026, 8, 2), date(2026, 9, 1)),
        ),
        (
            date(2024, 5, 15),
            date(2040, 5, 16),
            2,
            182,
            (date(2024, 5, 15), date(2024, 12, 4), date(2025, 6, 4)),
        ),
    ],
)
def test_supplied_moex_schedules_have_exact_fixed_day_boundaries(
    placement: date,
    maturity: date,
    payments_per_year: int,
    coupon_period_days: int,
    expected: tuple[date, date, date],
) -> None:
    count = _period_count(
        placement_date=placement,
        maturity_date=maturity,
        payments_per_year=payments_per_year,
    )
    first = _period_at(
        placement_date=placement,
        maturity_date=maturity,
        payments_per_year=payments_per_year,
        coupon_period_days=coupon_period_days,
        index=0,
        period_count=count,
    )
    second = _period_at(
        placement_date=placement,
        maturity_date=maturity,
        payments_per_year=payments_per_year,
        coupon_period_days=coupon_period_days,
        index=1,
        period_count=count,
    )

    assert (first.start, first.end, second.end) == expected


def test_coupon_schedule_uses_fixed_day_intervals() -> None:
    assert coupon_dates_between(
        placement_date=date(2026, 8, 31),
        maturity_date=date(2027, 8, 31),
        payments_per_year=2,
        coupon_period_days=182,
        after=date(2026, 8, 31),
        through=date(2027, 8, 31),
    ) == (date(2027, 3, 2), date(2027, 8, 31))


def test_coupon_dates_between_searches_then_visits_only_the_requested_range(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    original_period_at = calculations._period_at
    period_at_calls = 0

    def counting_period_at(**kwargs: object) -> calculations.CouponPeriod:
        nonlocal period_at_calls
        period_at_calls += 1
        return original_period_at(**kwargs)  # type: ignore[arg-type]

    monkeypatch.setattr(calculations, "_period_at", counting_period_at)

    dates = coupon_dates_between(
        placement_date=date(2025, 9, 12),
        maturity_date=date(2028, 8, 27),
        payments_per_year=12,
        coupon_period_days=30,
        after=date(2025, 10, 13),
        through=date(2025, 12, 11),
    )

    assert dates == (date(2025, 11, 11), date(2025, 12, 11))
    assert period_at_calls <= 12


def test_paid_coupons_use_actual_payment_date() -> None:
    metrics = calculate_bond_metrics(
        coupon_amount=Decimal("10.00"),
        nominal=Decimal("1000.00"),
        payments_per_year=2,
        coupon_period_days=infer_coupon_period_days(2),
        placement_date=date(2026, 6, 30),
        maturity_date=date(2027, 6, 30),
        purchases=(PurchasePosition(Decimal("1000.00"), 2, date(2026, 6, 30)),),
        today=date(2026, 12, 30),
    )

    assert metrics.paid_coupon_total == Decimal("20.00")
    assert metrics.next_coupon_pay_date == date(2027, 6, 30)
    assert metrics.next_coupon_amount == Decimal("20.00")


def test_multiple_purchases_keep_exact_kopecks_and_period_entitlement() -> None:
    metrics = calculate_bond_metrics(
        coupon_amount=Decimal("35.40"),
        nominal=Decimal("1000.00"),
        payments_per_year=2,
        coupon_period_days=infer_coupon_period_days(2),
        placement_date=date(2025, 5, 15),
        maturity_date=date(2028, 5, 15),
        purchases=(
            PurchasePosition(Decimal("50000.35"), 50, date(2025, 6, 1)),
            PurchasePosition(Decimal("25000.35"), 25, date(2026, 6, 1)),
        ),
        today=date(2026, 8, 9),
    )

    assert metrics.total_quantity == 75
    assert metrics.total_spent == Decimal("75000.70")
    assert metrics.paid_coupon_total == Decimal("3540.00")
    assert metrics.annual_coupon_yield_percent == Decimal("7.0799")
    assert metrics.next_coupon_period_end == date(2026, 11, 16)
    assert metrics.next_coupon_pay_date == date(2026, 11, 16)
    assert metrics.next_coupon_amount == Decimal("2655.00")
    assert metrics.next_coupon_days_until == 99
    assert metrics.next_coupon_period_days == 182


def test_matured_bond_has_zero_remaining_time_and_no_next_coupon() -> None:
    metrics = calculate_bond_metrics(
        coupon_amount=Decimal("12.50"),
        nominal=Decimal("1000.00"),
        payments_per_year=4,
        coupon_period_days=infer_coupon_period_days(4),
        placement_date=date(2025, 8, 8),
        maturity_date=date(2026, 8, 7),
        purchases=(PurchasePosition(Decimal("950.00"), 1, date(2025, 8, 8)),),
        today=date(2026, 8, 9),
    )

    assert metrics.status == "matured"
    assert metrics.remaining_years == 0
    assert metrics.remaining_months == 0
    assert metrics.remaining_days_until == 0
    assert metrics.next_coupon_pay_date is None
    assert metrics.next_coupon_amount is None


def test_coupon_period_reports_elapsed_days_in_a_long_first_period() -> None:
    metrics = calculate_bond_metrics(
        coupon_amount=Decimal("10.00"),
        nominal=Decimal("1000.00"),
        payments_per_year=12,
        coupon_period_days=infer_coupon_period_days(12),
        placement_date=date(2026, 4, 15),
        maturity_date=date(2027, 5, 15),
        purchases=(PurchasePosition(Decimal("1000.00"), 1, date(2026, 4, 15)),),
        today=date(2026, 4, 30),
    )

    assert metrics.next_coupon_period_end == date(2026, 5, 20)
    assert metrics.next_coupon_elapsed_period_days == 15
    assert metrics.next_coupon_period_days == 35


def test_unpaid_long_first_period_keeps_its_elapsed_progress() -> None:
    metrics = calculate_bond_metrics(
        coupon_amount=Decimal("10.00"),
        nominal=Decimal("1000.00"),
        payments_per_year=12,
        coupon_period_days=infer_coupon_period_days(12),
        placement_date=date(2026, 7, 2),
        maturity_date=date(2027, 7, 2),
        purchases=(PurchasePosition(Decimal("1000.00"), 1, date(2026, 7, 2)),),
        today=date(2026, 8, 3),
    )

    assert metrics.paid_coupon_total == Decimal("0.00")
    assert metrics.next_coupon_period_start == date(2026, 7, 2)
    assert metrics.next_coupon_period_end == date(2026, 8, 6)
    assert metrics.next_coupon_elapsed_period_days == 32


@pytest.mark.parametrize(
    ("placement", "today", "period_end", "period_days"),
    [
        (date(2027, 1, 31), date(2027, 2, 27), date(2027, 3, 10), 38),
        (date(2027, 1, 31), date(2027, 3, 1), date(2027, 3, 10), 38),
        (date(2028, 1, 31), date(2028, 2, 28), date(2028, 3, 4), 33),
        (date(2028, 1, 31), date(2028, 3, 1), date(2028, 3, 4), 33),
    ],
)
def test_coupon_period_uses_fixed_days_across_february(
    placement: date,
    today: date,
    period_end: date,
    period_days: int,
) -> None:
    metrics = calculate_bond_metrics(
        coupon_amount=Decimal("10.00"),
        nominal=Decimal("1000.00"),
        payments_per_year=12,
        coupon_period_days=infer_coupon_period_days(12),
        placement_date=placement,
        maturity_date=date(2028, 8, 31),
        purchases=(PurchasePosition(Decimal("1000.00"), 1, placement),),
        today=today,
    )

    assert metrics.next_coupon_period_end == period_end
    assert metrics.next_coupon_period_days == period_days


def test_schedule_has_a_long_first_period_and_full_final_period() -> None:
    metrics = calculate_bond_metrics(
        coupon_amount=Decimal("10.00"),
        nominal=Decimal("1000.00"),
        payments_per_year=12,
        coupon_period_days=infer_coupon_period_days(12),
        placement_date=date(2026, 7, 31),
        maturity_date=date(2026, 10, 15),
        purchases=(PurchasePosition(Decimal("1000.00"), 2, date(2026, 7, 31)),),
        today=date(2026, 9, 30),
    )

    assert metrics.next_coupon_period_start == date(2026, 9, 15)
    assert metrics.next_coupon_period_end == date(2026, 10, 15)
    assert metrics.next_coupon_pay_date == date(2026, 10, 15)
    assert metrics.next_coupon_period_days == 30
    assert metrics.next_coupon_elapsed_period_days == 15


def test_shifted_pay_date_does_not_change_period_progress_or_entitlement() -> None:
    metrics = calculate_bond_metrics(
        coupon_amount=Decimal("11.67"),
        nominal=Decimal("1000.00"),
        payments_per_year=12,
        coupon_period_days=infer_coupon_period_days(12),
        placement_date=date(2026, 7, 2),
        maturity_date=date(2027, 6, 28),
        purchases=(
            PurchasePosition(Decimal("1000.00"), 2, date(2026, 7, 2)),
            PurchasePosition(Decimal("500.00"), 1, date(2026, 8, 2)),
        ),
        today=date(2026, 8, 2),
    )

    assert metrics.next_coupon_period_start == date(2026, 7, 2)
    assert metrics.next_coupon_period_end == date(2026, 8, 2)
    assert metrics.next_coupon_pay_date == date(2026, 8, 3)
    assert metrics.next_coupon_period_days == 31
    assert metrics.next_coupon_elapsed_period_days == 31
    assert metrics.next_coupon_days_until == 1
    assert metrics.next_coupon_amount == Decimal("23.34")
    assert metrics.paid_coupon_total == Decimal("0.00")


def test_final_coupon_uses_payment_pending_status_until_shifted_payment() -> None:
    before_payment = calculate_bond_metrics(
        coupon_amount=Decimal("10.00"),
        nominal=Decimal("1000.00"),
        payments_per_year=12,
        coupon_period_days=infer_coupon_period_days(12),
        placement_date=date(2026, 7, 2),
        maturity_date=date(2026, 8, 2),
        purchases=(PurchasePosition(Decimal("1000.00"), 1, date(2026, 7, 2)),),
        today=date(2026, 8, 2),
    )
    on_payment = calculate_bond_metrics(
        coupon_amount=Decimal("10.00"),
        nominal=Decimal("1000.00"),
        payments_per_year=12,
        coupon_period_days=infer_coupon_period_days(12),
        placement_date=date(2026, 7, 2),
        maturity_date=date(2026, 8, 2),
        purchases=(PurchasePosition(Decimal("1000.00"), 1, date(2026, 7, 2)),),
        today=date(2026, 8, 3),
    )

    assert before_payment.status == "payment_pending"
    assert before_payment.next_coupon_pay_date == date(2026, 8, 3)
    assert on_payment.status == "matured"
    assert on_payment.next_coupon_pay_date is None
    assert on_payment.paid_coupon_total == Decimal("10.00")


def test_zero_coupon_has_no_payment_and_does_not_enter_payment_pending() -> None:
    purchases = (
        PurchasePosition(Decimal("1000.00"), 1, date(2026, 7, 2)),
    )

    active = calculate_bond_metrics(
        coupon_amount=Decimal("0.00"),
        nominal=Decimal("1000.00"),
        payments_per_year=12,
        coupon_period_days=infer_coupon_period_days(12),
        placement_date=date(2026, 7, 2),
        maturity_date=date(2026, 8, 2),
        purchases=purchases,
        today=date(2026, 8, 1),
    )
    on_maturity = calculate_bond_metrics(
        coupon_amount=Decimal("0.00"),
        nominal=Decimal("1000.00"),
        payments_per_year=12,
        coupon_period_days=infer_coupon_period_days(12),
        placement_date=date(2026, 7, 2),
        maturity_date=date(2026, 8, 2),
        purchases=purchases,
        today=date(2026, 8, 2),
    )

    assert active.status == "active"
    assert active.next_coupon_pay_date is None
    assert on_maturity.status == "matured"
    assert on_maturity.next_coupon_pay_date is None


def test_remaining_time_counts_clamped_months_and_leap_years() -> None:
    month_end = calculate_bond_metrics(
        coupon_amount=Decimal("10.00"),
        nominal=Decimal("1000.00"),
        payments_per_year=1,
        coupon_period_days=infer_coupon_period_days(1),
        placement_date=date(2026, 1, 30),
        maturity_date=date(2026, 2, 28),
        purchases=(PurchasePosition(Decimal("1000.00"), 1, date(2026, 1, 30)),),
        today=date(2026, 1, 31),
    )
    leap = calculate_bond_metrics(
        coupon_amount=Decimal("10.00"),
        nominal=Decimal("1000.00"),
        payments_per_year=1,
        coupon_period_days=infer_coupon_period_days(1),
        placement_date=date(2024, 2, 28),
        maturity_date=date(2025, 2, 28),
        purchases=(PurchasePosition(Decimal("1000.00"), 1, date(2024, 2, 28)),),
        today=date(2024, 2, 29),
    )

    assert (month_end.remaining_years, month_end.remaining_months) == (0, 1)
    assert month_end.remaining_days_until == 28
    assert (leap.remaining_years, leap.remaining_months) == (1, 0)
    assert leap.remaining_days_until == 365


def test_aggregate_metrics_do_not_materialize_the_coupon_schedule(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def fail_if_materialized(**_kwargs: object) -> tuple[date, ...]:
        raise AssertionError("production aggregate calculation materialized a coupon schedule")

    monkeypatch.setattr(calculations, "coupon_dates_between", fail_if_materialized)

    metrics = calculate_bond_metrics(
        coupon_amount=Decimal("1.00"),
        nominal=Decimal("1000.00"),
        payments_per_year=12,
        coupon_period_days=infer_coupon_period_days(12),
        placement_date=date.min,
        maturity_date=date.max,
        purchases=(
            PurchasePosition(Decimal("1000.00"), 2, date.min),
            PurchasePosition(Decimal("2000.00"), 3, date.min),
        ),
        today=date(2026, 8, 9),
    )

    assert metrics.total_quantity == 5
    assert metrics.next_coupon_period_start < metrics.next_coupon_period_end
    assert metrics.next_coupon_pay_date > date(2026, 8, 9)

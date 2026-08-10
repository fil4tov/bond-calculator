from datetime import date

from app.portfolio.business_calendar import is_business_day, next_business_day


def test_weekend_and_federal_holiday_move_payment_to_next_business_day() -> None:
    assert next_business_day(date(2026, 8, 2)) == date(2026, 8, 3)
    assert next_business_day(date(2028, 2, 23)) == date(2028, 2, 24)


def test_known_calendar_overrides_include_extra_day_off_and_working_saturday() -> None:
    assert is_business_day(date(2026, 1, 9)) is False
    assert next_business_day(date(2026, 1, 9)) == date(2026, 1, 12)
    assert is_business_day(date(2025, 11, 1)) is True

from datetime import UTC, date, datetime
from importlib import import_module

import pytest


def test_portfolio_clock_reads_the_utc_calendar_date(monkeypatch: pytest.MonkeyPatch) -> None:
    clock = import_module("app.portfolio.clock")
    observed_timezones: list[object] = []

    class FixedDateTime:
        @classmethod
        def now(cls, timezone: object) -> datetime:
            observed_timezones.append(timezone)
            return datetime(2031, 2, 3, 0, 30, tzinfo=UTC)

    monkeypatch.setattr(clock, "datetime", FixedDateTime)

    assert clock.utc_today() == date(2031, 2, 3)
    assert observed_timezones == [UTC]

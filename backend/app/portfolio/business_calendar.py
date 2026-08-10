from datetime import date, timedelta


_FEDERAL_HOLIDAYS = {
    (1, 1),
    (1, 2),
    (1, 3),
    (1, 4),
    (1, 5),
    (1, 6),
    (1, 7),
    (1, 8),
    (2, 23),
    (3, 8),
    (5, 1),
    (5, 9),
    (6, 12),
    (11, 4),
}

# Official production-calendar overrides published for the years the project
# currently knows. Future years use the statutory fallback below until their
# government calendar is published and added here.
_EXTRA_DAYS_OFF = {
    date(2025, 5, 2),
    date(2025, 5, 8),
    date(2025, 6, 13),
    date(2025, 11, 3),
    date(2025, 12, 31),
    date(2026, 1, 9),
    date(2026, 3, 9),
    date(2026, 5, 11),
    date(2026, 12, 31),
}
_EXTRA_WORKING_DAYS = {date(2025, 11, 1)}
_KNOWN_CALENDAR_YEARS = {2025, 2026}


def _fallback_observed_days(year: int) -> set[date]:
    observed: set[date] = set()
    occupied = {date(year, month, day) for month, day in _FEDERAL_HOLIDAYS}
    for holiday in sorted(occupied):
        if holiday.weekday() < 5:
            continue
        candidate = holiday + timedelta(days=1)
        while candidate.weekday() >= 5 or candidate in occupied or candidate in observed:
            candidate += timedelta(days=1)
        observed.add(candidate)
    return observed


def is_business_day(value: date) -> bool:
    if value in _EXTRA_WORKING_DAYS:
        return True
    if value in _EXTRA_DAYS_OFF:
        return False
    if (value.month, value.day) in _FEDERAL_HOLIDAYS:
        return False
    if value.year not in _KNOWN_CALENDAR_YEARS and value in _fallback_observed_days(value.year):
        return False
    return value.weekday() < 5


def next_business_day(value: date) -> date:
    candidate = value
    while not is_business_day(candidate):
        if candidate == date.max:
            return candidate
        candidate += timedelta(days=1)
    return candidate

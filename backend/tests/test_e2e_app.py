from datetime import date
from decimal import Decimal

import pytest

from app.main import app as production_app
from app.portfolio.router import get_t_invest_gateway


@pytest.mark.asyncio
async def test_e2e_app_overrides_gateway_with_deterministic_schedule() -> None:
    original_overrides = production_app.dependency_overrides.copy()
    try:
        from tests.e2e_app import create_e2e_app

        e2e_app = create_e2e_app()
        gateway_factory = e2e_app.dependency_overrides[get_t_invest_gateway]
        gateway = gateway_factory()

        bond = await gateway.lookup_bond(" su26238 ")
        schedule = await gateway.get_coupon_schedule(
            "e2e-instrument-1",
            date(2026, 1, 1),
            date(2027, 1, 1),
        )

        assert bond is not None
        assert bond.instrument_uid == "e2e-instrument-1"
        assert bond.nominal == Decimal("1000.00")
        assert len(schedule) == 1
        assert schedule[0].coupon_date == date(2027, 1, 1)
    finally:
        production_app.dependency_overrides.clear()
        production_app.dependency_overrides.update(original_overrides)

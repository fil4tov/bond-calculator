"""ASGI entrypoint used only by the Docker E2E target."""
from datetime import date
from decimal import Decimal

from app.main import app
from app.portfolio.router import get_t_invest_gateway
from app.portfolio.t_invest_gateway import TInvestBond, TInvestCoupon


class E2ETInvestGateway:
    async def lookup_bond(self, ticker: str) -> TInvestBond | None:
        normalized = ticker.strip().upper()
        if not normalized:
            return None
        return TInvestBond(
            ticker=normalized,
            instrument_uid="e2e-instrument-1",
            name=f"E2E {normalized}",
            nominal=Decimal("1000.00"),
            payments_per_year=2,
            placement_date=date(2020, 1, 1),
            maturity_date=date(2041, 5, 15),
        )

    async def get_coupon_schedule(
        self, _uid: str, from_date: date, to_date: date
    ) -> tuple[TInvestCoupon, ...]:
        return (
            TInvestCoupon(
                figi="E2EFIGI",
                coupon_date=to_date,
                coupon_number=1,
                fix_date=None,
                pay_one_bond_amount=Decimal("35.400000000"),
                pay_one_bond_currency="RUB",
                coupon_type=1,
                coupon_start_date=from_date,
                coupon_end_date=to_date,
                coupon_period=(to_date - from_date).days,
            ),
        )


def create_e2e_app():
    app.dependency_overrides[get_t_invest_gateway] = E2ETInvestGateway
    return app


app = create_e2e_app()

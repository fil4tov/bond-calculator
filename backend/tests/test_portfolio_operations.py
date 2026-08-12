from datetime import date, timedelta
from decimal import Decimal

import pytest
from httpx import AsyncClient

from app.main import app
from app.portfolio import clock
from app.portfolio.calculations import CouponPosition, OperationPosition, calculate_bond_metrics
from app.portfolio.router import get_t_invest_gateway
from app.portfolio.t_invest_gateway import TInvestCoupon


class ScheduleGateway:
    async def get_coupon_schedule(
        self, _uid: str, from_date: date, to_date: date
    ) -> tuple[TInvestCoupon, ...]:
        return (
            TInvestCoupon(
                figi="FIGI",
                coupon_date=to_date,
                coupon_number=1,
                fix_date=None,
                pay_one_bond_amount=Decimal("10.000000000"),
                pay_one_bond_currency="RUB",
                coupon_type=1,
                coupon_start_date=from_date,
                coupon_end_date=to_date,
                coupon_period=(to_date - from_date).days,
            ),
        )


@pytest.fixture(autouse=True)
def fake_t_invest() -> None:
    app.dependency_overrides[get_t_invest_gateway] = lambda: ScheduleGateway()
    yield
    app.dependency_overrides.pop(get_t_invest_gateway, None)


async def register(client: AsyncClient) -> None:
    response = await client.post(
        "/api/auth/register", json={"username": "OperationsOwner", "password": "password123"}
    )
    assert response.status_code == 201


def create_payload() -> dict[str, object]:
    today = clock.utc_today()
    return {
        "instrument_uid": "operations-uid",
        "ticker": "OPS",
        "name": "Operations bond",
        "nominal": "1000.00",
        "payments_per_year": 2,
        "placement_date": (today - timedelta(days=365)).isoformat(),
        "maturity_date": (today + timedelta(days=365)).isoformat(),
        "amount_spent": "1000.00",
        "quantity": 10,
        "purchase_date": (today - timedelta(days=3)).isoformat(),
    }


def test_replay_uses_weighted_average_cost_and_coupon_cutoff_position() -> None:
    today = date(2026, 8, 11)
    metrics = calculate_bond_metrics(
        maturity_date=date(2027, 1, 1),
        payments_per_year=2,
        operations=(
            OperationPosition("purchase", Decimal("1000.00"), 10, date(2026, 1, 1)),
            OperationPosition("purchase", Decimal("2000.00"), 10, date(2026, 1, 2)),
            OperationPosition("sale", Decimal("1000.00"), 5, date(2026, 1, 4)),
        ),
        coupons=(
            CouponPosition(
                coupon_number=1,
                coupon_date=date(2026, 1, 6),
                pay_one_bond_amount=Decimal("10.00"),
                coupon_start_date=date(2025, 7, 1),
                coupon_end_date=date(2026, 1, 3),
                coupon_period=186,
                fix_date=None,
            ),
        ),
        today=today,
    )

    assert metrics.total_quantity == 15
    assert metrics.position_cost_basis == Decimal("2250.00")
    assert metrics.realized_result == Decimal("250.00")
    assert metrics.position_status == "open"
    assert metrics.paid_coupon_total == Decimal("200.00")


def test_calendar_year_yield_sums_event_yields_at_historical_cost_basis_cutoffs() -> None:
    metrics = calculate_bond_metrics(
        maturity_date=date(2027, 1, 1),
        payments_per_year=2,
        operations=(
            OperationPosition("purchase", Decimal("1000.00"), 10, date(2026, 1, 1)),
            OperationPosition("purchase", Decimal("1000.00"), 10, date(2026, 1, 6)),
            OperationPosition("sale", Decimal("2000.00"), 20, date(2026, 1, 11)),
        ),
        coupons=(
            CouponPosition(
                coupon_number=1,
                coupon_date=date(2026, 1, 7),
                pay_one_bond_amount=Decimal("10.00"),
                coupon_start_date=date(2025, 7, 1),
                coupon_end_date=date(2026, 1, 5),
                coupon_period=188,
                fix_date=date(2026, 1, 5),
            ),
            CouponPosition(
                coupon_number=2,
                coupon_date=date(2026, 1, 12),
                pay_one_bond_amount=Decimal("10.00"),
                coupon_start_date=date(2026, 1, 6),
                coupon_end_date=date(2026, 1, 10),
                coupon_period=4,
                fix_date=date(2026, 1, 10),
            ),
        ),
        today=date(2026, 1, 20),
    )

    assert metrics.position_cost_basis == Decimal("0.00")
    assert metrics.paid_coupon_total == Decimal("300.00")
    assert metrics.calendar_year_coupon_yield_percent == Decimal("20.0000")
    assert metrics.annual_coupon_yield_percent is None


@pytest.mark.asyncio
async def test_sale_and_operation_delete_return_replayed_card(client: AsyncClient) -> None:
    await register(client)
    created = await client.post("/api/portfolio/bonds", json=create_payload())
    assert created.status_code == 201
    bond_id = created.json()["id"]

    sold = await client.post(
        f"/api/portfolio/bonds/{bond_id}/sales",
        json={
            "amount_received": "600.00",
            "quantity": 5,
            "sale_date": (clock.utc_today() - timedelta(days=1)).isoformat(),
        },
    )

    assert sold.status_code == 201
    card = sold.json()
    assert card["total_quantity"] == 5
    assert card["position_cost_basis"] == "500.00"
    assert card["realized_result"] == "100.00"
    assert card["position_status"] == "open"
    assert card["annual_coupon_yield_percent"] == "20.0000"
    assert [(item["operation_type"], item["amount"]) for item in card["operations"]] == [
        ("sale", "600.00"),
        ("purchase", "1000.00"),
    ]
    assert [
        (item["operation_type"], item["realized_result"]) for item in card["operations"]
    ] == [("sale", "100.00"), ("purchase", None)]

    deleted = await client.delete(f"/api/portfolio/bonds/{bond_id}/operations/{card['operations'][0]['id']}")

    assert deleted.status_code == 200
    deleted_card = deleted.json()["item"]
    assert deleted_card["total_quantity"] == 10
    assert deleted_card["realized_result"] == "0.00"
    assert deleted_card["annual_coupon_yield_percent"] == "20.0000"


@pytest.mark.asyncio
async def test_sale_rejects_quantity_above_replayed_open_position(client: AsyncClient) -> None:
    await register(client)
    created = await client.post("/api/portfolio/bonds", json=create_payload())

    rejected = await client.post(
        f"/api/portfolio/bonds/{created.json()['id']}/sales",
        json={
            "amount_received": "1200.00",
            "quantity": 11,
            "sale_date": (clock.utc_today() - timedelta(days=1)).isoformat(),
        },
    )

    assert rejected.status_code == 422
    assert rejected.json()["field_errors"] == {
        "quantity": "Sale quantity must not exceed the open position at the sale date"
    }


@pytest.mark.asyncio
async def test_sale_rejects_backdated_operation_that_oversells_at_its_own_cutoff(
    client: AsyncClient,
) -> None:
    await register(client)
    created = await client.post("/api/portfolio/bonds", json=create_payload())

    rejected = await client.post(
        f"/api/portfolio/bonds/{created.json()['id']}/sales",
        json={
            "amount_received": "100.00",
            "quantity": 1,
            "sale_date": (clock.utc_today() - timedelta(days=4)).isoformat(),
        },
    )

    assert rejected.status_code == 422
    assert rejected.json()["field_errors"] == {
        "quantity": "Sale quantity must not exceed the open position at the sale date"
    }


@pytest.mark.asyncio
async def test_operation_delete_is_blocked_when_it_would_oversell_a_later_sale(
    client: AsyncClient,
) -> None:
    await register(client)
    created = await client.post("/api/portfolio/bonds", json=create_payload())
    bond_id = created.json()["id"]
    sold = await client.post(
        f"/api/portfolio/bonds/{bond_id}/sales",
        json={
            "amount_received": "600.00",
            "quantity": 5,
            "sale_date": (clock.utc_today() - timedelta(days=1)).isoformat(),
        },
    )
    purchase_id = next(
        item["id"] for item in sold.json()["operations"] if item["operation_type"] == "purchase"
    )

    rejected = await client.delete(f"/api/portfolio/bonds/{bond_id}/operations/{purchase_id}")

    assert rejected.status_code == 422
    assert rejected.json()["code"] == "operation_delete_blocked"

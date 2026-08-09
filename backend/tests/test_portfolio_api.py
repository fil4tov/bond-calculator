from datetime import date, timedelta
from decimal import Decimal
from uuid import UUID

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.portfolio import clock
from app.portfolio.models import Bond, BondPurchase


async def register(client: AsyncClient, username: str) -> None:
    response = await client.post(
        "/api/auth/register",
        json={"username": username, "password": "password123"},
    )
    assert response.status_code == 201


def valid_bond_payload(name: str = "ОФЗ 26238") -> dict[str, object]:
    today = clock.utc_today()
    return {
        "name": name,
        "coupon_amount": "35.40",
        "nominal": "1000.00",
        "payments_per_year": 2,
        "placement_date": (today - timedelta(days=365)).isoformat(),
        "maturity_date": (today.replace(year=today.year + 2)).isoformat(),
        "amount_spent": "50000.35",
        "quantity": 50,
        "purchase_date": (today - timedelta(days=1)).isoformat(),
    }


@pytest.mark.asyncio
async def test_portfolio_requires_authentication_and_clears_invalid_cookie(
    client: AsyncClient,
) -> None:
    client.cookies.set("bonds_session", "not-a-session", path="/api")

    response = await client.get("/api/portfolio/bonds")

    assert response.status_code == 401
    assert response.json() == {
        "code": "unauthenticated",
        "message": "Authentication required",
    }
    assert response.headers["cache-control"] == "no-store"
    assert "max-age=0" in response.headers["set-cookie"].lower()


@pytest.mark.asyncio
async def test_create_and_add_purchase_return_exact_aggregate_card(client: AsyncClient) -> None:
    await register(client, "PortfolioOwner")

    created = await client.post("/api/portfolio/bonds", json=valid_bond_payload("  ОФЗ 26238  "))

    assert created.status_code == 201
    assert created.headers["cache-control"] == "no-store"
    card = created.json()
    assert card["name"] == "ОФЗ 26238"
    assert card["coupon_amount"] == "35.40"
    assert card["nominal"] == "1000.00"
    assert card["coupon_period_days"] == 182
    assert card["total_quantity"] == 50
    assert card["total_spent"] == "50000.35"
    assert card["paid_coupon_total"].endswith(".00")
    assert len(card["annual_coupon_yield_percent"].split(".")[1]) == 4
    assert card["status"] == "active"
    assert set(card["maturity_remaining"]) == {"years", "months", "days_until"}
    assert card["placement_date"] == valid_bond_payload()["placement_date"]
    assert set(card["next_coupon"]) == {
        "period_start",
        "period_end",
        "pay_date",
        "amount",
        "days_until",
        "period_days",
        "elapsed_period_days",
    }
    assert card["next_coupon"]["period_days"] > 0

    added = await client.post(
        f"/api/portfolio/bonds/{card['id']}/purchases",
        json={
            "amount_spent": "25000.35",
            "quantity": 25,
            "purchase_date": (clock.utc_today() - timedelta(days=1)).isoformat(),
        },
    )

    assert added.status_code == 201
    assert added.headers["cache-control"] == "no-store"
    updated = added.json()
    assert updated["total_quantity"] == 75
    assert updated["total_spent"] == "75000.70"
    assert updated["annual_coupon_yield_percent"] == "7.0799"
    assert Decimal(updated["next_coupon"]["amount"]) == Decimal("2655.00")
    assert updated["next_coupon"]["period_days"] > 0

    listed = await client.get("/api/portfolio/bonds")
    assert listed.status_code == 200
    assert listed.headers["cache-control"] == "no-store"
    assert listed.json() == {"items": [updated]}


@pytest.mark.asyncio
async def test_create_infers_or_accepts_coupon_period_days(client: AsyncClient) -> None:
    await register(client, "CouponPeriodOwner")

    inferred = await client.post(
        "/api/portfolio/bonds", json=valid_bond_payload("Inferred period")
    )
    explicit_payload = valid_bond_payload("Explicit period")
    explicit_payload["coupon_period_days"] = 183
    explicit = await client.post("/api/portfolio/bonds", json=explicit_payload)

    assert inferred.status_code == 201
    assert inferred.json()["coupon_period_days"] == 182
    assert explicit.status_code == 201
    assert explicit.json()["coupon_period_days"] == 183


@pytest.mark.parametrize("value", [0, 367, 30.5, "30"])
@pytest.mark.asyncio
async def test_coupon_period_days_rejects_out_of_contract_values(
    client: AsyncClient, value: object
) -> None:
    await register(client, f"PeriodValue{str(value).replace('.', 'x')}")
    payload = valid_bond_payload()
    payload["coupon_period_days"] = value

    response = await client.post("/api/portfolio/bonds", json=payload)

    assert response.status_code == 422
    assert "coupon_period_days" in response.json()["field_errors"]


@pytest.mark.parametrize(
    ("placement", "maturity"),
    [
        (date(2025, 8, 10), date(2028, 8, 10)),
        (date.min, date.max),
    ],
    ids=["ordinary", "extreme-dates"],
)
@pytest.mark.asyncio
async def test_incompatible_coupon_period_is_a_field_validation_error_for_any_date_range(
    client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
    placement: date,
    maturity: date,
) -> None:
    monkeypatch.setattr(clock, "utc_today", lambda: date(2026, 8, 10))
    await register(client, f"IncompatiblePeriod{placement.year}")
    payload = {
        "name": "Incompatible period",
        "coupon_amount": "35.40",
        "nominal": "1000.00",
        "payments_per_year": 12,
        "placement_date": placement.isoformat(),
        "maturity_date": maturity.isoformat(),
        "coupon_period_days": 366,
        "amount_spent": "1000.00",
        "quantity": 1,
        "purchase_date": placement.isoformat(),
    }

    response = await client.post("/api/portfolio/bonds", json=payload)

    assert response.status_code == 422
    assert response.json()["code"] == "validation_error"
    assert "coupon_period_days" in response.json()["field_errors"]


@pytest.mark.asyncio
async def test_create_returns_exact_fixed_day_coupon_boundaries(
    client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(clock, "utc_today", lambda: date(2025, 10, 13))
    await register(client, "ExactFixedDaySchedule")
    payload = {
        "name": "Exact fixed-day schedule",
        "coupon_amount": "35.40",
        "nominal": "1000.00",
        "payments_per_year": 12,
        "placement_date": "2025-09-12",
        "maturity_date": "2028-08-27",
        "coupon_period_days": 30,
        "amount_spent": "1000.00",
        "quantity": 1,
        "purchase_date": "2025-09-12",
    }

    response = await client.post("/api/portfolio/bonds", json=payload)

    assert response.status_code == 201
    assert response.json()["next_coupon"]["period_start"] == "2025-10-12"
    assert response.json()["next_coupon"]["period_end"] == "2025-11-11"


@pytest.mark.asyncio
async def test_zero_coupon_has_no_next_payment_in_api(client: AsyncClient) -> None:
    await register(client, "ZeroCouponOwner")
    payload = valid_bond_payload("Бескупонная облигация")
    payload["coupon_amount"] = "0.00"

    response = await client.post("/api/portfolio/bonds", json=payload)

    assert response.status_code == 201
    assert response.json()["status"] == "active"
    assert response.json()["next_coupon"] is None


@pytest.mark.asyncio
async def test_name_availability_and_duplicate_are_case_insensitive_per_user(
    client: AsyncClient,
) -> None:
    await register(client, "FirstOwner")
    created = await client.post("/api/portfolio/bonds", json=valid_bond_payload("  Alpha Bond "))
    assert created.status_code == 201

    availability = await client.get(
        "/api/portfolio/bonds/name-availability",
        params={"name": " alpha bond  "},
    )
    duplicate = await client.post(
        "/api/portfolio/bonds",
        json=valid_bond_payload("ALPHA BOND"),
    )

    assert availability.status_code == 200
    assert availability.json() == {"available": False}
    assert availability.headers["cache-control"] == "no-store"
    assert duplicate.status_code == 409
    assert duplicate.json() == {
        "code": "bond_name_taken",
        "message": "Bond name is already taken",
        "field_errors": {"name": "Bond name is already taken"},
    }

    await client.post("/api/auth/logout")
    await register(client, "SecondOwner")
    other_user = await client.post("/api/portfolio/bonds", json=valid_bond_payload("alpha bond"))
    assert other_user.status_code == 201


@pytest.mark.asyncio
async def test_create_is_atomic_when_initial_purchase_is_invalid(
    client: AsyncClient,
    session_factory: async_sessionmaker[AsyncSession],
) -> None:
    await register(client, "AtomicOwner")
    payload = valid_bond_payload("Never Partially Created")
    payload["purchase_date"] = payload["maturity_date"]

    response = await client.post("/api/portfolio/bonds", json=payload)

    assert response.status_code == 422
    assert response.json()["code"] == "validation_error"
    assert "purchase_date" in response.json()["field_errors"]
    async with session_factory() as session:
        assert list(await session.scalars(select(Bond))) == []


@pytest.mark.asyncio
async def test_foreign_and_missing_bond_purchases_are_indistinguishable(
    client: AsyncClient,
) -> None:
    await register(client, "BondOwner")
    created = await client.post("/api/portfolio/bonds", json=valid_bond_payload())
    bond_id = created.json()["id"]
    await client.post("/api/auth/logout")
    await register(client, "Intruder")
    purchase = {
        "amount_spent": "100.00",
        "quantity": 1,
        "purchase_date": (clock.utc_today() - timedelta(days=1)).isoformat(),
    }

    foreign = await client.post(f"/api/portfolio/bonds/{bond_id}/purchases", json=purchase)
    missing = await client.post(
        "/api/portfolio/bonds/00000000-0000-0000-0000-000000000000/purchases",
        json=purchase,
    )

    expected = {"code": "bond_not_found", "message": "Bond not found"}
    assert foreign.status_code == 404
    assert foreign.json() == expected
    assert missing.status_code == 404
    assert missing.json() == expected


@pytest.mark.asyncio
async def test_delete_bond_removes_its_purchases_and_preserves_other_bonds(
    client: AsyncClient,
    session_factory: async_sessionmaker[AsyncSession],
) -> None:
    await register(client, "DeleteOwner")
    deleted = await client.post(
        "/api/portfolio/bonds",
        json=valid_bond_payload("Delete me"),
    )
    kept = await client.post(
        "/api/portfolio/bonds",
        json=valid_bond_payload("Keep me"),
    )
    deleted_id = deleted.json()["id"]
    kept_id = kept.json()["id"]
    added = await client.post(
        f"/api/portfolio/bonds/{deleted_id}/purchases",
        json={
            "amount_spent": "1000.00",
            "quantity": 1,
            "purchase_date": (clock.utc_today() - timedelta(days=1)).isoformat(),
        },
    )
    assert added.status_code == 201

    response = await client.delete(f"/api/portfolio/bonds/{deleted_id}")

    assert response.status_code == 204
    assert response.content == b""
    assert response.headers["cache-control"] == "no-store"
    async with session_factory() as session:
        remaining_bond_ids = set(await session.scalars(select(Bond.id)))
        remaining_purchase_bond_ids = set(
            await session.scalars(select(BondPurchase.bond_id))
        )
    assert remaining_bond_ids == {UUID(kept_id)}
    assert remaining_purchase_bond_ids == {UUID(kept_id)}

    repeated = await client.delete(f"/api/portfolio/bonds/{deleted_id}")
    assert repeated.status_code == 404
    assert repeated.json() == {"code": "bond_not_found", "message": "Bond not found"}


@pytest.mark.asyncio
async def test_foreign_and_missing_bond_deletes_are_indistinguishable(
    client: AsyncClient,
    session_factory: async_sessionmaker[AsyncSession],
) -> None:
    await register(client, "DeleteBondOwner")
    created = await client.post(
        "/api/portfolio/bonds",
        json=valid_bond_payload("Owner bond"),
    )
    bond_id = created.json()["id"]
    await client.post("/api/auth/logout")
    await register(client, "DeleteIntruder")

    foreign = await client.delete(f"/api/portfolio/bonds/{bond_id}")
    missing = await client.delete(
        "/api/portfolio/bonds/00000000-0000-0000-0000-000000000000"
    )

    expected = {"code": "bond_not_found", "message": "Bond not found"}
    assert foreign.status_code == 404
    assert foreign.json() == expected
    assert missing.status_code == 404
    assert missing.json() == expected
    async with session_factory() as session:
        bond_uuid = UUID(bond_id)
        assert await session.scalar(select(Bond.id).where(Bond.id == bond_uuid)) is not None
        assert (
            await session.scalar(
                select(BondPurchase.id).where(BondPurchase.bond_id == bond_uuid)
            )
            is not None
        )


@pytest.mark.asyncio
async def test_delete_bond_requires_authentication(client: AsyncClient) -> None:
    response = await client.delete(
        "/api/portfolio/bonds/00000000-0000-0000-0000-000000000000"
    )

    assert response.status_code == 401
    assert response.json() == {
        "code": "unauthenticated",
        "message": "Authentication required",
    }


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("changes", "field"),
    [
        ({"name": "   "}, "name"),
        ({"coupon_amount": "1.001"}, "coupon_amount"),
        ({"nominal": "0.00"}, "nominal"),
        ({"amount_spent": "0.00"}, "amount_spent"),
        ({"payments_per_year": 5}, "payments_per_year"),
        ({"quantity": 0}, "quantity"),
        ({"quantity": True}, "quantity"),
        ({"quantity": 2_147_483_648}, "quantity"),
        ({"placement_date": (clock.utc_today() + timedelta(days=1)).isoformat()}, "placement_date"),
        ({"maturity_date": clock.utc_today().isoformat()}, "maturity_date"),
        ({"purchase_date": (clock.utc_today() + timedelta(days=1)).isoformat()}, "purchase_date"),
    ],
)
async def test_create_validation_uses_existing_422_contract(
    client: AsyncClient,
    changes: dict[str, object],
    field: str,
) -> None:
    await register(client, f"Valid{field.replace('_', '')}")
    payload = valid_bond_payload()
    payload.update(changes)

    response = await client.post("/api/portfolio/bonds", json=payload)

    assert response.status_code == 422
    assert response.json()["code"] == "validation_error"
    assert field in response.json()["field_errors"]


@pytest.mark.asyncio
async def test_list_sorts_active_by_maturity_and_name_then_matured(
    client: AsyncClient,
    session_factory: async_sessionmaker[AsyncSession],
) -> None:
    await register(client, "SortOwner")
    today = clock.utc_today()
    for name, maturity in (
        ("Zulu", today.replace(year=today.year + 2)),
        ("beta", today.replace(year=today.year + 1)),
        ("Alpha", today.replace(year=today.year + 1)),
    ):
        payload = valid_bond_payload(name)
        payload["maturity_date"] = maturity.isoformat()
        assert (await client.post("/api/portfolio/bonds", json=payload)).status_code == 201

    async with session_factory() as session:
        active_bond = (await session.scalars(select(Bond).where(Bond.name == "Alpha"))).one()
        matured = Bond(
            user_id=active_bond.user_id,
            name="Matured",
            coupon_amount=Decimal("10.00"),
            nominal=Decimal("1000.00"),
            payments_per_year=2,
            coupon_period_days=182,
            placement_date=today - timedelta(days=730),
            maturity_date=today - timedelta(days=7),
        )
        matured.purchases.append(
            BondPurchase(
                user_id=active_bond.user_id,
                amount_spent=Decimal("900.00"),
                quantity=1,
                purchase_date=today - timedelta(days=365),
            )
        )
        session.add(matured)
        await session.commit()

    response = await client.get("/api/portfolio/bonds")

    assert [item["name"] for item in response.json()["items"]] == [
        "Alpha",
        "beta",
        "Zulu",
        "Matured",
    ]
    matured_card = response.json()["items"][-1]
    assert matured_card["status"] == "matured"
    assert matured_card["maturity_remaining"] == {"years": 0, "months": 0, "days_until": 0}
    assert matured_card["next_coupon"] is None


@pytest.mark.asyncio
async def test_create_rejects_purchase_before_placement(
    client: AsyncClient,
) -> None:
    await register(client, "AncientCreateOwner")
    payload = valid_bond_payload("Ancient initial purchase")
    payload.update(
        payments_per_year=1,
        placement_date=date(clock.utc_today().year - 1, 1, 31).isoformat(),
        maturity_date=date(clock.utc_today().year + 2, 1, 31).isoformat(),
        purchase_date=date.min.isoformat(),
        quantity=1,
        amount_spent="1000.00",
    )

    response = await client.post("/api/portfolio/bonds", json=payload)

    assert response.status_code == 422
    assert response.json()["field_errors"] == {
        "purchase_date": "Value error, purchase_date must not be before placement_date"
    }


@pytest.mark.asyncio
async def test_add_purchase_rejects_date_before_placement(client: AsyncClient) -> None:
    await register(client, "AncientAddOwner")
    created = await client.post(
        "/api/portfolio/bonds",
        json=valid_bond_payload("Ancient added purchase"),
    )
    assert created.status_code == 201

    response = await client.post(
        f"/api/portfolio/bonds/{created.json()['id']}/purchases",
        json={"amount_spent": "1.05", "quantity": 1, "purchase_date": date.min.isoformat()},
    )

    assert response.status_code == 422
    assert response.json()["field_errors"] == {
        "purchase_date": "Purchase date must not be before placement date"
    }


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("coupon_amount", 35.4),
        ("nominal", "1e3"),
        ("amount_spent", "1.000"),
    ],
)
async def test_money_requests_reject_non_string_or_non_plain_values(
    client: AsyncClient,
    field: str,
    value: object,
) -> None:
    await register(client, "StrictMoneyOwner")
    payload = valid_bond_payload()
    payload[field] = value

    response = await client.post("/api/portfolio/bonds", json=payload)

    assert response.status_code == 422
    assert field in response.json()["field_errors"]


@pytest.mark.asyncio
async def test_plain_money_strings_accept_zero_one_or_two_fractional_digits(
    client: AsyncClient,
) -> None:
    await register(client, "PlainMoneyOwner")
    payload = valid_bond_payload("Plain money strings")
    payload.update(coupon_amount="0", nominal="1000.0", amount_spent="900.25")

    response = await client.post("/api/portfolio/bonds", json=payload)

    assert response.status_code == 201
    assert response.json()["coupon_amount"] == "0.00"
    assert response.json()["nominal"] == "1000.00"
    assert response.json()["total_spent"] == "900.25"


@pytest.mark.asyncio
async def test_add_purchase_rejects_json_number_money(client: AsyncClient) -> None:
    await register(client, "StrictPurchaseMoney")
    created = await client.post("/api/portfolio/bonds", json=valid_bond_payload())
    assert created.status_code == 201

    response = await client.post(
        f"/api/portfolio/bonds/{created.json()['id']}/purchases",
        json={
            "amount_spent": 100.05,
            "quantity": 1,
            "purchase_date": (clock.utc_today() - timedelta(days=1)).isoformat(),
        },
    )

    assert response.status_code == 422
    assert "amount_spent" in response.json()["field_errors"]


@pytest.mark.asyncio
async def test_add_purchase_rejects_quantity_above_postgresql_integer(
    client: AsyncClient,
) -> None:
    await register(client, "BoundedPurchaseQuantity")
    created = await client.post("/api/portfolio/bonds", json=valid_bond_payload())
    assert created.status_code == 201

    response = await client.post(
        f"/api/portfolio/bonds/{created.json()['id']}/purchases",
        json={
            "amount_spent": "100.05",
            "quantity": 2_147_483_648,
            "purchase_date": (clock.utc_today() - timedelta(days=1)).isoformat(),
        },
    )

    assert response.status_code == 422
    assert response.json()["code"] == "validation_error"
    assert "quantity" in response.json()["field_errors"]


@pytest.mark.asyncio
async def test_portfolio_api_uses_one_injected_utc_date_for_validation_and_cards(
    client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from app.portfolio import clock

    utc_today = clock.utc_today() + timedelta(days=400)
    monkeypatch.setattr(clock, "utc_today", lambda: utc_today)
    await register(client, "UtcPortfolioClock")
    payload = valid_bond_payload("UTC clock bond")
    payload.update(
        maturity_date=(utc_today + timedelta(days=1)).isoformat(),
        purchase_date=utc_today.isoformat(),
        quantity=1,
        amount_spent="1000.00",
    )

    created = await client.post("/api/portfolio/bonds", json=payload)

    assert created.status_code == 201
    assert created.json()["maturity_remaining"]["days_until"] == 1

    added = await client.post(
        f"/api/portfolio/bonds/{created.json()['id']}/purchases",
        json={"amount_spent": "1.00", "quantity": 1, "purchase_date": utc_today.isoformat()},
    )
    assert added.status_code == 201
    assert added.json()["maturity_remaining"]["days_until"] == 1

    listed = await client.get("/api/portfolio/bonds")
    assert listed.status_code == 200
    assert listed.json()["items"][0]["maturity_remaining"]["days_until"] == 1


@pytest.mark.asyncio
async def test_availability_uses_database_lower_semantics_instead_of_python_casefold(
    client: AsyncClient,
) -> None:
    await register(client, "DatabaseLowerOwner")
    first = await client.post("/api/portfolio/bonds", json=valid_bond_payload("STRASSE"))
    assert first.status_code == 201

    availability = await client.get(
        "/api/portfolio/bonds/name-availability",
        params={"name": "stra\u00dfe"},
    )
    second = await client.post("/api/portfolio/bonds", json=valid_bond_payload("stra\u00dfe"))

    assert availability.status_code == 200
    assert availability.json() == {"available": True}
    assert second.status_code == 201

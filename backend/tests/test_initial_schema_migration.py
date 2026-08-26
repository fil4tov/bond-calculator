import asyncio
from collections.abc import Iterator
from contextlib import contextmanager
from datetime import UTC, date, datetime
import os
from types import SimpleNamespace
from typing import Any
from uuid import uuid4

from alembic import command
from alembic.config import Config
import pytest
import sqlalchemy as sa
from sqlalchemy.engine import Connection, make_url
from sqlalchemy.ext.asyncio import create_async_engine

from app.config import get_settings


def _database_url() -> str:
    database_url = os.getenv("TEST_DATABASE_URL")
    if database_url is None:
        pytest.skip("requires the PostgreSQL Compose test database")
    return database_url


def _alembic_config(database_url: str) -> Config:
    config = Config("alembic.ini")
    config.set_main_option("sqlalchemy.url", database_url)
    return config


async def _execute_admin(database_url: str, statement: str) -> None:
    engine = create_async_engine(database_url, isolation_level="AUTOCOMMIT")
    try:
        async with engine.connect() as connection:
            await connection.execute(sa.text(statement))
    finally:
        await engine.dispose()


async def _seed_legacy_schedules(database_url: str) -> None:
    engine = create_async_engine(database_url)
    user_ids = (uuid4(), uuid4())
    bond_ids = (uuid4(), uuid4())
    try:
        async with engine.begin() as connection:
            for index, user_id in enumerate(user_ids):
                await connection.execute(
                    sa.text(
                        "INSERT INTO users (id, username, password_hash) "
                        "VALUES (:id, :username, :password_hash)"
                    ),
                    {
                        "id": user_id,
                        "username": f"MigrationOwner{index}",
                        "password_hash": "hash",
                    },
                )
                await connection.execute(
                    sa.text(
                        """
                        INSERT INTO bonds (
                            id, user_id, instrument_uid, ticker, name, nominal,
                            payments_per_year, placement_date, maturity_date
                        ) VALUES (
                            :id, :user_id, 'shared-uid', 'TEST', :name, 1000,
                            2, '2025-01-01', '2030-01-01'
                        )
                        """
                    ),
                    {
                        "id": bond_ids[index],
                        "user_id": user_id,
                        "name": f"Migrated bond {index}",
                    },
                )
                await connection.execute(
                    sa.text(
                        """
                        INSERT INTO bond_coupon_schedules (
                            id, bond_id, figi, coupon_date, coupon_number, fix_date,
                            pay_one_bond_amount, pay_one_bond_currency, coupon_type,
                            coupon_start_date, coupon_end_date, coupon_period
                        ) VALUES (
                            :id, :bond_id, 'OLD', '2026-12-01', 1, NULL,
                            10, 'RUB', 1, '2026-06-01', '2026-12-01', 183
                        )
                        """
                    ),
                    {"id": uuid4(), "bond_id": bond_ids[index]},
                )
    finally:
        await engine.dispose()


async def _read_migrated_counts(database_url: str) -> tuple[int, int, str]:
    engine = create_async_engine(database_url)
    try:
        async with engine.connect() as connection:
            sync_count = await connection.scalar(
                sa.text("SELECT count(*) FROM bond_coupon_schedule_syncs")
            )
            schedule_count = await connection.scalar(
                sa.text("SELECT count(*) FROM bond_coupon_schedules")
            )
            instrument_uid = await connection.scalar(
                sa.text("SELECT instrument_uid FROM bond_coupon_schedules")
            )
            return int(sync_count or 0), int(schedule_count or 0), str(instrument_uid)
    finally:
        await engine.dispose()


async def _read_scalar_int(database_url: str, statement: str) -> int:
    engine = create_async_engine(database_url)
    try:
        async with engine.connect() as connection:
            return int(await connection.scalar(sa.text(statement)) or 0)
    finally:
        await engine.dispose()


async def _read_version(database_url: str) -> str:
    engine = create_async_engine(database_url)
    try:
        async with engine.connect() as connection:
            return str(
                await connection.scalar(sa.text("SELECT version_num FROM alembic_version"))
            )
    finally:
        await engine.dispose()


class FakeTInvestClient:
    requests: list[tuple[str, datetime, datetime]] = []

    def __init__(self, token: str) -> None:
        assert token == "migration-token"
        self.instruments = self

    def __enter__(self) -> "FakeTInvestClient":
        return self

    def __exit__(self, *_args: object) -> None:
        return None

    def get_bond_coupons(
        self, *, instrument_id: str, from_: datetime, to: datetime
    ) -> SimpleNamespace:
        self.requests.append((instrument_id, from_, to))
        event = SimpleNamespace(
            figi="NEW",
            coupon_date=datetime(2026, 12, 1, tzinfo=UTC),
            coupon_number=1,
            fix_date=None,
            pay_one_bond=SimpleNamespace(units=25, nano=0, currency="RUB"),
            coupon_type=1,
            coupon_start_date=datetime(2026, 6, 1, tzinfo=UTC),
            coupon_end_date=datetime(2026, 12, 1, tzinfo=UTC),
            coupon_period=183,
        )
        return SimpleNamespace(events=[event])


class FailingTInvestClient(FakeTInvestClient):
    def get_bond_coupons(
        self, *, instrument_id: str, from_: datetime, to: datetime
    ) -> SimpleNamespace:
        raise RuntimeError("offline")


@contextmanager
def _temporary_database() -> Iterator[str]:
    source_url = make_url(_database_url())
    database_name = f"bonds_migration_{uuid4().hex}"
    admin_url = source_url.set(database="postgres").render_as_string(hide_password=False)
    database_url = source_url.set(database=database_name).render_as_string(
        hide_password=False
    )
    asyncio.run(_execute_admin(admin_url, f'CREATE DATABASE "{database_name}"'))

    previous_database_url = os.environ.get("DATABASE_URL")
    os.environ["DATABASE_URL"] = database_url
    get_settings.cache_clear()
    try:
        yield database_url
    finally:
        get_settings.cache_clear()
        if previous_database_url is None:
            os.environ.pop("DATABASE_URL", None)
        else:
            os.environ["DATABASE_URL"] = previous_database_url
        asyncio.run(
            _execute_admin(
                admin_url,
                f'DROP DATABASE IF EXISTS "{database_name}" WITH (FORCE)',
            )
        )
        get_settings.cache_clear()


def _inspect_schema(connection: Connection) -> dict[str, Any]:
    inspector = sa.inspect(connection)
    application_tables = {
        "users",
        "auth_sessions",
        "bonds",
        "bond_coupon_schedule_syncs",
        "bond_coupon_schedules",
        "bond_operations",
    }
    return {
        "tables": set(inspector.get_table_names()),
        "version": connection.execute(
            sa.text("SELECT version_num FROM alembic_version")
        ).scalar_one(),
        "columns": {
            table: {column["name"] for column in inspector.get_columns(table)}
            for table in application_tables
        },
        "indexes": {
            table: {
                index["name"]
                for index in inspector.get_indexes(table)
                if "duplicates_constraint" not in index
            }
            for table in application_tables
        },
        "checks": {
            table: {
                constraint["name"]
                for constraint in inspector.get_check_constraints(table)
            }
            for table in application_tables
        },
    }


async def _read_schema(database_url: str) -> dict[str, Any]:
    engine = create_async_engine(database_url)
    try:
        async with engine.connect() as connection:
            return await connection.run_sync(_inspect_schema)
    finally:
        await engine.dispose()


async def _read_table_names(database_url: str) -> set[str]:
    engine = create_async_engine(database_url)
    try:
        async with engine.connect() as connection:
            return await connection.run_sync(
                lambda sync_connection: set(sa.inspect(sync_connection).get_table_names())
            )
    finally:
        await engine.dispose()


def test_initial_revision_creates_the_current_schema() -> None:
    with _temporary_database() as database_url:
        config = _alembic_config(database_url)
        command.upgrade(config, "head")

        schema = asyncio.run(_read_schema(database_url))

        assert schema["tables"] == {
            "alembic_version",
            "users",
            "auth_sessions",
            "bonds",
            "bond_coupon_schedule_syncs",
            "bond_coupon_schedules",
            "bond_operations",
        }
        assert schema["version"] == "20260826_0002"
        assert schema["columns"]["bonds"] == {
            "id",
            "user_id",
            "instrument_uid",
            "ticker",
            "name",
            "nominal",
            "aci_value",
            "instrument_checked_on",
            "payments_per_year",
            "placement_date",
            "maturity_date",
            "created_at",
        }
        assert schema["columns"]["bond_coupon_schedule_syncs"] == {
            "instrument_uid",
            "updated_at",
        }
        assert schema["columns"]["bond_coupon_schedules"] == {
            "id",
            "instrument_uid",
            "figi",
            "coupon_date",
            "coupon_number",
            "fix_date",
            "pay_one_bond_amount",
            "pay_one_bond_currency",
            "coupon_type",
            "coupon_start_date",
            "coupon_end_date",
            "coupon_period",
        }
        assert schema["indexes"] == {
            "users": {"uq_users_username_lower"},
            "auth_sessions": {
                "ix_auth_sessions_expires_at",
                "ix_auth_sessions_token_hash",
                "ix_auth_sessions_user_id",
            },
            "bonds": {"ix_bonds_user_id", "uq_bonds_user_name_normalized"},
            "bond_coupon_schedule_syncs": set(),
            "bond_coupon_schedules": {
                "ix_bond_coupon_schedules_instrument_uid_coupon_date"
            },
            "bond_operations": {
                "ix_bond_operations_bond_id",
                "ix_bond_operations_user_id",
                "ix_bond_operations_bond_id_operation_date",
            },
        }
        assert schema["checks"] == {
            "users": set(),
            "auth_sessions": set(),
            "bonds": {
                "ck_bonds_nominal_positive",
                "ck_bonds_payments_per_year_nonnegative",
                "ck_bonds_placement_before_maturity",
            },
            "bond_coupon_schedule_syncs": set(),
            "bond_coupon_schedules": {
                "ck_bond_coupon_schedule_amount_nonnegative",
                "ck_bond_coupon_schedule_dates_ordered",
                "ck_bond_coupon_schedule_period_nonnegative",
            },
            "bond_operations": {
                "ck_bond_operations_amount_positive",
                "ck_bond_operations_quantity_positive",
                "ck_bond_operations_type",
            },
        }
        command.check(config)


def test_initial_revision_can_downgrade_and_upgrade_again() -> None:
    with _temporary_database() as database_url:
        config = _alembic_config(database_url)
        command.upgrade(config, "head")
        command.downgrade(config, "base")

        assert asyncio.run(_read_table_names(database_url)) == {"alembic_version"}

        command.upgrade(config, "head")


def test_shared_schedule_migration_backfills_once_per_uid_and_downgrades(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    import t_tech.invest

    with _temporary_database() as database_url:
        config = _alembic_config(database_url)
        command.upgrade(config, "20260813_0001")
        asyncio.run(_seed_legacy_schedules(database_url))
        FakeTInvestClient.requests.clear()
        monkeypatch.setattr(t_tech.invest, "Client", FakeTInvestClient)
        monkeypatch.setenv("T_INVEST_API_KEY", "migration-token")
        get_settings.cache_clear()

        command.upgrade(config, "head")

        assert asyncio.run(_read_migrated_counts(database_url)) == (
            1,
            1,
            "shared-uid",
        )
        assert [request[0] for request in FakeTInvestClient.requests] == ["shared-uid"]
        assert FakeTInvestClient.requests[0][1].date() == date(2025, 1, 1)
        assert FakeTInvestClient.requests[0][2].date() == date(2030, 1, 1)

        command.downgrade(config, "20260813_0001")
        assert asyncio.run(
            _read_scalar_int(
                database_url, "SELECT count(*) FROM bond_coupon_schedules"
            )
        ) == 2


def test_shared_schedule_migration_rolls_back_when_t_invest_fails(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    import t_tech.invest

    with _temporary_database() as database_url:
        config = _alembic_config(database_url)
        command.upgrade(config, "20260813_0001")
        asyncio.run(_seed_legacy_schedules(database_url))
        monkeypatch.setattr(t_tech.invest, "Client", FailingTInvestClient)
        monkeypatch.setenv("T_INVEST_API_KEY", "migration-token")
        get_settings.cache_clear()

        with pytest.raises(RuntimeError, match="Unable to backfill"):
            command.upgrade(config, "head")

        assert asyncio.run(
            _read_scalar_int(
                database_url,
                "SELECT count(*) FROM bond_coupon_schedules WHERE bond_id IS NOT NULL",
            )
        ) == 2
        assert asyncio.run(_read_version(database_url)) == "20260813_0001"

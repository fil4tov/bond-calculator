import asyncio
from collections.abc import Iterator
from contextlib import contextmanager
import os
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
            "bond_coupon_schedules",
            "bond_operations",
        }
        assert schema["version"] == "20260813_0001"
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
        assert schema["indexes"] == {
            "users": {"uq_users_username_lower"},
            "auth_sessions": {
                "ix_auth_sessions_expires_at",
                "ix_auth_sessions_token_hash",
                "ix_auth_sessions_user_id",
            },
            "bonds": {"ix_bonds_user_id", "uq_bonds_user_name_normalized"},
            "bond_coupon_schedules": {
                "ix_bond_coupon_schedules_bond_id_coupon_date"
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

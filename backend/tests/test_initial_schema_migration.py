import asyncio
import os
from typing import Any

from alembic import command
from alembic.config import Config
import pytest
import sqlalchemy as sa
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import create_async_engine


def _database_url() -> str:
    database_url = os.getenv("TEST_DATABASE_URL")
    if database_url is None:
        pytest.skip("requires the PostgreSQL Compose test database")
    return database_url


def _alembic_config(database_url: str) -> Config:
    os.environ["DATABASE_URL"] = database_url
    config = Config("alembic.ini")
    config.set_main_option("sqlalchemy.url", database_url)
    return config


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
    database_url = _database_url()
    config = _alembic_config(database_url)
    command.downgrade(config, "base")
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


def test_initial_revision_can_downgrade_and_upgrade_again() -> None:
    database_url = _database_url()
    config = _alembic_config(database_url)
    command.upgrade(config, "head")
    command.downgrade(config, "base")
    try:
        assert asyncio.run(_read_table_names(database_url)) == {"alembic_version"}
    finally:
        command.upgrade(config, "head")

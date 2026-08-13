# Initial Database Baseline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the eight pre-production Alembic revisions with one verified baseline revision that initializes the complete current PostgreSQL schema.

**Architecture:** Alembic remains the only schema-initialization mechanism. A single immutable revision creates the final ORM-compatible schema directly; legacy data transformations disappear because every supported deployment starts from an empty database. Migration-specific unit coverage moves from intermediate transformations to the baseline contract, while the Compose PostgreSQL environment verifies the real upgrade, schema-drift check, downgrade, and re-upgrade paths.

**Tech Stack:** Python 3.13, Alembic 1.19, SQLAlchemy 2.0, PostgreSQL 17, pytest 8.4, Docker Compose

## Global Constraints

- The baseline file is `backend/migrations/versions/20260813_0001_initial_schema.py` with `revision = "20260813_0001"` and `down_revision = None`.
- Active Alembic history contains only the baseline revision; the eight legacy files remain recoverable through Git history.
- The baseline creates `users`, `auth_sessions`, `bonds`, `bond_coupon_schedules`, and `bond_operations` directly.
- The baseline never creates `bond_purchases`, `coupon_amount`, `coupon_period_days`, or `nominal_checked_on`, and performs no data-copy or data-delete SQL.
- Alembic remains the only schema initializer; do not add SQL dumps or `Base.metadata.create_all()` to runtime startup.
- After the first production deployment the baseline is immutable and future schema changes use new revisions.
- The disposable local PostgreSQL volume may be deleted; no local data migration or seed data is required.

---

### Task 1: Define the baseline migration contract

**Files:**
- Create: `backend/tests/test_initial_schema_migration.py`
- Delete: `backend/tests/test_placement_migration.py`
- Delete: `backend/tests/test_coupon_period_migration.py`
- Delete: `backend/tests/test_t_invest_migration.py`
- Delete: `backend/tests/test_bond_operations_migration.py`

**Interfaces:**
- Consumes: `TEST_DATABASE_URL`, Alembic's programmatic command API, and SQLAlchemy's PostgreSQL inspector.
- Produces: An integration contract requiring revision `20260813_0001`, exactly the five current application tables, current columns/indexes/check constraints, and a working downgrade/re-upgrade cycle.

- [ ] **Step 1: Add the failing baseline test**

Create `backend/tests/test_initial_schema_migration.py`:

```python
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
                lambda sync_connection: set(
                    sa.inspect(sync_connection).get_table_names()
                )
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
```

The first test catches a wrong revision, missing/current table, column, index, or check constraint. The second catches unsafe dependency order in `downgrade()` and always restores `head` for the rest of the suite.

- [ ] **Step 2: Remove the four obsolete migration tests**

Delete the four files listed above. Their assertions describe intermediate schemas and data conversions that the baseline deliberately removes.

- [ ] **Step 3: Run the focused test and verify the expected failure**

Build and run from the repository root:

```powershell
docker compose -f compose.test.yaml build backend-test
docker compose -f compose.test.yaml up -d postgres-test
docker compose -f compose.test.yaml run --rm backend-test `
  python -m pytest tests/test_initial_schema_migration.py -q
```

Expected: the schema assertion fails because the database records legacy head `20260812_0008` instead of baseline `20260813_0001`.

---

### Task 2: Replace the legacy revision chain with the baseline

**Files:**
- Create: `backend/migrations/versions/20260813_0001_initial_schema.py`
- Delete: `backend/migrations/versions/20260809_0001_create_auth_tables.py`
- Delete: `backend/migrations/versions/20260809_0002_create_portfolio_tables.py`
- Delete: `backend/migrations/versions/20260810_0003_add_bond_placement_date.py`
- Delete: `backend/migrations/versions/20260810_0004_add_coupon_period_days.py`
- Delete: `backend/migrations/versions/20260811_0005_t_invest_coupon_schedules.py`
- Delete: `backend/migrations/versions/20260811_0006_bond_operations.py`
- Delete: `backend/migrations/versions/20260812_0007_bond_nominal_refresh.py`
- Delete: `backend/migrations/versions/20260812_0008_bond_accrued_coupon_income.py`
- Test: `backend/tests/test_initial_schema_migration.py`

**Interfaces:**
- Consumes: Current model contract from `app.users.models.User`, `app.auth.models.AuthSession`, and `app.portfolio.models`.
- Produces: Alembic revision `20260813_0001`, which is the sole `head` and creates the complete current schema.

- [ ] **Step 1: Create the complete baseline revision**

Create `backend/migrations/versions/20260813_0001_initial_schema.py`:

```python
"""Create the initial production database schema.

Revision ID: 20260813_0001
Revises:
Create Date: 2026-08-13
"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa

revision: str = "20260813_0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("username", sa.String(length=32), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "uq_users_username_lower",
        "users",
        [sa.text("lower(username)")],
        unique=True,
    )

    op.create_table(
        "auth_sessions",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_auth_sessions_expires_at", "auth_sessions", ["expires_at"])
    op.create_index(
        "ix_auth_sessions_token_hash",
        "auth_sessions",
        ["token_hash"],
        unique=True,
    )
    op.create_index("ix_auth_sessions_user_id", "auth_sessions", ["user_id"])

    op.create_table(
        "bonds",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("instrument_uid", sa.String(length=64), nullable=False),
        sa.Column("ticker", sa.String(length=32), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("nominal", sa.Numeric(18, 2), nullable=False),
        sa.Column("aci_value", sa.Numeric(28, 9), nullable=True),
        sa.Column("instrument_checked_on", sa.Date(), nullable=True),
        sa.Column("payments_per_year", sa.Integer(), nullable=False),
        sa.Column("placement_date", sa.Date(), nullable=False),
        sa.Column("maturity_date", sa.Date(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.CheckConstraint("nominal > 0", name="ck_bonds_nominal_positive"),
        sa.CheckConstraint(
            "payments_per_year >= 0",
            name="ck_bonds_payments_per_year_nonnegative",
        ),
        sa.CheckConstraint(
            "placement_date < maturity_date",
            name="ck_bonds_placement_before_maturity",
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("id", "user_id", name="uq_bonds_id_user_id"),
    )
    op.create_index("ix_bonds_user_id", "bonds", ["user_id"])
    op.create_index(
        "uq_bonds_user_name_normalized",
        "bonds",
        ["user_id", sa.text("lower(btrim(name))")],
        unique=True,
    )

    op.create_table(
        "bond_coupon_schedules",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("bond_id", sa.Uuid(), nullable=False),
        sa.Column("figi", sa.String(length=64), nullable=False),
        sa.Column("coupon_date", sa.Date(), nullable=False),
        sa.Column("coupon_number", sa.BigInteger(), nullable=False),
        sa.Column("fix_date", sa.Date(), nullable=True),
        sa.Column("pay_one_bond_amount", sa.Numeric(28, 9), nullable=False),
        sa.Column("pay_one_bond_currency", sa.String(length=8), nullable=False),
        sa.Column("coupon_type", sa.Integer(), nullable=False),
        sa.Column("coupon_start_date", sa.Date(), nullable=False),
        sa.Column("coupon_end_date", sa.Date(), nullable=False),
        sa.Column("coupon_period", sa.Integer(), nullable=False),
        sa.CheckConstraint(
            "pay_one_bond_amount >= 0",
            name="ck_bond_coupon_schedule_amount_nonnegative",
        ),
        sa.CheckConstraint(
            "coupon_period >= 0",
            name="ck_bond_coupon_schedule_period_nonnegative",
        ),
        sa.CheckConstraint(
            "coupon_start_date <= coupon_end_date",
            name="ck_bond_coupon_schedule_dates_ordered",
        ),
        sa.ForeignKeyConstraint(["bond_id"], ["bonds.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "bond_id",
            "coupon_number",
            "coupon_date",
            name="uq_bond_coupon_schedule_event",
        ),
    )
    op.create_index(
        "ix_bond_coupon_schedules_bond_id_coupon_date",
        "bond_coupon_schedules",
        ["bond_id", "coupon_date"],
    )

    op.create_table(
        "bond_operations",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("bond_id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("operation_type", sa.String(length=8), nullable=False),
        sa.Column("amount", sa.Numeric(18, 2), nullable=False),
        sa.Column("quantity", sa.Integer(), nullable=False),
        sa.Column("operation_date", sa.Date(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "operation_type IN ('purchase', 'sale')",
            name="ck_bond_operations_type",
        ),
        sa.CheckConstraint("amount > 0", name="ck_bond_operations_amount_positive"),
        sa.CheckConstraint(
            "quantity > 0",
            name="ck_bond_operations_quantity_positive",
        ),
        sa.ForeignKeyConstraint(
            ["bond_id", "user_id"],
            ["bonds.id", "bonds.user_id"],
            ondelete="CASCADE",
            name="fk_bond_operations_bond_owner",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_bond_operations_bond_id", "bond_operations", ["bond_id"])
    op.create_index("ix_bond_operations_user_id", "bond_operations", ["user_id"])
    op.create_index(
        "ix_bond_operations_bond_id_operation_date",
        "bond_operations",
        ["bond_id", "operation_date"],
    )


def downgrade() -> None:
    op.drop_table("bond_operations")
    op.drop_table("bond_coupon_schedules")
    op.drop_table("bonds")
    op.drop_table("auth_sessions")
    op.drop_table("users")
```

- [ ] **Step 2: Delete the eight legacy revision files**

Remove only the eight listed files from `backend/migrations/versions`. Keep `env.py` and `script.py.mako` unchanged.

- [ ] **Step 3: Run the focused migration contract test**

Rebuild and run from the repository root:

```powershell
docker compose -f compose.test.yaml build backend-test
docker compose -f compose.test.yaml run --rm backend-test `
  python -m pytest tests/test_initial_schema_migration.py -q
```

Expected: `2 passed`.

- [ ] **Step 4: Verify the Alembic graph**

Run from `backend` with a valid `DATABASE_URL`:

```powershell
uv run alembic heads
uv run alembic history
```

Expected: both commands show only `20260813_0001 (head)` and no legacy revision identifiers.

- [ ] **Step 5: Commit the code-level squash**

```powershell
git add backend/migrations/versions backend/tests
git commit -m "refactor(database): squash pre-production migrations"
```

---

### Task 3: Validate the baseline against a fresh PostgreSQL database

**Files:**
- Verify only; no expected source changes.

**Interfaces:**
- Consumes: Baseline revision `20260813_0001` and Compose test services `postgres-test` and `backend-test`.
- Produces: Evidence that upgrade, drift detection, downgrade, re-upgrade, and backend tests all work on PostgreSQL 17.

- [ ] **Step 1: Start the disposable test database**

From the repository root:

```powershell
docker compose -f compose.test.yaml up -d postgres-test
```

Expected: `postgres-test` reaches healthy state.

- [ ] **Step 2: Apply the baseline and verify the recorded revision**

```powershell
docker compose -f compose.test.yaml run --rm backend-test alembic upgrade head
docker compose -f compose.test.yaml run --rm backend-test alembic current
```

Expected: upgrade succeeds and `current` reports `20260813_0001 (head)`.

- [ ] **Step 3: Check ORM-to-database schema drift**

```powershell
docker compose -f compose.test.yaml run --rm backend-test alembic check
```

Expected: `No new upgrade operations detected.`

- [ ] **Step 4: Verify downgrade and repeatable upgrade**

```powershell
docker compose -f compose.test.yaml run --rm backend-test alembic downgrade base
docker compose -f compose.test.yaml run --rm backend-test alembic upgrade head
```

Expected: both commands succeed without foreign-key or missing-object errors.

- [ ] **Step 5: Run backend tests through the PostgreSQL Compose environment**

```powershell
docker compose -f compose.test.yaml run --rm backend-test python -m pytest
```

Expected: all backend tests pass.

- [ ] **Step 6: Tear down the disposable test stack**

```powershell
docker compose -f compose.test.yaml down -v
```

Expected: only resources belonging to the `compose.test.yaml` project are removed.

---

### Task 4: Reset local development and run repository-wide verification

**Files:**
- Verify only; no expected source changes.

**Interfaces:**
- Consumes: The approved authorization to delete the disposable local database and the completed baseline migration.
- Produces: A clean local development database at `20260813_0001` and final project verification evidence.

- [ ] **Step 1: Resolve the exact local Compose volume before deletion**

```powershell
docker compose config --volumes
docker volume ls --filter label=com.docker.compose.project=bonds
```

Expected: the project declares `postgres_data`; inspect the labeled result and confirm it belongs to this repository's Compose project before continuing.

- [ ] **Step 2: Delete and recreate only the local project database**

```powershell
docker compose down -v
docker compose up -d postgres backend
```

Expected: the `bonds` Compose project's database volume is recreated, PostgreSQL becomes healthy, backend applies `20260813_0001`, and the API starts.

- [ ] **Step 3: Confirm local migration state and backend health**

```powershell
docker compose exec backend alembic current
docker compose ps
```

Expected: Alembic reports `20260813_0001 (head)` and both services are healthy/running.

- [ ] **Step 4: Run frontend checks required by the repository**

Run from `frontend`:

```powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
```

Expected: every command exits successfully.

- [ ] **Step 5: Run final Git and migration sanity checks**

```powershell
git diff --check
git status --short
```

Expected: no whitespace errors; the working tree contains no uncommitted implementation changes after the Task 2 commit.

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

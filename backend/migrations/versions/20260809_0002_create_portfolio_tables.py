"""Create bond portfolio tables.

Revision ID: 20260809_0002
Revises: 20260809_0001
Create Date: 2026-08-09
"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa

revision: str = "20260809_0002"
down_revision: str | None = "20260809_0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "bonds",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("coupon_amount", sa.Numeric(18, 2), nullable=False),
        sa.Column("nominal", sa.Numeric(18, 2), nullable=False),
        sa.Column("payments_per_year", sa.Integer(), nullable=False),
        sa.Column("maturity_date", sa.Date(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.CheckConstraint("coupon_amount >= 0", name="ck_bonds_coupon_amount_nonnegative"),
        sa.CheckConstraint("nominal > 0", name="ck_bonds_nominal_positive"),
        sa.CheckConstraint(
            "payments_per_year IN (1, 2, 3, 4, 6, 12)", name="ck_bonds_payments_per_year"
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
        "bond_purchases",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("bond_id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("amount_spent", sa.Numeric(18, 2), nullable=False),
        sa.Column("quantity", sa.Integer(), nullable=False),
        sa.Column("purchase_date", sa.Date(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "amount_spent > 0", name="ck_bond_purchases_amount_spent_positive"
        ),
        sa.CheckConstraint("quantity > 0", name="ck_bond_purchases_quantity_positive"),
        sa.ForeignKeyConstraint(
            ["bond_id", "user_id"],
            ["bonds.id", "bonds.user_id"],
            ondelete="CASCADE",
            name="fk_bond_purchases_bond_owner",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_bond_purchases_bond_id", "bond_purchases", ["bond_id"])
    op.create_index("ix_bond_purchases_user_id", "bond_purchases", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_bond_purchases_user_id", table_name="bond_purchases")
    op.drop_index("ix_bond_purchases_bond_id", table_name="bond_purchases")
    op.drop_table("bond_purchases")
    op.drop_index("uq_bonds_user_name_normalized", table_name="bonds")
    op.drop_index("ix_bonds_user_id", table_name="bonds")
    op.drop_table("bonds")

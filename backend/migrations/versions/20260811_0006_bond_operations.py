"""Replace legacy purchases with a unified bond operation ledger.

Revision ID: 20260811_0006
Revises: 20260811_0005
Create Date: 2026-08-11
"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa

revision: str = "20260811_0006"
down_revision: str | None = "20260811_0005"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _create_operations() -> None:
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
            "operation_type IN ('purchase', 'sale')", name="ck_bond_operations_type"
        ),
        sa.CheckConstraint("amount > 0", name="ck_bond_operations_amount_positive"),
        sa.CheckConstraint("quantity > 0", name="ck_bond_operations_quantity_positive"),
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


def upgrade() -> None:
    _create_operations()
    op.execute(
        sa.text(
            """
            INSERT INTO bond_operations (
                id, bond_id, user_id, operation_type, amount, quantity, operation_date, created_at
            )
            SELECT id, bond_id, user_id, 'purchase', amount_spent, quantity, purchase_date, created_at
            FROM bond_purchases
            """
        )
    )
    op.drop_table("bond_purchases")


def downgrade() -> None:
    op.create_table(
        "bond_purchases",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("bond_id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("amount_spent", sa.Numeric(18, 2), nullable=False),
        sa.Column("quantity", sa.Integer(), nullable=False),
        sa.Column("purchase_date", sa.Date(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("amount_spent > 0", name="ck_bond_purchases_amount_spent_positive"),
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
    op.execute(
        sa.text(
            """
            INSERT INTO bond_purchases (id, bond_id, user_id, amount_spent, quantity, purchase_date, created_at)
            SELECT id, bond_id, user_id, amount, quantity, operation_date, created_at
            FROM bond_operations
            WHERE operation_type = 'purchase'
            """
        )
    )
    op.drop_index("ix_bond_operations_bond_id_operation_date", table_name="bond_operations")
    op.drop_index("ix_bond_operations_user_id", table_name="bond_operations")
    op.drop_index("ix_bond_operations_bond_id", table_name="bond_operations")
    op.drop_table("bond_operations")

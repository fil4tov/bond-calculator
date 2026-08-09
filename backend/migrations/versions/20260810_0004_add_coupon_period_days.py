"""Persist the coupon period duration without removing portfolio data.

Revision ID: 20260810_0004
Revises: 20260810_0003
Create Date: 2026-08-10
"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa

revision: str = "20260810_0004"
down_revision: str | None = "20260810_0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("bonds", sa.Column("coupon_period_days", sa.SmallInteger(), nullable=True))
    op.execute(
        sa.text(
            """
    UPDATE bonds
    SET coupon_period_days = CASE payments_per_year
        WHEN 1 THEN 365 WHEN 2 THEN 182 WHEN 3 THEN 122
        WHEN 4 THEN 91 WHEN 6 THEN 61 WHEN 12 THEN 30
    END
"""
        )
    )
    op.create_check_constraint(
        "ck_bonds_coupon_period_days",
        "bonds",
        "coupon_period_days BETWEEN 1 AND 366",
    )
    op.alter_column("bonds", "coupon_period_days", nullable=False)


def downgrade() -> None:
    op.drop_constraint("ck_bonds_coupon_period_days", "bonds", type_="check")
    op.drop_column("bonds", "coupon_period_days")

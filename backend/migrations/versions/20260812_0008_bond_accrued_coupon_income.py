"""Store the current accrued coupon income per bond.

Revision ID: 20260812_0008
Revises: 20260812_0007
Create Date: 2026-08-12
"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa

revision: str = "20260812_0008"
down_revision: str | None = "20260812_0007"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("bonds") as batch_op:
        batch_op.alter_column(
            "nominal_checked_on",
            new_column_name="instrument_checked_on",
            existing_type=sa.Date(),
            existing_nullable=True,
        )
        batch_op.add_column(sa.Column("aci_value", sa.Numeric(28, 9), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("bonds") as batch_op:
        batch_op.drop_column("aci_value")
        batch_op.alter_column(
            "instrument_checked_on",
            new_column_name="nominal_checked_on",
            existing_type=sa.Date(),
            existing_nullable=True,
        )

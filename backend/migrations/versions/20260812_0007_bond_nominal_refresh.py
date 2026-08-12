"""Track the UTC day on which a bond nominal was last refreshed.

Revision ID: 20260812_0007
Revises: 20260811_0006
Create Date: 2026-08-12
"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa

revision: str = "20260812_0007"
down_revision: str | None = "20260811_0006"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("bonds") as batch_op:
        batch_op.add_column(sa.Column("nominal_checked_on", sa.Date(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("bonds") as batch_op:
        batch_op.drop_column("nominal_checked_on")

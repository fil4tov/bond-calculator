"""Add the bond placement date and reset legacy portfolio rows.

Revision ID: 20260810_0003
Revises: 20260809_0002
Create Date: 2026-08-10
"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa

revision: str = "20260810_0003"
down_revision: str | None = "20260809_0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(sa.text("DELETE FROM bond_purchases"))
    op.execute(sa.text("DELETE FROM bonds"))
    op.add_column("bonds", sa.Column("placement_date", sa.Date(), nullable=False))
    op.create_check_constraint(
        "ck_bonds_placement_before_maturity",
        "bonds",
        "placement_date < maturity_date",
    )


def downgrade() -> None:
    op.drop_constraint(
        "ck_bonds_placement_before_maturity",
        "bonds",
        type_="check",
    )
    op.drop_column("bonds", "placement_date")

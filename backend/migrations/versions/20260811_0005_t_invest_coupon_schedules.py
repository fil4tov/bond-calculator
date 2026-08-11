"""Replace generated coupon fields with persisted T-Invest schedules.

Revision ID: 20260811_0005
Revises: 20260810_0004
"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa

revision: str = "20260811_0005"
down_revision: str | None = "20260810_0004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _create_bonds() -> None:
    op.create_table("bonds", sa.Column("id", sa.Uuid(), primary_key=True), sa.Column("user_id", sa.Uuid(), nullable=False), sa.Column("instrument_uid", sa.String(64), nullable=False), sa.Column("ticker", sa.String(32), nullable=False), sa.Column("name", sa.String(120), nullable=False), sa.Column("nominal", sa.Numeric(18, 2), nullable=False), sa.Column("payments_per_year", sa.Integer(), nullable=False), sa.Column("placement_date", sa.Date(), nullable=False), sa.Column("maturity_date", sa.Date(), nullable=False), sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False), sa.CheckConstraint("nominal > 0", name="ck_bonds_nominal_positive"), sa.CheckConstraint("payments_per_year >= 0", name="ck_bonds_payments_per_year_nonnegative"), sa.CheckConstraint("placement_date < maturity_date", name="ck_bonds_placement_before_maturity"), sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"), sa.UniqueConstraint("id", "user_id", name="uq_bonds_id_user_id"))
    op.create_index("ix_bonds_user_id", "bonds", ["user_id"])
    op.create_index("uq_bonds_user_name_normalized", "bonds", ["user_id", sa.text("lower(btrim(name))")], unique=True)


def _create_purchases() -> None:
    op.create_table("bond_purchases", sa.Column("id", sa.Uuid(), primary_key=True), sa.Column("bond_id", sa.Uuid(), nullable=False), sa.Column("user_id", sa.Uuid(), nullable=False), sa.Column("amount_spent", sa.Numeric(18, 2), nullable=False), sa.Column("quantity", sa.Integer(), nullable=False), sa.Column("purchase_date", sa.Date(), nullable=False), sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False), sa.CheckConstraint("amount_spent > 0", name="ck_bond_purchases_amount_spent_positive"), sa.CheckConstraint("quantity > 0", name="ck_bond_purchases_quantity_positive"), sa.ForeignKeyConstraint(["bond_id", "user_id"], ["bonds.id", "bonds.user_id"], ondelete="CASCADE", name="fk_bond_purchases_bond_owner"))
    op.create_index("ix_bond_purchases_bond_id", "bond_purchases", ["bond_id"])
    op.create_index("ix_bond_purchases_user_id", "bond_purchases", ["user_id"])


def upgrade() -> None:
    op.drop_table("bond_purchases")
    op.drop_table("bonds")
    _create_bonds(); _create_purchases()
    op.create_table("bond_coupon_schedules", sa.Column("id", sa.Uuid(), primary_key=True), sa.Column("bond_id", sa.Uuid(), sa.ForeignKey("bonds.id", ondelete="CASCADE"), nullable=False), sa.Column("figi", sa.String(64), nullable=False), sa.Column("coupon_date", sa.Date(), nullable=False), sa.Column("coupon_number", sa.BigInteger(), nullable=False), sa.Column("fix_date", sa.Date()), sa.Column("pay_one_bond_amount", sa.Numeric(28, 9), nullable=False), sa.Column("pay_one_bond_currency", sa.String(8), nullable=False), sa.Column("coupon_type", sa.Integer(), nullable=False), sa.Column("coupon_start_date", sa.Date(), nullable=False), sa.Column("coupon_end_date", sa.Date(), nullable=False), sa.Column("coupon_period", sa.Integer(), nullable=False), sa.CheckConstraint("pay_one_bond_amount >= 0", name="ck_bond_coupon_schedule_amount_nonnegative"), sa.CheckConstraint("coupon_period >= 0", name="ck_bond_coupon_schedule_period_nonnegative"), sa.CheckConstraint("coupon_start_date <= coupon_end_date", name="ck_bond_coupon_schedule_dates_ordered"), sa.UniqueConstraint("bond_id", "coupon_number", "coupon_date", name="uq_bond_coupon_schedule_event"))
    op.create_index("ix_bond_coupon_schedules_bond_id_coupon_date", "bond_coupon_schedules", ["bond_id", "coupon_date"])


def downgrade() -> None:
    op.drop_table("bond_coupon_schedules")
    op.drop_table("bond_purchases")
    op.drop_table("bonds")
    op.create_table("bonds", sa.Column("id", sa.Uuid(), primary_key=True), sa.Column("user_id", sa.Uuid(), nullable=False), sa.Column("name", sa.String(120), nullable=False), sa.Column("coupon_amount", sa.Numeric(18, 2), nullable=False), sa.Column("nominal", sa.Numeric(18, 2), nullable=False), sa.Column("payments_per_year", sa.Integer(), nullable=False), sa.Column("placement_date", sa.Date(), nullable=False), sa.Column("maturity_date", sa.Date(), nullable=False), sa.Column("coupon_period_days", sa.SmallInteger(), nullable=False), sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False), sa.CheckConstraint("coupon_amount >= 0", name="ck_bonds_coupon_amount_nonnegative"), sa.CheckConstraint("nominal > 0", name="ck_bonds_nominal_positive"), sa.CheckConstraint("payments_per_year IN (1, 2, 3, 4, 6, 12)", name="ck_bonds_payments_per_year"), sa.CheckConstraint("placement_date < maturity_date", name="ck_bonds_placement_before_maturity"), sa.CheckConstraint("coupon_period_days BETWEEN 1 AND 366", name="ck_bonds_coupon_period_days"), sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"), sa.UniqueConstraint("id", "user_id", name="uq_bonds_id_user_id"))
    op.create_index("ix_bonds_user_id", "bonds", ["user_id"])
    op.create_index("uq_bonds_user_name_normalized", "bonds", ["user_id", sa.text("lower(btrim(name))")], unique=True)
    _create_purchases()

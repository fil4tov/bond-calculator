from datetime import UTC, date, datetime
from decimal import Decimal
from uuid import UUID, uuid4

from sqlalchemy import BigInteger, CheckConstraint, Date, DateTime, ForeignKey, ForeignKeyConstraint, Index, Integer, Numeric, String, UniqueConstraint, Uuid, func, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


class Bond(Base):
    __tablename__ = "bonds"
    id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    instrument_uid: Mapped[str] = mapped_column(String(64), nullable=False)
    ticker: Mapped[str] = mapped_column(String(32), nullable=False)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    nominal: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    payments_per_year: Mapped[int] = mapped_column(Integer, nullable=False)
    placement_date: Mapped[date] = mapped_column(Date, nullable=False)
    maturity_date: Mapped[date] = mapped_column(Date, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(UTC), server_default=text("CURRENT_TIMESTAMP"))
    operations: Mapped[list["BondOperation"]] = relationship(
        back_populates="bond", cascade="all, delete-orphan"
    )
    coupon_schedules: Mapped[list["BondCouponSchedule"]] = relationship(back_populates="bond", cascade="all, delete-orphan")
    __table_args__ = (
        CheckConstraint("nominal > 0", name="ck_bonds_nominal_positive"),
        CheckConstraint("payments_per_year >= 0", name="ck_bonds_payments_per_year_nonnegative"),
        CheckConstraint("placement_date < maturity_date", name="ck_bonds_placement_before_maturity"),
        UniqueConstraint("id", "user_id", name="uq_bonds_id_user_id"),
        Index("uq_bonds_user_name_normalized", user_id, func.lower(func.trim(name)), unique=True),
    )


class BondOperation(Base):
    __tablename__ = "bond_operations"

    id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid4)
    bond_id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), nullable=False, index=True)
    user_id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), nullable=False, index=True)
    operation_type: Mapped[str] = mapped_column(String(8), nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    operation_date: Mapped[date] = mapped_column(Date, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(UTC),
        server_default=text("CURRENT_TIMESTAMP"),
    )
    bond: Mapped[Bond] = relationship(back_populates="operations")

    __table_args__ = (
        CheckConstraint(
            "operation_type IN ('purchase', 'sale')",
            name="ck_bond_operations_type",
        ),
        CheckConstraint("amount > 0", name="ck_bond_operations_amount_positive"),
        CheckConstraint("quantity > 0", name="ck_bond_operations_quantity_positive"),
        ForeignKeyConstraint(
            ["bond_id", "user_id"],
            ["bonds.id", "bonds.user_id"],
            ondelete="CASCADE",
            name="fk_bond_operations_bond_owner",
        ),
        Index("ix_bond_operations_bond_id_operation_date", "bond_id", "operation_date"),
    )


class BondCouponSchedule(Base):
    __tablename__ = "bond_coupon_schedules"
    id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid4)
    bond_id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), ForeignKey("bonds.id", ondelete="CASCADE"), nullable=False)
    figi: Mapped[str] = mapped_column(String(64), nullable=False)
    coupon_date: Mapped[date] = mapped_column(Date, nullable=False)
    coupon_number: Mapped[int] = mapped_column(BigInteger, nullable=False)
    fix_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    pay_one_bond_amount: Mapped[Decimal] = mapped_column(Numeric(28, 9), nullable=False)
    pay_one_bond_currency: Mapped[str] = mapped_column(String(8), nullable=False)
    coupon_type: Mapped[int] = mapped_column(Integer, nullable=False)
    coupon_start_date: Mapped[date] = mapped_column(Date, nullable=False)
    coupon_end_date: Mapped[date] = mapped_column(Date, nullable=False)
    coupon_period: Mapped[int] = mapped_column(Integer, nullable=False)
    bond: Mapped[Bond] = relationship(back_populates="coupon_schedules")
    __table_args__ = (
        CheckConstraint("pay_one_bond_amount >= 0", name="ck_bond_coupon_schedule_amount_nonnegative"),
        CheckConstraint("coupon_period >= 0", name="ck_bond_coupon_schedule_period_nonnegative"),
        CheckConstraint("coupon_start_date <= coupon_end_date", name="ck_bond_coupon_schedule_dates_ordered"),
        UniqueConstraint("bond_id", "coupon_number", "coupon_date", name="uq_bond_coupon_schedule_event"),
        Index("ix_bond_coupon_schedules_bond_id_coupon_date", "bond_id", "coupon_date"),
    )

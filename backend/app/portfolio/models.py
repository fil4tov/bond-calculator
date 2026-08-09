from datetime import UTC, date, datetime
from decimal import Decimal
from uuid import UUID, uuid4

from sqlalchemy import (
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    ForeignKeyConstraint,
    Index,
    Integer,
    Numeric,
    SmallInteger,
    String,
    UniqueConstraint,
    Uuid,
    func,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


class Bond(Base):
    __tablename__ = "bonds"

    id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    coupon_amount: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    nominal: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    payments_per_year: Mapped[int] = mapped_column(Integer, nullable=False)
    placement_date: Mapped[date] = mapped_column(Date, nullable=False)
    maturity_date: Mapped[date] = mapped_column(Date, nullable=False)
    coupon_period_days: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(UTC),
        server_default=text("CURRENT_TIMESTAMP"),
    )
    purchases: Mapped[list["BondPurchase"]] = relationship(
        back_populates="bond", cascade="all, delete-orphan"
    )

    __table_args__ = (
        CheckConstraint("coupon_amount >= 0", name="ck_bonds_coupon_amount_nonnegative"),
        CheckConstraint("nominal > 0", name="ck_bonds_nominal_positive"),
        CheckConstraint(
            "payments_per_year IN (1, 2, 3, 4, 6, 12)", name="ck_bonds_payments_per_year"
        ),
        CheckConstraint(
            "placement_date < maturity_date",
            name="ck_bonds_placement_before_maturity",
        ),
        CheckConstraint(
            "coupon_period_days BETWEEN 1 AND 366",
            name="ck_bonds_coupon_period_days",
        ),
        UniqueConstraint("id", "user_id", name="uq_bonds_id_user_id"),
        Index("uq_bonds_user_name_normalized", user_id, func.lower(func.trim(name)), unique=True),
    )


class BondPurchase(Base):
    __tablename__ = "bond_purchases"

    id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid4)
    bond_id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), nullable=False, index=True)
    user_id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), nullable=False, index=True)
    amount_spent: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    purchase_date: Mapped[date] = mapped_column(Date, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(UTC),
        server_default=text("CURRENT_TIMESTAMP"),
    )
    bond: Mapped[Bond] = relationship(back_populates="purchases")

    __table_args__ = (
        CheckConstraint("amount_spent > 0", name="ck_bond_purchases_amount_spent_positive"),
        CheckConstraint("quantity > 0", name="ck_bond_purchases_quantity_positive"),
        ForeignKeyConstraint(
            ["bond_id", "user_id"],
            ["bonds.id", "bonds.user_id"],
            ondelete="CASCADE",
            name="fk_bond_purchases_bond_owner",
        ),
    )

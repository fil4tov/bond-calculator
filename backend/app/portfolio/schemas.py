import re
from datetime import date
from decimal import Decimal
from typing import Annotated, Literal
from uuid import UUID

from pydantic import (
    BaseModel,
    BeforeValidator,
    Field,
    StringConstraints,
    ValidationInfo,
    field_validator,
)

from . import clock
from .calculations import coupon_period_count, infer_coupon_period_days


def _trim(value: object) -> object:
    return value.strip() if isinstance(value, str) else value


def _parse_money(value: object) -> Decimal:
    if not isinstance(value, str) or re.fullmatch(r"\d+(?:\.\d{1,2})?", value) is None:
        raise ValueError("Money must be a plain decimal string with at most two fractional digits")
    return Decimal(value)


BondName = Annotated[
    str, BeforeValidator(_trim), StringConstraints(min_length=1, max_length=120)
]
NonnegativeMoney = Annotated[
    Decimal,
    BeforeValidator(_parse_money),
    Field(ge=0, max_digits=18, decimal_places=2),
]
PositiveMoney = Annotated[
    Decimal,
    BeforeValidator(_parse_money),
    Field(gt=0, max_digits=18, decimal_places=2),
]
PositiveQuantity = Annotated[int, Field(strict=True, gt=0, le=2_147_483_647)]
PaymentFrequency = Literal[1, 2, 3, 4, 6, 12]


class BondCreate(BaseModel):
    name: BondName
    coupon_amount: NonnegativeMoney
    nominal: PositiveMoney
    payments_per_year: PaymentFrequency
    placement_date: date
    maturity_date: date
    coupon_period_days: int | None = Field(
        default=None,
        validate_default=True,
        strict=True,
        ge=1,
        le=366,
    )
    amount_spent: PositiveMoney
    quantity: PositiveQuantity
    purchase_date: date

    @field_validator("placement_date")
    @classmethod
    def validate_placement_date(cls, value: date) -> date:
        if value > clock.utc_today():
            raise ValueError("placement_date must not be after today")
        return value

    @field_validator("maturity_date")
    @classmethod
    def validate_maturity_date(cls, value: date, info: ValidationInfo) -> date:
        if value <= clock.utc_today():
            raise ValueError("maturity_date must be after today")
        placement_date = info.data.get("placement_date")
        if isinstance(placement_date, date) and value <= placement_date:
            raise ValueError("maturity_date must be after placement_date")
        return value

    @field_validator("coupon_period_days")
    @classmethod
    def resolve_coupon_period_days(cls, value: int | None, info: ValidationInfo) -> int:
        frequency = info.data.get("payments_per_year")
        placement = info.data.get("placement_date")
        maturity = info.data.get("maturity_date")
        if not isinstance(frequency, int) or not isinstance(placement, date) or not isinstance(
            maturity, date
        ):
            return value if value is not None else 1
        resolved = value if value is not None else infer_coupon_period_days(frequency)
        count = coupon_period_count(
            placement_date=placement,
            maturity_date=maturity,
            payments_per_year=frequency,
        )
        lifetime_days = (maturity - placement).days
        if resolved * (count - 1) >= lifetime_days:
            raise ValueError("coupon_period_days is incompatible with bond dates")
        return resolved

    @field_validator("purchase_date")
    @classmethod
    def validate_purchase_date(cls, value: date, info: ValidationInfo) -> date:
        if value > clock.utc_today():
            raise ValueError("purchase_date must not be after today")
        placement_date = info.data.get("placement_date")
        if isinstance(placement_date, date) and value < placement_date:
            raise ValueError("purchase_date must not be before placement_date")
        maturity_date = info.data.get("maturity_date")
        if isinstance(maturity_date, date) and value >= maturity_date:
            raise ValueError("purchase_date must be before maturity_date")
        return value


class PurchaseCreate(BaseModel):
    amount_spent: PositiveMoney
    quantity: PositiveQuantity
    purchase_date: date

    @field_validator("purchase_date")
    @classmethod
    def validate_purchase_date(cls, value: date) -> date:
        if value > clock.utc_today():
            raise ValueError("purchase_date must not be after today")
        return value


class MaturityRemaining(BaseModel):
    years: int
    months: int
    days_until: int


class NextCoupon(BaseModel):
    period_start: date
    period_end: date
    pay_date: date
    amount: str
    days_until: int
    period_days: int
    elapsed_period_days: int


class BondCard(BaseModel):
    id: UUID
    name: str
    coupon_amount: str
    nominal: str
    payments_per_year: int
    placement_date: date
    maturity_date: date
    coupon_period_days: int
    status: Literal["active", "payment_pending", "matured"]
    total_quantity: int
    total_spent: str
    paid_coupon_total: str
    annual_coupon_yield_percent: str
    maturity_remaining: MaturityRemaining
    next_coupon: NextCoupon | None


class BondList(BaseModel):
    items: list[BondCard]


class NameAvailability(BaseModel):
    available: bool

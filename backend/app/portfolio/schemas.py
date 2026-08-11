import re
from datetime import date
from decimal import Decimal
from typing import Annotated, Literal
from uuid import UUID

from pydantic import BaseModel, BeforeValidator, Field, StringConstraints, ValidationInfo, field_validator

from . import clock


def _trim(value: object) -> object:
    return value.strip() if isinstance(value, str) else value


def _parse_money(value: object) -> Decimal:
    if not isinstance(value, str) or re.fullmatch(r"\d+(?:\.\d{1,2})?", value) is None:
        raise ValueError("Money must be a plain decimal string with at most two fractional digits")
    return Decimal(value)


BondName = Annotated[str, BeforeValidator(_trim), StringConstraints(min_length=1, max_length=120)]
Ticker = Annotated[str, BeforeValidator(_trim), StringConstraints(min_length=1, max_length=32)]
InstrumentUid = Annotated[str, BeforeValidator(_trim), StringConstraints(min_length=1, max_length=64)]
PositiveMoney = Annotated[Decimal, BeforeValidator(_parse_money), Field(gt=0, max_digits=18, decimal_places=2)]
PositiveQuantity = Annotated[int, Field(strict=True, gt=0, le=2_147_483_647)]


class BondCreate(BaseModel):
    instrument_uid: InstrumentUid
    ticker: Ticker
    name: BondName
    nominal: PositiveMoney
    payments_per_year: int = Field(strict=True, ge=0)
    placement_date: date
    maturity_date: date
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


class SaleCreate(BaseModel):
    amount_received: PositiveMoney
    quantity: PositiveQuantity
    sale_date: date

    @field_validator("sale_date")
    @classmethod
    def validate_sale_date(cls, value: date) -> date:
        if value > clock.utc_today():
            raise ValueError("sale_date must not be after today")
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
    amount_per_bond: str
    days_until: int
    period_days: int
    elapsed_period_days: int


class BondOperationItem(BaseModel):
    id: UUID
    operation_type: Literal["purchase", "sale"]
    amount: str
    realized_result: str | None
    quantity: int
    operation_date: date


class BondCard(BaseModel):
    id: UUID
    instrument_uid: str
    ticker: str
    name: str
    nominal: str
    payments_per_year: int
    placement_date: date
    maturity_date: date
    status: Literal["active", "payment_pending", "matured"]
    total_quantity: int
    total_spent: str
    position_cost_basis: str
    realized_result: str
    position_status: Literal["open", "closed"]
    paid_coupon_total: str
    calendar_year_coupon_yield_percent: str
    coupon_yield_year: int
    maturity_remaining: MaturityRemaining
    next_coupon: NextCoupon | None
    operations: list[BondOperationItem]


class BondList(BaseModel):
    items: list[BondCard]


class OperationDeleteResponse(BaseModel):
    item: BondCard | None


class NameAvailability(BaseModel):
    available: bool


class TInvestLookupItem(BaseModel):
    ticker: str
    instrument_uid: str
    name: str
    nominal: str
    payments_per_year: int
    placement_date: date
    maturity_date: date


class TInvestLookupResponse(BaseModel):
    item: TInvestLookupItem | None


class TInvestSearchItem(BaseModel):
    ticker: str
    instrument_uid: str
    name: str


class TInvestSearchResponse(BaseModel):
    items: list[TInvestSearchItem]

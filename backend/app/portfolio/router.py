from decimal import Decimal, ROUND_HALF_UP
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Response, status

from app.auth.dependencies import CurrentUser, Database
from app.config import get_settings
from app.errors import ApiError

from . import clock
from .schemas import (
    BondCard,
    BondCreate,
    BondList,
    BondName,
    NameAvailability,
    PurchaseCreate,
    OperationDeleteResponse,
    SaleCreate,
    TInvestLookupItem,
    TInvestLookupResponse,
    TInvestSearchItem,
    TInvestSearchResponse,
)
from .service import (
    add_purchase,
    add_sale,
    create_bond,
    delete_bond,
    delete_operation,
    is_name_available,
    list_bonds,
    refresh_coupon_schedule,
)
from .t_invest_gateway import TInvestGateway

router = APIRouter(prefix="/api/portfolio", tags=["portfolio"])


def _disable_cache(response: Response) -> None:
    response.headers["Cache-Control"] = "no-store"


def get_t_invest_gateway() -> TInvestGateway:
    return TInvestGateway(api_key=get_settings().t_invest_api_key)


@router.get("/bonds/t-invest-lookup", response_model=TInvestLookupResponse)
async def t_invest_lookup(
    response: Response,
    user: CurrentUser,
    instrument_uid: Annotated[str, Query()],
    gateway: TInvestGateway = Depends(get_t_invest_gateway),
) -> TInvestLookupResponse:
    del user
    normalized_uid = instrument_uid.strip()
    if not 1 <= len(normalized_uid) <= 64:
        raise ApiError(
            status_code=422,
            code="validation_error",
            message="Request validation failed",
            field_errors={
                "instrument_uid": "Instrument UID must contain between 1 and 64 characters"
            },
        )
    bond = await gateway.lookup_bond(normalized_uid)
    _disable_cache(response)
    if bond is None:
        return TInvestLookupResponse(item=None)
    today = clock.utc_today()
    if bond.placement_date > today:
        raise ApiError(
            status_code=422,
            code="t_invest_bond_not_placed",
            message="Bond has not been placed yet",
        )
    if bond.maturity_date <= today:
        raise ApiError(
            status_code=422,
            code="t_invest_bond_matured",
            message="Bond has already matured",
        )
    return TInvestLookupResponse(item=TInvestLookupItem(ticker=bond.ticker, instrument_uid=bond.instrument_uid, name=bond.name, nominal=f"{bond.nominal.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP):.2f}", payments_per_year=bond.payments_per_year, placement_date=bond.placement_date, maturity_date=bond.maturity_date))


@router.get("/bonds/t-invest-search", response_model=TInvestSearchResponse)
async def t_invest_search(
    response: Response,
    user: CurrentUser,
    query: Annotated[str, Query()],
    gateway: TInvestGateway = Depends(get_t_invest_gateway),
) -> TInvestSearchResponse:
    del user
    normalized_query = query.strip()
    if not 2 <= len(normalized_query) <= 120:
        raise ApiError(
            status_code=422,
            code="validation_error",
            message="Request validation failed",
            field_errors={"query": "Search query must contain between 2 and 120 characters"},
        )
    bonds = await gateway.search_bonds(normalized_query)
    _disable_cache(response)
    return TInvestSearchResponse(
        items=[
            TInvestSearchItem(
                ticker=bond.ticker,
                instrument_uid=bond.instrument_uid,
                name=bond.name,
            )
            for bond in bonds
        ]
    )


@router.get("/bonds", response_model=BondList)
async def get_bonds(
    response: Response,
    db: Database,
    user: CurrentUser,
    gateway: TInvestGateway = Depends(get_t_invest_gateway),
) -> BondList:
    _disable_cache(response)
    return BondList(items=await list_bonds(db, user.id, today=clock.utc_today(), gateway=gateway))


@router.get("/bonds/name-availability", response_model=NameAvailability)
async def get_name_availability(
    response: Response,
    db: Database,
    user: CurrentUser,
    name: Annotated[BondName, Query()],
) -> NameAvailability:
    _disable_cache(response)
    return NameAvailability(available=await is_name_available(db, user.id, name))


@router.post("/bonds", response_model=BondCard, status_code=status.HTTP_201_CREATED)
async def post_bond(
    data: BondCreate, response: Response, db: Database, user: CurrentUser,
    gateway: TInvestGateway = Depends(get_t_invest_gateway),
) -> BondCard:
    card = await create_bond(db, user.id, data, gateway)
    _disable_cache(response)
    return card


@router.post(
    "/bonds/{bond_id}/purchases",
    response_model=BondCard,
    status_code=status.HTTP_201_CREATED,
)
async def post_purchase(
    bond_id: UUID,
    data: PurchaseCreate,
    response: Response,
    db: Database,
    user: CurrentUser,
) -> BondCard:
    card = await add_purchase(db, user.id, bond_id, data)
    _disable_cache(response)
    return card


@router.post(
    "/bonds/{bond_id}/sales",
    response_model=BondCard,
    status_code=status.HTTP_201_CREATED,
)
async def post_sale(
    bond_id: UUID,
    data: SaleCreate,
    response: Response,
    db: Database,
    user: CurrentUser,
) -> BondCard:
    card = await add_sale(db, user.id, bond_id, data)
    _disable_cache(response)
    return card


@router.post(
    "/bonds/{bond_id}/coupon-schedule/refresh",
    response_model=BondCard,
)
async def post_coupon_schedule_refresh(
    bond_id: UUID,
    response: Response,
    db: Database,
    user: CurrentUser,
    gateway: TInvestGateway = Depends(get_t_invest_gateway),
) -> BondCard:
    card = await refresh_coupon_schedule(db, user.id, bond_id, gateway)
    _disable_cache(response)
    return card


@router.delete(
    "/bonds/{bond_id}/operations/{operation_id}",
    response_model=OperationDeleteResponse,
)
async def delete_portfolio_operation(
    bond_id: UUID,
    operation_id: UUID,
    response: Response,
    db: Database,
    user: CurrentUser,
) -> OperationDeleteResponse:
    result = await delete_operation(db, user.id, bond_id, operation_id)
    _disable_cache(response)
    return result


@router.delete("/bonds/{bond_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_portfolio_bond(
    bond_id: UUID,
    response: Response,
    db: Database,
    user: CurrentUser,
) -> None:
    await delete_bond(db, user.id, bond_id)
    _disable_cache(response)

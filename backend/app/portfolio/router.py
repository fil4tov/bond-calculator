from decimal import Decimal, ROUND_HALF_UP
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Response, status

from app.auth.dependencies import CurrentUser, Database

from . import clock
from .schemas import (
    BondCard,
    BondCreate,
    BondList,
    BondName,
    NameAvailability,
    PurchaseCreate,
    TInvestLookupItem,
    TInvestLookupResponse,
)
from .service import add_purchase, create_bond, delete_bond, is_name_available, list_bonds
from .t_invest_gateway import TInvestGateway
from app.config import get_settings

router = APIRouter(prefix="/api/portfolio", tags=["portfolio"])


def _disable_cache(response: Response) -> None:
    response.headers["Cache-Control"] = "no-store"


def get_t_invest_gateway() -> TInvestGateway:
    return TInvestGateway(api_key=get_settings().t_invest_api_key)


@router.get("/bonds/t-invest-lookup", response_model=TInvestLookupResponse)
async def t_invest_lookup(
    response: Response,
    user: CurrentUser,
    ticker: Annotated[str, Query(min_length=1)],
    gateway: TInvestGateway = Depends(get_t_invest_gateway),
) -> TInvestLookupResponse:
    del user
    bond = await gateway.lookup_bond(ticker.strip().upper())
    _disable_cache(response)
    if bond is None:
        return TInvestLookupResponse(item=None)
    return TInvestLookupResponse(item=TInvestLookupItem(ticker=bond.ticker, instrument_uid=bond.instrument_uid, name=bond.name, nominal=f"{bond.nominal.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP):.2f}", payments_per_year=bond.payments_per_year, placement_date=bond.placement_date, maturity_date=bond.maturity_date))


@router.get("/bonds", response_model=BondList)
async def get_bonds(response: Response, db: Database, user: CurrentUser) -> BondList:
    _disable_cache(response)
    return BondList(items=await list_bonds(db, user.id, today=clock.utc_today()))


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


@router.delete("/bonds/{bond_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_portfolio_bond(
    bond_id: UUID,
    response: Response,
    db: Database,
    user: CurrentUser,
) -> None:
    await delete_bond(db, user.id, bond_id)
    _disable_cache(response)

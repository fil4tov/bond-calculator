from typing import Annotated

from fastapi import Cookie, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.db import get_db
from app.users.models import User

from .service import get_session_user

Database = Annotated[AsyncSession, Depends(get_db)]
SessionCookie = Annotated[str | None, Cookie(alias=get_settings().session_cookie_name)]


async def get_current_user(db: Database, session_token: SessionCookie = None) -> User:
    return await get_session_user(db, session_token)


CurrentUser = Annotated[User, Depends(get_current_user)]

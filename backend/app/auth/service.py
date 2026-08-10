from datetime import UTC, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import get_settings
from app.errors import ApiError
from app.users.models import User

from .models import AuthSession
from .schemas import Credentials
from .security import (
    DUMMY_PASSWORD_HASH,
    digest_session_token,
    generate_session_token,
    hash_password,
    verify_password,
)


def _session_expiry() -> datetime:
    return datetime.now(UTC) + timedelta(days=get_settings().session_days)


def _as_utc(value: datetime) -> datetime:
    return value if value.tzinfo is not None else value.replace(tzinfo=UTC)


def _new_session(user: User) -> tuple[AuthSession, str]:
    token = generate_session_token()
    return (
        AuthSession(
            user=user,
            token_hash=digest_session_token(token),
            expires_at=_session_expiry(),
        ),
        token,
    )


async def register_user(db: AsyncSession, credentials: Credentials) -> tuple[User, str]:
    user = User(username=credentials.username, password_hash=hash_password(credentials.password))
    auth_session, token = _new_session(user)
    db.add_all([user, auth_session])
    try:
        await db.commit()
    except IntegrityError as error:
        await db.rollback()
        raise ApiError(
            status_code=409,
            code="username_taken",
            message="Username is already taken",
            field_errors={"username": "Username is already taken"},
        ) from error
    await db.refresh(user)
    return user, token


async def login_user(db: AsyncSession, credentials: Credentials) -> tuple[User, str]:
    user = await db.scalar(
        select(User).where(func.lower(User.username) == credentials.username.lower())
    )
    encoded = user.password_hash if user is not None else DUMMY_PASSWORD_HASH
    valid = verify_password(credentials.password, encoded)
    if user is None or not valid:
        raise ApiError(
            status_code=401,
            code="invalid_credentials",
            message="Invalid username or password",
        )

    auth_session, token = _new_session(user)
    db.add(auth_session)
    await db.commit()
    return user, token


async def get_session_user(db: AsyncSession, token: str | None) -> User:
    if not token:
        raise ApiError(
            status_code=401,
            code="unauthenticated",
            message="Authentication required",
            clear_session=True,
        )
    auth_session = await db.scalar(
        select(AuthSession)
        .options(selectinload(AuthSession.user))
        .where(AuthSession.token_hash == digest_session_token(token))
    )
    if auth_session is None:
        raise ApiError(
            status_code=401,
            code="unauthenticated",
            message="Authentication required",
            clear_session=True,
        )
    if _as_utc(auth_session.expires_at) <= datetime.now(UTC):
        await db.delete(auth_session)
        await db.commit()
        raise ApiError(
            status_code=401,
            code="unauthenticated",
            message="Authentication required",
            clear_session=True,
        )
    return auth_session.user


async def revoke_session(db: AsyncSession, token: str | None) -> None:
    if not token:
        return
    auth_session = await db.scalar(
        select(AuthSession).where(AuthSession.token_hash == digest_session_token(token))
    )
    if auth_session is not None:
        await db.delete(auth_session)
        await db.commit()

from fastapi import APIRouter, Response, status

from app.config import Settings, get_settings
from app.users.schemas import UserRead

from .dependencies import CurrentUser, Database, SessionCookie
from .schemas import Credentials
from .service import login_user, register_user, revoke_session

router = APIRouter(prefix="/api/auth", tags=["auth"])
def _set_session_cookie(response: Response, token: str, settings: Settings) -> None:
    max_age = settings.session_days * 24 * 60 * 60
    response.set_cookie(
        key=settings.session_cookie_name,
        value=token,
        max_age=max_age,
        path="/api",
        secure=settings.cookie_secure,
        httponly=True,
        samesite="lax",
    )
    response.headers["Cache-Control"] = "no-store"


@router.post("/register", response_model=UserRead, status_code=status.HTTP_201_CREATED)
async def register(credentials: Credentials, response: Response, db: Database) -> UserRead:
    user, token = await register_user(db, credentials)
    _set_session_cookie(response, token, get_settings())
    return UserRead.model_validate(user)


@router.post("/login", response_model=UserRead)
async def login(credentials: Credentials, response: Response, db: Database) -> UserRead:
    user, token = await login_user(db, credentials)
    _set_session_cookie(response, token, get_settings())
    return UserRead.model_validate(user)


@router.get("/me", response_model=UserRead)
async def current_user(
    response: Response,
    user: CurrentUser,
) -> UserRead:
    response.headers["Cache-Control"] = "no-store"
    return UserRead.model_validate(user)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(db: Database, session_token: SessionCookie = None) -> Response:
    await revoke_session(db, session_token)
    response = Response(status_code=status.HTTP_204_NO_CONTENT)
    response.delete_cookie(get_settings().session_cookie_name, path="/api")
    response.headers["Cache-Control"] = "no-store"
    return response

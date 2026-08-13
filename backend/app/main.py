import logging

from fastapi import Depends, FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.auth import router as auth_router
from app.config import get_settings
from app.db import get_db
from app.errors import ApiError
from app.portfolio import router as portfolio_router

logger = logging.getLogger(__name__)
app = FastAPI(title="Bonds API")
app.include_router(auth_router)
app.include_router(portfolio_router)


@app.exception_handler(ApiError)
async def api_error_handler(_request: Request, error: ApiError) -> JSONResponse:
    response = JSONResponse(status_code=error.status_code, content=error.payload())
    response.headers["Cache-Control"] = "no-store"
    if error.clear_session:
        response.delete_cookie(get_settings().session_cookie_name, path="/api")
    return response


@app.exception_handler(StarletteHTTPException)
async def http_error_handler(
    _request: Request,
    error: StarletteHTTPException,
) -> JSONResponse:
    if error.status_code == 404:
        code, message = "not_found", "Not found"
    elif error.status_code == 405:
        code, message = "method_not_allowed", "Method not allowed"
    else:
        code, message = "request_failed", str(error.detail)
    return JSONResponse(
        status_code=error.status_code,
        content={"code": code, "message": message},
        headers={"Cache-Control": "no-store"},
    )


@app.exception_handler(RequestValidationError)
async def validation_error_handler(
    _request: Request,
    error: RequestValidationError,
) -> JSONResponse:
    field_errors: dict[str, str] = {}
    for item in error.errors():
        location = item.get("loc", ())
        field = str(location[-1]) if location else "request"
        field_errors.setdefault(field, str(item.get("msg", "Invalid value")))
    return JSONResponse(
        status_code=422,
        content={
            "code": "validation_error",
            "message": "Request validation failed",
            "field_errors": field_errors,
        },
        headers={"Cache-Control": "no-store"},
    )


@app.exception_handler(Exception)
async def unhandled_error_handler(_request: Request, error: Exception) -> JSONResponse:
    logger.error(
        "Unhandled API error",
        exc_info=(type(error), error, error.__traceback__),
    )
    return JSONResponse(
        status_code=500,
        content={"code": "internal_error", "message": "Internal server error"},
        headers={"Cache-Control": "no-store"},
    )


@app.get("/api/health")
async def health(db: AsyncSession = Depends(get_db)) -> dict[str, str]:
    await db.execute(text("SELECT 1"))
    return {"status": "ok"}

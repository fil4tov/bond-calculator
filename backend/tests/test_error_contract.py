import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app


@app.get("/api/test-unhandled-error", include_in_schema=False)
async def raise_unhandled_error() -> None:
    raise RuntimeError("database details must not leak")


@pytest.mark.asyncio
async def test_not_found_uses_the_stable_error_contract(client: AsyncClient) -> None:
    response = await client.get("/api/missing")

    assert response.status_code == 404
    assert response.json() == {"code": "not_found", "message": "Not found"}
    assert response.headers["cache-control"] == "no-store"


@pytest.mark.asyncio
async def test_unhandled_error_is_masked_by_the_stable_error_contract() -> None:
    async with AsyncClient(
        transport=ASGITransport(app=app, raise_app_exceptions=False),
        base_url="http://testserver",
    ) as client:
        response = await client.get("/api/test-unhandled-error")

    assert response.status_code == 500
    assert response.json() == {
        "code": "internal_error",
        "message": "Internal server error",
    }
    assert response.headers["cache-control"] == "no-store"


from datetime import UTC, datetime, timedelta

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.auth.models import AuthSession
from app.users.models import User


@pytest.mark.asyncio
async def test_registration_creates_user_session_and_restores_current_user(
    client: AsyncClient,
    session_factory: async_sessionmaker[AsyncSession],
) -> None:
    response = await client.post(
        "/api/auth/register",
        json={"username": "  Moxxie_1  ", "password": "correct horse"},
    )

    assert response.status_code == 201
    assert response.json() == {"id": response.json()["id"], "username": "Moxxie_1"}
    set_cookie = response.headers["set-cookie"].lower()
    assert "bonds_session=" in set_cookie
    assert "httponly" in set_cookie
    assert "samesite=lax" in set_cookie
    assert "path=/api" in set_cookie
    assert "max-age=2592000" in set_cookie
    assert response.headers["cache-control"] == "no-store"

    me = await client.get("/api/auth/me")
    assert me.status_code == 200
    assert me.json() == response.json()

    async with session_factory() as session:
        user = (await session.scalars(select(User))).one()
        assert user.password_hash != "correct horse"
        assert user.password_hash.startswith("$argon2")


@pytest.mark.asyncio
async def test_registration_rejects_username_with_different_case(client: AsyncClient) -> None:
    first = await client.post(
        "/api/auth/register",
        json={"username": "BondOwner", "password": "password123"},
    )
    duplicate = await client.post(
        "/api/auth/register",
        json={"username": "bondowner", "password": "password456"},
    )

    assert first.status_code == 201
    assert duplicate.status_code == 409
    assert duplicate.json() == {
        "code": "username_taken",
        "message": "Username is already taken",
        "field_errors": {"username": "Username is already taken"},
    }


@pytest.mark.asyncio
async def test_registration_allows_different_usernames(client: AsyncClient) -> None:
    first = await client.post(
        "/api/auth/register",
        json={"username": "FirstOwner", "password": "password123"},
    )
    second = await client.post(
        "/api/auth/register",
        json={"username": "SecondOwner", "password": "password456"},
    )

    assert first.status_code == 201
    assert second.status_code == 201
    assert second.json()["username"] == "SecondOwner"


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("payload", "field"),
    [
        ({"username": "ab", "password": "password123"}, "username"),
        ({"username": "bad login", "password": "password123"}, "username"),
        ({"username": "valid_name", "password": "short"}, "password"),
    ],
)
async def test_registration_returns_stable_validation_errors(
    client: AsyncClient,
    payload: dict[str, str],
    field: str,
) -> None:
    response = await client.post("/api/auth/register", json=payload)

    assert response.status_code == 422
    body = response.json()
    assert body["code"] == "validation_error"
    assert body["message"] == "Request validation failed"
    assert field in body["field_errors"]


@pytest.mark.asyncio
async def test_login_uses_same_error_for_unknown_user_and_wrong_password(client: AsyncClient) -> None:
    await client.post(
        "/api/auth/register",
        json={"username": "KnownUser", "password": "password123"},
    )
    await client.post("/api/auth/logout")

    wrong_password = await client.post(
        "/api/auth/login",
        json={"username": "knownuser", "password": "not-the-password"},
    )
    unknown_user = await client.post(
        "/api/auth/login",
        json={"username": "UnknownUser", "password": "not-the-password"},
    )

    expected = {"code": "invalid_credentials", "message": "Invalid username or password"}
    assert wrong_password.status_code == 401
    assert wrong_password.json() == expected
    assert unknown_user.status_code == 401
    assert unknown_user.json() == expected


@pytest.mark.asyncio
async def test_logout_revokes_only_the_current_session(
    client: AsyncClient,
    session_factory: async_sessionmaker[AsyncSession],
) -> None:
    await client.post(
        "/api/auth/register",
        json={"username": "Investor", "password": "password123"},
    )
    second = AsyncClient(transport=client._transport, base_url="http://testserver")
    try:
        login = await second.post(
            "/api/auth/login",
            json={"username": "investor", "password": "password123"},
        )
        assert login.status_code == 200

        logout = await client.post("/api/auth/logout")
        assert logout.status_code == 204
        assert "max-age=0" in logout.headers["set-cookie"].lower()
        assert (await client.get("/api/auth/me")).status_code == 401
        assert (await second.get("/api/auth/me")).status_code == 200

        async with session_factory() as session:
            sessions = list(await session.scalars(select(AuthSession)))
            assert len(sessions) == 1
    finally:
        await second.aclose()


@pytest.mark.asyncio
async def test_expired_session_is_rejected_and_removed(
    client: AsyncClient,
    session_factory: async_sessionmaker[AsyncSession],
) -> None:
    await client.post(
        "/api/auth/register",
        json={"username": "ExpiredUser", "password": "password123"},
    )
    async with session_factory() as session:
        auth_session = (await session.scalars(select(AuthSession))).one()
        auth_session.expires_at = datetime.now(UTC) - timedelta(seconds=1)
        await session.commit()

    response = await client.get("/api/auth/me")

    assert response.status_code == 401
    assert response.json()["code"] == "unauthenticated"
    assert "max-age=0" in response.headers["set-cookie"].lower()
    async with session_factory() as session:
        assert list(await session.scalars(select(AuthSession))) == []


@pytest.mark.asyncio
async def test_health_checks_database(client: AsyncClient) -> None:
    response = await client.get("/api/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}

"""
Tests for auth endpoints: register, login, refresh, logout, me, change-password.
"""

import pytest
from httpx import AsyncClient


# ── Test data ─────────────────────────────────────────────────────────────────
VALID_USER = {
    "full_name": "Test User",
    "email": "test@example.com",
    "password": "Passw0rd!",
    "phone": "9876543210",
}


# ── Registration ──────────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_register_success(client: AsyncClient) -> None:
    resp = await client.post("/api/v1/auth/register", json=VALID_USER)
    assert resp.status_code == 201
    data = resp.json()
    assert data["email"] == VALID_USER["email"]
    assert "id" in data


@pytest.mark.asyncio
async def test_register_duplicate_email(client: AsyncClient) -> None:
    await client.post("/api/v1/auth/register", json=VALID_USER)
    resp = await client.post("/api/v1/auth/register", json=VALID_USER)
    assert resp.status_code == 409
    assert resp.json()["code"] == "CONFLICT"


@pytest.mark.asyncio
async def test_register_weak_password(client: AsyncClient) -> None:
    payload = {**VALID_USER, "email": "weak@example.com", "password": "password"}
    resp = await client.post("/api/v1/auth/register", json=payload)
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_register_invalid_email(client: AsyncClient) -> None:
    payload = {**VALID_USER, "email": "not-an-email"}
    resp = await client.post("/api/v1/auth/register", json=payload)
    assert resp.status_code == 422


# ── Login ─────────────────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_login_success(client: AsyncClient) -> None:
    await client.post("/api/v1/auth/register", json=VALID_USER)
    resp = await client.post(
        "/api/v1/auth/login",
        json={"email": VALID_USER["email"], "password": VALID_USER["password"]},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"


@pytest.mark.asyncio
async def test_login_wrong_password(client: AsyncClient) -> None:
    await client.post("/api/v1/auth/register", json=VALID_USER)
    resp = await client.post(
        "/api/v1/auth/login",
        json={"email": VALID_USER["email"], "password": "WrongPass1!"},
    )
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_login_unknown_email(client: AsyncClient) -> None:
    resp = await client.post(
        "/api/v1/auth/login",
        json={"email": "nobody@example.com", "password": "Passw0rd!"},
    )
    assert resp.status_code == 401


# ── Protected routes ──────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_get_me_authenticated(client: AsyncClient) -> None:
    await client.post("/api/v1/auth/register", json=VALID_USER)
    login_resp = await client.post(
        "/api/v1/auth/login",
        json={"email": VALID_USER["email"], "password": VALID_USER["password"]},
    )
    token = login_resp.json()["access_token"]

    me_resp = await client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert me_resp.status_code == 200
    assert me_resp.json()["email"] == VALID_USER["email"]


@pytest.mark.asyncio
async def test_get_me_unauthenticated(client: AsyncClient) -> None:
    resp = await client.get("/api/v1/auth/me")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_get_me_invalid_token(client: AsyncClient) -> None:
    resp = await client.get(
        "/api/v1/auth/me",
        headers={"Authorization": "Bearer invalid.token.here"},
    )
    assert resp.status_code == 401


# ── Profile update ────────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_update_profile(client: AsyncClient) -> None:
    await client.post("/api/v1/auth/register", json=VALID_USER)
    login_resp = await client.post(
        "/api/v1/auth/login",
        json={"email": VALID_USER["email"], "password": VALID_USER["password"]},
    )
    token = login_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    resp = await client.patch(
        "/api/v1/auth/me",
        json={"full_name": "Updated Name"},
        headers=headers,
    )
    assert resp.status_code == 200
    assert resp.json()["full_name"] == "Updated Name"


# ── Health check ──────────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_health_check(client: AsyncClient) -> None:
    resp = await client.get("/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"

"""
Tests for transaction endpoints: CRUD, permissions, search, filters, pagination, monthly summary.
"""

import pytest
from datetime import date
from httpx import AsyncClient


# ── Test data ─────────────────────────────────────────────────────────────────
VALID_USER = {
    "full_name": "Test User",
    "email": "test@example.com",
    "password": "Passw0rd!",
    "phone": "9876543210",
}

VALID_TRANSACTION = {
    "description": "Grocery shopping",
    "amount": 1500.50,
    "type": "expense",
    "category_id": None,
    "transaction_date": "2026-06-01",
    "notes": None,
    "tags": ["groceries", "food"],
    "is_recurring": False,
    "recurrence_type": None,
    "merchant_name": "Walmart",
}


# ── Helper to get auth token ─────────────────────────────────────────────────────
async def get_auth_token(client: AsyncClient) -> str:
    """Register and login a user, return access token."""
    await client.post("/api/v1/auth/register", json=VALID_USER)
    resp = await client.post(
        "/api/v1/auth/login",
        json={"email": VALID_USER["email"], "password": VALID_USER["password"]},
    )
    return resp.json()["access_token"]


# ── Create Transaction ──────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_create_transaction_success(client: AsyncClient) -> None:
    token = await get_auth_token(client)
    resp = await client.post(
        "/api/v1/transactions",
        json=VALID_TRANSACTION,
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["description"] == VALID_TRANSACTION["description"]
    assert data["amount"] == VALID_TRANSACTION["amount"]
    assert data["type"] == VALID_TRANSACTION["type"]
    assert "id" in data


@pytest.mark.asyncio
async def test_create_transaction_unauthenticated(client: AsyncClient) -> None:
    resp = await client.post("/api/v1/transactions", json=VALID_TRANSACTION)
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_create_transaction_invalid_amount(client: AsyncClient) -> None:
    token = await get_auth_token(client)
    payload = {**VALID_TRANSACTION, "amount": -100}
    resp = await client.post(
        "/api/v1/transactions",
        json=payload,
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_create_transaction_invalid_type(client: AsyncClient) -> None:
    token = await get_auth_token(client)
    payload = {**VALID_TRANSACTION, "type": "invalid"}
    resp = await client.post(
        "/api/v1/transactions",
        json=payload,
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 422


# ── List Transactions ────────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_list_transactions(client: AsyncClient) -> None:
    token = await get_auth_token(client)
    # Create a transaction first
    await client.post(
        "/api/v1/transactions",
        json=VALID_TRANSACTION,
        headers={"Authorization": f"Bearer {token}"},
    )
    
    resp = await client.get(
        "/api/v1/transactions",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "items" in data
    assert "total" in data
    assert data["total"] >= 1


@pytest.mark.asyncio
async def test_list_transactions_unauthenticated(client: AsyncClient) -> None:
    resp = await client.get("/api/v1/transactions")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_list_transactions_filter_by_type(client: AsyncClient) -> None:
    token = await get_auth_token(client)
    # Create expense
    await client.post(
        "/api/v1/transactions",
        json={**VALID_TRANSACTION, "type": "expense"},
        headers={"Authorization": f"Bearer {token}"},
    )
    # Create income
    await client.post(
        "/api/v1/transactions",
        json={**VALID_TRANSACTION, "type": "income", "description": "Salary"},
        headers={"Authorization": f"Bearer {token}"},
    )
    
    resp = await client.get(
        "/api/v1/transactions?type=expense",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    for item in data["items"]:
        assert item["type"] == "expense"


@pytest.mark.asyncio
async def test_list_transactions_search(client: AsyncClient) -> None:
    token = await get_auth_token(client)
    await client.post(
        "/api/v1/transactions",
        json=VALID_TRANSACTION,
        headers={"Authorization": f"Bearer {token}"},
    )
    
    resp = await client.get(
        "/api/v1/transactions?search=grocery",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] >= 1


@pytest.mark.asyncio
async def test_list_transactions_pagination(client: AsyncClient) -> None:
    token = await get_auth_token(client)
    # Create multiple transactions
    for i in range(5):
        await client.post(
            "/api/v1/transactions",
            json={**VALID_TRANSACTION, "description": f"Transaction {i}"},
            headers={"Authorization": f"Bearer {token}"},
        )
    
    resp = await client.get(
        "/api/v1/transactions?page=1&page_size=2",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["page"] == 1
    assert data["page_size"] == 2
    assert len(data["items"]) <= 2


# ── Get Transaction by ID ───────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_get_transaction_by_id(client: AsyncClient) -> None:
    token = await get_auth_token(client)
    create_resp = await client.post(
        "/api/v1/transactions",
        json=VALID_TRANSACTION,
        headers={"Authorization": f"Bearer {token}"},
    )
    transaction_id = create_resp.json()["id"]
    
    resp = await client.get(
        f"/api/v1/transactions/{transaction_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == transaction_id


@pytest.mark.asyncio
async def test_get_transaction_by_id_not_found(client: AsyncClient) -> None:
    token = await get_auth_token(client)
    resp = await client.get(
        "/api/v1/transactions/00000000-0000-0000-0000-000000000000",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_get_transaction_unauthorized_user(client: AsyncClient) -> None:
    # Create first user and transaction
    token1 = await get_auth_token(client)
    create_resp = await client.post(
        "/api/v1/transactions",
        json=VALID_TRANSACTION,
        headers={"Authorization": f"Bearer {token1}"},
    )
    transaction_id = create_resp.json()["id"]
    
    # Create second user
    user2 = {**VALID_USER, "email": "user2@example.com"}
    await client.post("/api/v1/auth/register", json=user2)
    login_resp = await client.post(
        "/api/v1/auth/login",
        json={"email": user2["email"], "password": user2["password"]},
    )
    token2 = login_resp.json()["access_token"]
    
    # Try to access first user's transaction
    resp = await client.get(
        f"/api/v1/transactions/{transaction_id}",
        headers={"Authorization": f"Bearer {token2}"},
    )
    assert resp.status_code == 404


# ── Update Transaction ──────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_update_transaction(client: AsyncClient) -> None:
    token = await get_auth_token(client)
    create_resp = await client.post(
        "/api/v1/transactions",
        json=VALID_TRANSACTION,
        headers={"Authorization": f"Bearer {token}"},
    )
    transaction_id = create_resp.json()["id"]
    
    resp = await client.put(
        f"/api/v1/transactions/{transaction_id}",
        json={"description": "Updated description"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["description"] == "Updated description"


@pytest.mark.asyncio
async def test_update_transaction_not_found(client: AsyncClient) -> None:
    token = await get_auth_token(client)
    resp = await client.put(
        "/api/v1/transactions/00000000-0000-0000-0000-000000000000",
        json={"description": "Updated"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 404


# ── Delete Transaction ──────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_delete_transaction(client: AsyncClient) -> None:
    token = await get_auth_token(client)
    create_resp = await client.post(
        "/api/v1/transactions",
        json=VALID_TRANSACTION,
        headers={"Authorization": f"Bearer {token}"},
    )
    transaction_id = create_resp.json()["id"]
    
    resp = await client.delete(
        f"/api/v1/transactions/{transaction_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 204
    
    # Verify it's deleted
    get_resp = await client.get(
        f"/api/v1/transactions/{transaction_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert get_resp.status_code == 404


@pytest.mark.asyncio
async def test_delete_transaction_not_found(client: AsyncClient) -> None:
    token = await get_auth_token(client)
    resp = await client.delete(
        "/api/v1/transactions/00000000-0000-0000-0000-000000000000",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 404


# ── Monthly Summary ─────────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_get_monthly_summary(client: AsyncClient) -> None:
    token = await get_auth_token(client)
    # Create income and expense
    await client.post(
        "/api/v1/transactions",
        json={**VALID_TRANSACTION, "type": "income", "amount": 50000, "description": "Salary"},
        headers={"Authorization": f"Bearer {token}"},
    )
    await client.post(
        "/api/v1/transactions",
        json={**VALID_TRANSACTION, "type": "expense", "amount": 20000},
        headers={"Authorization": f"Bearer {token}"},
    )
    
    resp = await client.get(
        "/api/v1/transactions/summary/monthly",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    if len(data) > 0:
        assert "month" in data[0]
        assert "income" in data[0]
        assert "expenses" in data[0]
        assert "savings" in data[0]


@pytest.mark.asyncio
async def test_get_monthly_summary_unauthenticated(client: AsyncClient) -> None:
    resp = await client.get("/api/v1/transactions/summary/monthly")
    assert resp.status_code == 401

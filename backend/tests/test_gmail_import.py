import pytest
from datetime import datetime, timezone, timedelta, date
from unittest.mock import AsyncMock, MagicMock, patch
from sqlalchemy import select

from app.models.gmail_credential import GmailCredential
from app.models.transaction import Transaction
from app.modules.gmail_import.service import GmailImportService, GMAIL_SEARCH_QUERY
from app.modules.gmail_import.schemas import GmailImportItem

@pytest.mark.asyncio
async def test_get_auth_url():
    service = GmailImportService(db=AsyncMock())
    url = service.get_auth_url()
    assert "accounts.google.com" in url
    assert "scope=https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fgmail.readonly" in url

def test_clean_email_text():
    service = GmailImportService(db=AsyncMock())
    html_text = """
    <html>
        <head><style>body { color: red; }</style></head>
        <body>
            <p>Dear Customer, your account was debited by Rs. 500.00.</p>
            <script>console.log("hello");</script>
            Warm regards,
            Bank Team
        </body>
    </html>
    """
    cleaned = service._clean_email_text(html_text)
    assert "Dear Customer" in cleaned
    assert "debited" in cleaned
    assert "Rs. 500.00" in cleaned
    assert "console.log" not in cleaned
    assert "Bank Team" not in cleaned
    assert "Warm regards" not in cleaned

@pytest.mark.asyncio
@patch("httpx.AsyncClient.post")
@patch("app.modules.gmail_import.service.GmailImportService._fetch_user_email")
async def test_exchange_code_for_tokens(mock_fetch_email, mock_post):
    mock_post.return_value = MagicMock(
        status_code=200,
        json=lambda: {
            "access_token": "mock_access",
            "refresh_token": "mock_refresh",
            "expires_in": 3600
        }
    )
    mock_fetch_email.return_value = "test@gmail.com"

    db_session = AsyncMock()
    db_session.get.return_value = None

    service = GmailImportService(db=db_session)
    email = await service.exchange_code_for_tokens("user123", "auth_code")

    assert email == "test@gmail.com"
    db_session.add.assert_called_once()
    db_session.flush.assert_called_once()

@pytest.mark.asyncio
async def test_import_transactions():
    db_session = AsyncMock()
    # Mocking existing transactions query returning empty list (no duplicates)
    mock_execute_result = MagicMock()
    mock_execute_result.scalars.return_value.all.return_value = []
    db_session.execute.return_value = mock_execute_result

    service = GmailImportService(db=db_session)
    items = [
        GmailImportItem(
            gmail_message_id="msg001",
            merchant="Swiggy",
            amount=250.0,
            type="expense",
            date="2026-08-01",
            category="Food",
            description="Lunch delivery"
        )
    ]
    
    result = await service.import_transactions("user123", items)
    assert result.imported == 1
    assert result.skipped == 0
    assert result.duplicates == 0
    assert result.errors == 0
    db_session.add.assert_called_once()
    db_session.flush.assert_called_once()

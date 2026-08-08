import logging
import re
import urllib.parse
from datetime import datetime, timezone, timedelta
from typing import Any
import json
import httpx
from bs4 import BeautifulSoup
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_

from app.config import settings
from app.models.gmail_credential import GmailCredential
from app.models.transaction import Transaction
from app.modules.ai.service import AIService
from app.modules.ai.prompt_templates import gmail_transaction_prompt
from app.modules.gmail_import.schemas import GmailTransactionCandidate, GmailImportItem, GmailImportResponse
from app.modules.transactions.service import TransactionService
from app.schemas.transaction import TransactionCreate

logger = logging.getLogger(__name__)

# Search query to fetch financial transaction-related emails from Gmail
GMAIL_SEARCH_QUERY = (
    "subject:(bank OR payment OR transfer OR credit OR debit OR transaction OR upi OR wallet OR alert OR merchant OR order OR receipt OR confirmation) "
    "OR \"transaction confirmation\" OR \"payment confirmation\" OR \"payment receipt\""
)

class GmailImportService:
    def __init__(self, db: AsyncSession, ai_service: AIService | None = None) -> None:
        self.db = db
        self.ai_service = ai_service
        self.transaction_service = TransactionService(db)

    def get_auth_url(self) -> str:
        """Generate Google OAuth 2.0 Authorization URL."""
        base_url = "https://accounts.google.com/o/oauth2/v2/auth"
        params = {
            "client_id": settings.GOOGLE_CLIENT_ID,
            "redirect_uri": settings.GOOGLE_REDIRECT_URI,
            "response_type": "code",
            "scope": "https://www.googleapis.com/auth/gmail.readonly",
            "access_type": "offline",
            "prompt": "consent"
        }
        return f"{base_url}?{urllib.parse.urlencode(params)}"

    async def exchange_code_for_tokens(self, user_id: str, code: str) -> str:
        """Exchange authorization code for access and refresh tokens, saving them to db."""
        url = "https://oauth2.googleapis.com/token"
        data = {
            "code": code,
            "client_id": settings.GOOGLE_CLIENT_ID,
            "client_secret": settings.GOOGLE_CLIENT_SECRET,
            "redirect_uri": settings.GOOGLE_REDIRECT_URI,
            "grant_type": "authorization_code"
        }
        async with httpx.AsyncClient() as client:
            res = await client.post(url, data=data)
            if res.status_code != 200:
                raise RuntimeError(f"Failed to exchange OAuth code: {res.text}")
            token_data = res.json()

        # Get connected email details
        access_token = token_data["access_token"]
        email = await self._fetch_user_email(access_token)

        expiry_seconds = token_data.get("expires_in", 3600)
        expiry = datetime.now(timezone.utc) + timedelta(seconds=expiry_seconds)

        # Save or update credentials
        cred = await self.db.get(GmailCredential, user_id)
        if cred:
            cred.email = email
            cred.access_token = access_token
            if "refresh_token" in token_data:
                cred.refresh_token = token_data["refresh_token"]
            cred.token_expiry = expiry
        else:
            cred = GmailCredential(
                user_id=user_id,
                email=email,
                access_token=access_token,
                refresh_token=token_data.get("refresh_token"),
                token_expiry=expiry
            )
            self.db.add(cred)
        
        await self.db.flush()
        return email

    async def get_valid_token(self, cred: GmailCredential) -> str:
        """Return a valid access token. Refresh if expired or close to expiry."""
        now = datetime.now(timezone.utc)
        # Refresh if token expires in less than 5 minutes
        if cred.token_expiry.replace(tzinfo=timezone.utc) <= now + timedelta(minutes=5):
            if not cred.refresh_token:
                raise RuntimeError("No refresh token available to refresh access token.")
            
            url = "https://oauth2.googleapis.com/token"
            data = {
                "client_id": settings.GOOGLE_CLIENT_ID,
                "client_secret": settings.GOOGLE_CLIENT_SECRET,
                "refresh_token": cred.refresh_token,
                "grant_type": "refresh_token"
            }
            async with httpx.AsyncClient() as client:
                res = await client.post(url, data=data)
                if res.status_code != 200:
                    raise RuntimeError(f"Failed to refresh access token: {res.text}")
                token_data = res.json()

            cred.access_token = token_data["access_token"]
            expiry_seconds = token_data.get("expires_in", 3600)
            cred.token_expiry = datetime.now(timezone.utc) + timedelta(seconds=expiry_seconds)
            await self.db.flush()
        
        return cred.access_token

    async def scan_emails(self, user_id: str, days: int) -> list[GmailTransactionCandidate]:
        """Scan user's Gmail messages for transaction alerts and parse them."""
        cred = await self.db.get(GmailCredential, user_id)
        if not cred:
            raise ValueError("Gmail account not connected.")

        token = await self.get_valid_token(cred)
        
        # Calculate date threshold for Gmail API query (e.g. after:YYYY/MM/DD)
        threshold_date = (datetime.now(timezone.utc) - timedelta(days=days)).strftime("%Y/%m/%d")
        query = f"{GMAIL_SEARCH_QUERY} after:{threshold_date}"

        headers = {"Authorization": f"Bearer {token}"}
        
        # 1. Fetch message list
        messages_url = "https://gmail.googleapis.com/gmail/v1/users/me/messages"
        async with httpx.AsyncClient() as client:
            res = await client.get(messages_url, headers=headers, params={"q": query, "maxResults": 15})
            if res.status_code != 200:
                raise RuntimeError(f"Failed to fetch Gmail messages: {res.text}")
            
            messages_data = res.json()
            messages_list = messages_data.get("messages", [])

        # Fetch existing transactions for duplicate detection
        txns_result = await self.db.execute(select(Transaction).where(Transaction.user_id == user_id))
        existing_txns = txns_result.scalars().all()

        existing_signatures = set()
        existing_msg_ids = set()
        for t in existing_txns:
            if t.gmail_message_id:
                existing_msg_ids.add(t.gmail_message_id)
            if t.transaction_date and t.amount is not None and t.merchant_name:
                sig = f"{t.transaction_date.isoformat()}_{float(t.amount)}_{t.merchant_name.strip().lower()}"
                existing_signatures.add(sig)

        candidates = []
        for msg_ref in messages_list:
            msg_id = msg_ref["id"]
            if msg_id in existing_msg_ids:
                continue

            try:
                # 2. Get message details
                detail_url = f"https://gmail.googleapis.com/gmail/v1/users/me/messages/{msg_id}"
                async with httpx.AsyncClient() as client:
                    detail_res = await client.get(detail_url, headers=headers)
                    if detail_res.status_code != 200:
                        continue
                    msg = detail_res.json()

                # Extract metadata headers
                headers_list = msg.get("payload", {}).get("headers", [])
                subject = next((h["value"] for h in headers_list if h["name"].lower() == "subject"), "No Subject")
                sender = next((h["value"] for h in headers_list if h["name"].lower() == "from"), "Unknown Sender")
                raw_date = next((h["value"] for h in headers_list if h["name"].lower() == "date"), "")

                # Fetch and clean plain text content
                body = self._extract_email_body(msg.get("payload", {}))
                cleaned_body = self._clean_email_text(body)

                if not cleaned_body or len(cleaned_body) < 15:
                    continue

                # 3. Call AI Service to structure transaction
                prompt = gmail_transaction_prompt(cleaned_body)
                schema = {
                    "required": ["amount", "transaction_type", "currency", "confidence"]
                }
                
                # Retry once if Ollama returns malformed JSON
                try:
                    structured = await self.ai_service.generate_structured(prompt, schema=schema)
                    data = structured.data
                except Exception as ai_err:
                    logger.warning(f"Failed AI extraction for {msg_id}, retrying once: {ai_err}")
                    try:
                        structured = await self.ai_service.generate_structured(prompt, schema=schema)
                        data = structured.data
                    except Exception:
                        logger.error(f"AI extraction failed twice for {msg_id}. Skipping.")
                        continue

                # Validate data format
                amount = data.get("amount")
                if amount is None:
                    continue
                try:
                    amount = float(amount)
                except ValueError:
                    continue

                confidence = float(data.get("confidence") or 0.0)
                extracted_date = data.get("date") or datetime.now(timezone.utc).strftime("%Y-%m-%d")
                merchant = data.get("merchant") or "Unknown Merchant"

                # Check duplicates
                is_duplicate = False
                sig = f"{extracted_date}_{amount}_{merchant.strip().lower()}"
                if sig in existing_signatures:
                    is_duplicate = True

                candidates.append(GmailTransactionCandidate(
                    gmail_message_id=msg_id,
                    subject=subject,
                    sender=sender,
                    date=extracted_date,
                    merchant=merchant,
                    amount=amount,
                    currency=data.get("currency") or "INR",
                    type="income" if data.get("transaction_type") == "income" else "expense",
                    payment_method=data.get("payment_method"),
                    category=data.get("category"),
                    description=data.get("description"),
                    confidence=confidence,
                    status="Duplicate" if is_duplicate else "Ready"
                ))
            except Exception as e:
                logger.error(f"Error parsing email {msg_id}: {e}")
                continue

        return candidates

    async def import_transactions(self, user_id: str, items: list[GmailImportItem]) -> GmailImportResponse:
        """Import confirmed transactions into the database."""
        imported = 0
        skipped = 0
        duplicates = 0
        errors = 0

        # Load existing gmail message ids to prevent duplicate insertions
        txns_result = await self.db.execute(select(Transaction.gmail_message_id).where(
            and_(Transaction.user_id == user_id, Transaction.gmail_message_id.isnot(None))
        ))
        existing_msg_ids = set(txns_result.scalars().all())

        for item in items:
            if item.gmail_message_id in existing_msg_ids:
                duplicates += 1
                skipped += 1
                continue

            try:
                # Convert string date to date object
                date_val = datetime.strptime(item.date, "%Y-%m-%d").date()

                payload = TransactionCreate(
                    amount=item.amount,
                    type=item.type,
                    category_id=None, # Category matching will happen via Frontend dropdown or Category model lookup
                    description=item.description or f"Gmail Import: {item.merchant}",
                    transaction_date=date_val,
                    notes=f"Imported from email message ID: {item.gmail_message_id}",
                    tags=["gmail"],
                    is_recurring=False,
                    recurrence_type=None,
                    merchant_name=item.merchant,
                )

                # Custom repository save to store gmail_message_id & transaction_source="gmail"
                txn_model = Transaction(
                    user_id=user_id,
                    amount=payload.amount,
                    type=payload.type,
                    category_id=payload.category_id,
                    description=payload.description,
                    transaction_date=payload.transaction_date,
                    notes=payload.notes,
                    tags=json.dumps(payload.tags) if payload.tags else None,
                    is_recurring=payload.is_recurring,
                    recurrence_type=payload.recurrence_type,
                    merchant_name=payload.merchant_name,
                    transaction_source="gmail",
                    gmail_message_id=item.gmail_message_id
                )
                self.db.add(txn_model)
                existing_msg_ids.add(item.gmail_message_id)
                imported += 1
            except Exception as e:
                logger.error(f"Error importing transaction {item.gmail_message_id}: {e}")
                errors += 1
                skipped += 1

        await self.db.flush()
        return GmailImportResponse(
            imported=imported,
            skipped=skipped,
            duplicates=duplicates,
            errors=errors
        )

    async def _fetch_user_email(self, access_token: str) -> str:
        """Fetch primary email address of connected Google account."""
        url = "https://gmail.googleapis.com/gmail/v1/users/me/profile"
        headers = {"Authorization": f"Bearer {access_token}"}
        async with httpx.AsyncClient() as client:
            res = await client.get(url, headers=headers)
            if res.status_code != 200:
                raise RuntimeError("Failed to fetch user Gmail profile.")
            return res.json()["emailAddress"]

    def _extract_email_body(self, payload: dict[str, Any]) -> str:
        """Extract body text from Google API message payload structure."""
        body = ""
        mime_type = payload.get("mimeType", "")
        parts = payload.get("parts", [])

        if "multipart" in mime_type:
            for part in parts:
                body += self._extract_email_body(part)
        elif mime_type == "text/plain" or mime_type == "text/html":
            data = payload.get("body", {}).get("data", "")
            if data:
                # Decode base64url format
                import base64
                try:
                    decoded = base64.urlsafe_b64decode(data).decode("utf-8", errors="ignore")
                    body += decoded
                except Exception:
                    pass
        return body

    def _clean_email_text(self, text: str) -> str:
        """Clean email text by stripping HTML, CSS, JS, signatures, and tracking parameters."""
        if not text:
            return ""

        # Remove HTML/CSS tags using BeautifulSoup
        soup = BeautifulSoup(text, "html.parser")
        for s in soup(["script", "style", "head", "meta"]):
            s.decompose()
        
        cleaned = soup.get_text(separator=" ")

        # Remove common signatures patterns
        cleaned = re.split(r"--\s*$", cleaned, flags=re.MULTILINE)[0]
        cleaned = re.split(r"Warm regards,|Best regards,|Regards,", cleaned, flags=re.IGNORECASE)[0]

        # Clean excess whitespaces and special characters
        cleaned = re.sub(r"\s+", " ", cleaned)
        cleaned = cleaned.strip()

        return cleaned

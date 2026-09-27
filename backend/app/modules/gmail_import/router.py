import logging
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.models.gmail_credential import GmailCredential
from app.modules.ai.providers import AIProvider, get_provider
from app.modules.ai.service import AIService
from app.modules.gmail_import.schemas import (
    GmailAuthStatus,
    GmailScanRequest,
    GmailScanResponse,
    GmailImportRequest,
    GmailImportResponse
)
from app.modules.gmail_import.service import GmailImportService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/gmail", tags=["Gmail Import"])

@router.get("/auth-url", summary="Get Google OAuth authorization URL")
async def get_auth_url(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> dict[str, str]:
    svc = GmailImportService(db)
    return {"url": svc.get_auth_url()}

@router.post("/callback", summary="Google OAuth callback")
async def oauth_callback(
    code: str = Query(...),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> dict[str, str]:
    svc = GmailImportService(db)
    try:
        email = await svc.exchange_code_for_tokens(str(user.id), code)
        return {"status": "success", "email": email}
    except Exception as e:
        logger.error(f"OAuth Callback failed: {e}")
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/status", response_model=GmailAuthStatus, summary="Get Gmail connection status")
async def get_status(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> GmailAuthStatus:
    cred = await db.get(GmailCredential, str(user.id))
    if cred:
        return GmailAuthStatus(connected=True, email=cred.email)
    return GmailAuthStatus(connected=False)

@router.post("/disconnect", summary="Disconnect Gmail account")
async def disconnect(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> dict[str, str]:
    cred = await db.get(GmailCredential, str(user.id))
    if cred:
        await db.delete(cred)
        await db.flush()
        return {"status": "disconnected"}
    raise HTTPException(status_code=400, detail="Gmail not connected.")

@router.post("/scan", response_model=GmailScanResponse, summary="Scan emails for financial transactions")
async def scan(
    payload: GmailScanRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    provider: AIProvider = Depends(get_provider)
) -> GmailScanResponse:
    ai_service = AIService(provider)
    svc = GmailImportService(db, ai_service)
    try:
        candidates = await svc.scan_emails(str(user.id), payload.days)
        return GmailScanResponse(
            total_scanned=len(candidates),
            transactions=candidates
        )
    except ValueError as val_err:
        raise HTTPException(status_code=400, detail=str(val_err))
    except Exception as e:
        logger.error(f"Gmail scan failed: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to scan emails: {str(e)}")

@router.post("/import", response_model=GmailImportResponse, summary="Import confirmed transactions")
async def import_transactions(
    payload: GmailImportRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> GmailImportResponse:
    svc = GmailImportService(db)
    try:
        result = await svc.import_transactions(str(user.id), payload.transactions)
        return result
    except Exception as e:
        logger.error(f"Gmail import failed: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to import transactions: {str(e)}")

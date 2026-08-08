from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import verify_access_token
from app.database import get_db
from app.modules.statement_import.schemas import StatementImportPreview, StatementImportConfirmRequest, StatementImportResult
from app.modules.statement_import.service import StatementImportService
from app.modules.transactions.router import get_current_user_id

router = APIRouter(prefix="/statements", tags=["Statements"])

@router.post(
    "/import",
    response_model=StatementImportPreview,
    summary="Upload and parse a bank statement CSV",
)
async def upload_statement(
    file: UploadFile = File(...),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> StatementImportPreview:
    if not file.filename or not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files are supported.")
        
    # Check file size up to 20MB
    contents = await file.read()
    if len(contents) > 20 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File size exceeds 20MB limit.")
        
    svc = StatementImportService(db)
    return await svc.process_csv(contents, user_id)

@router.post(
    "/import/confirm",
    response_model=StatementImportResult,
    summary="Confirm and import selected transactions",
)
async def confirm_import(
    payload: StatementImportConfirmRequest,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> StatementImportResult:
    svc = StatementImportService(db)
    return await svc.confirm_import(payload.transactions, user_id)

from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPBearer

from app.modules.ai.providers import AIProvider
from app.modules.ai.router import get_provider, get_current_user_id
from app.modules.ai.service import AIService
from app.modules.message_parser.schemas import ParsedMessageResponse, ParseMessageRequest
from app.modules.message_parser.service import MessageParserService

router = APIRouter(prefix="/messages", tags=["Message Parser"])
bearer_scheme = HTTPBearer(auto_error=False)


@router.post("/parse", response_model=ParsedMessageResponse)
async def parse_message(
    payload: ParseMessageRequest,
    user_id: str = Depends(get_current_user_id),
    provider: AIProvider = Depends(get_provider),
) -> ParsedMessageResponse:
    """
    Parse a raw text message (e.g., SMS or push notification) to extract structured transaction data.
    """
    ai_service = AIService(provider=provider)
    parser_service = MessageParserService(ai_service=ai_service)
    
    try:
        result = await parser_service.parse_message(payload.message)
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse message: {str(e)}")

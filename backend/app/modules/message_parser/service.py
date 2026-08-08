import json
from datetime import date
from typing import Any

from app.modules.ai.service import AIService
from app.modules.message_parser.prompts import sms_parser_prompt
from app.modules.message_parser.schemas import ParsedMessageResponse


class MessageParserService:
    def __init__(self, ai_service: AIService) -> None:
        self.ai_service = ai_service

    async def parse_message(self, text: str) -> ParsedMessageResponse:
        """
        Parses a raw text message into a structured transaction.
        Utilizes the generic AI Service.
        """
        if not text or not text.strip():
            raise ValueError("Message text cannot be empty.")

        current_date_str = date.today().isoformat()
        prompt = sms_parser_prompt(text, current_date_str)

        schema: dict[str, Any] = {
            "type": "object",
            "properties": {
                "description": {"type": ["string", "null"]},
                "merchant_name": {"type": ["string", "null"]},
                "amount": {"type": ["number", "null"]},
                "transaction_type": {"type": ["string", "null"], "enum": ["income", "expense", None]},
                "transaction_date": {"type": ["string", "null"], "format": "date"},
                "category": {"type": ["string", "null"]},
                "payment_method": {"type": ["string", "null"]},
                "confidence": {"type": "number"}
            },
            "required": ["confidence"]
        }

        # The AI Service will enforce the JSON schema format
        structured_resp = await self.ai_service.generate_structured(
            prompt=prompt,
            schema=schema
        )

        return ParsedMessageResponse(**structured_resp.data)

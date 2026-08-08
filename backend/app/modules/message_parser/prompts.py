def sms_parser_prompt(message: str, current_date: str) -> str:
    return f"""You are a highly precise financial parsing assistant.

Your task is to extract structured transaction data from the following raw message (SMS or push notification).
Today's date is: {current_date}.

RAW MESSAGE:
"{message}"

INSTRUCTIONS:
1. Extract the 'merchant_name' (e.g. McDonald's, Amazon, Netflix) if present.
2. Extract the 'description' (a clean summary of the transaction).
3. Extract the 'amount' as a float.
4. Extract 'transaction_type'. Must be strictly 'expense' or 'income'. Debits/spending are 'expense'. Credits/salary/deposits are 'income'.
5. Extract the 'transaction_date' in YYYY-MM-DD format. If the date is missing, use Today's date. If only the day/month is provided, use the current year.
6. Extract the 'category' guessing the most likely category based on merchant or description (e.g., Food, Shopping, Transport, Subscriptions).
7. Extract 'payment_method' (e.g., UPI, Card, IMPS, NEFT, RTGS).
8. Calculate a 'confidence' score between 0.0 and 1.0 indicating how sure you are about the extracted fields.
9. If any field cannot be reliably extracted, return null for that field. Never hallucinate missing values.
10. Return ONLY JSON matching the provided schema. Do not include markdown formatting or explanations.
"""

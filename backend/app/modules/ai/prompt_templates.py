"""
AI module — prompt template library.

Architecture rule: Prompts must never be hardcoded in routers or services.
Every AI feature gets its own prompt function here.

Each function takes structured inputs and returns a formatted prompt string.
This keeps prompts versioned, testable, and easy to iterate.
"""


# ── Transaction parsing ───────────────────────────────────────────────────────


def transaction_parser_prompt(
    description: str,
    amount: float,
    date: str,
    available_categories: list[str] | None = None,
) -> str:
    """
    Prompt for parsing a raw transaction description into structured data.

    Args:
        description:           Raw transaction text (e.g. from bank SMS or statement).
        amount:                Transaction amount in INR.
        date:                  Transaction date as ISO string (YYYY-MM-DD).
        available_categories:  Optional list of category names to constrain the output.

    Returns:
        Formatted prompt string ready to send to the AI provider.
    """
    categories_block = ""
    if available_categories:
        cats = ", ".join(available_categories)
        categories_block = f"\nAvailable categories: {cats}\nPick the best match from this list only."

    return f"""You are a financial data extraction assistant for an Indian personal finance app.

Given the following transaction details, extract structured information.

Transaction description: {description}
Amount: ₹{amount:,.2f}
Date: {date}
{categories_block}

Return a JSON object with these fields:
- merchant_name (string or null): The merchant or payee name
- category (string or null): Best matching expense/income category
- transaction_type (string): "expense" or "income"
- tags (array of strings): Relevant tags (max 3)
- notes (string or null): Any additional context

Respond with valid JSON only."""


# ── AI Assistant ──────────────────────────────────────────────────────────────


def assistant_prompt(
    user_message: str,
    financial_context: str | None = None,
) -> str:
    """
    Prompt for the AI Financial Assistant.

    Args:
        user_message:       The user's question or request.
        financial_context:  Optional summary of the user's financial data
                            (e.g. monthly spend, top categories).

    Returns:
        Formatted prompt string.
    """
    context_block = ""
    if financial_context:
        context_block = f"\n\nUser's Financial Context:\n{financial_context}"

    return f"""You are Finance Copilot, a friendly and knowledgeable AI financial assistant \
for Indian users. You help with budgeting, expense tracking, investments, and financial planning.

Be concise, actionable, and use INR (₹) for all currency values.{context_block}

User: {user_message}"""


# ── Receipt OCR ───────────────────────────────────────────────────────────────


def receipt_prompt(ocr_text: str) -> str:
    """
    Prompt for extracting transaction data from receipt OCR text.

    Args:
        ocr_text: Raw text extracted from a receipt image.

    Returns:
        Formatted prompt string.
    """
    return f"""You are a receipt parsing assistant for an Indian personal finance app.

Extract transaction information from the following receipt text:

---
{ocr_text}
---

Return a JSON object with these fields:
- merchant_name (string or null)
- total_amount (number or null): Total amount paid in INR
- date (string or null): ISO date YYYY-MM-DD
- items (array of objects): Each item with {{name, quantity, price}}
- payment_method (string or null): "cash", "upi", "card", "netbanking", or null
- gst_amount (number or null): GST charged if visible

Respond with valid JSON only."""


# ── Bank statement parsing ────────────────────────────────────────────────────


def statement_prompt(statement_text: str) -> str:
    """
    Prompt for parsing a bank statement into a list of transactions.

    Args:
        statement_text: Raw text from a bank statement (PDF or CSV).

    Returns:
        Formatted prompt string.
    """
    return f"""You are a bank statement parsing assistant for an Indian personal finance app.

Parse the following bank statement text and extract all transactions.

---
{statement_text}
---

Return a JSON array where each element has:
- date (string): ISO date YYYY-MM-DD
- description (string): Transaction description
- debit (number or null): Amount debited in INR
- credit (number or null): Amount credited in INR
- balance (number or null): Running balance if visible
- transaction_type (string): "expense" or "income"

Respond with valid JSON only."""


# ── SMS parsing ───────────────────────────────────────────────────────────────


def sms_prompt(sms_text: str) -> str:
    """
    Prompt for extracting transaction data from a bank SMS alert.

    Args:
        sms_text: Raw SMS text (e.g. from HDFC, SBI, ICICI).

    Returns:
        Formatted prompt string.
    """
    return f"""You are an SMS transaction parser for an Indian personal finance app.

Extract transaction information from this bank SMS:

---
{sms_text}
---

Return a JSON object with these fields:
- amount (number or null): Transaction amount in INR
- transaction_type (string): "expense" (debit) or "income" (credit)
- merchant_name (string or null): Where the money was spent/received
- bank_name (string or null): The sender bank
- account_last4 (string or null): Last 4 digits of account if visible
- date (string or null): ISO date YYYY-MM-DD if present
- balance (number or null): Available balance if mentioned
- reference_number (string or null): Transaction reference/UTR number

Respond with valid JSON only."""

import csv
import io
import datetime
from typing import Any

from app.modules.statement_import.schemas import ParsedTransactionRow

def normalize_header(header: str) -> str:
    """Normalize header string for matching."""
    return header.strip().lower()

def sniff_columns(headers: list[str]) -> dict[str, str]:
    """
    Attempt to map known columns from the CSV headers.
    Returns a dict mapping our expected field to the actual CSV header.
    """
    mapping = {}
    normalized_headers = {normalize_header(h): h for h in headers}

    # Date
    for h in ["date", "transaction date", "txn date", "posted date"]:
        if h in normalized_headers:
            mapping["date"] = normalized_headers[h]
            break

    # Description
    for h in ["description", "narration", "memo", "details"]:
        if h in normalized_headers:
            mapping["description"] = normalized_headers[h]
            break

    # Merchant
    for h in ["merchant", "payee"]:
        if h in normalized_headers:
            mapping["merchant"] = normalized_headers[h]
            break

    # Amount / Credit / Debit
    if "amount" in normalized_headers:
        mapping["amount"] = normalized_headers["amount"]
    
    if "credit" in normalized_headers:
        mapping["credit"] = normalized_headers["credit"]
        
    if "debit" in normalized_headers:
        mapping["debit"] = normalized_headers["debit"]
        
    if "withdrawal" in normalized_headers:
        mapping["debit"] = normalized_headers["withdrawal"]
        
    if "deposit" in normalized_headers:
        mapping["credit"] = normalized_headers["deposit"]

    return mapping

def parse_date(date_str: str) -> datetime.date | None:
    if not date_str:
        return None
    # Try common formats
    formats = ["%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y", "%d-%m-%Y"]
    for fmt in formats:
        try:
            return datetime.datetime.strptime(date_str.strip(), fmt).date()
        except ValueError:
            pass
    return None

def parse_amount(amount_str: str) -> float | None:
    if not amount_str:
        return None
    try:
        # Remove commas, currency symbols, etc.
        clean_str = amount_str.replace(",", "").replace("$", "").replace("₹", "").strip()
        return float(clean_str)
    except ValueError:
        return None

def parse_csv_statement(file_bytes: bytes) -> list[ParsedTransactionRow]:
    text = file_bytes.decode("utf-8-sig") # handle BOM if present
    reader = csv.DictReader(io.StringIO(text))
    
    if not reader.fieldnames:
        return []
        
    mapping = sniff_columns(list(reader.fieldnames))
    
    parsed_rows = []
    
    for row in reader:
        # Extract fields based on mapping
        date_str = row.get(mapping.get("date")) if mapping.get("date") else None
        desc_str = row.get(mapping.get("description")) if mapping.get("description") else None
        merchant_str = row.get(mapping.get("merchant")) if mapping.get("merchant") else None
        
        amt_str = row.get(mapping.get("amount")) if mapping.get("amount") else None
        credit_str = row.get(mapping.get("credit")) if mapping.get("credit") else None
        debit_str = row.get(mapping.get("debit")) if mapping.get("debit") else None
        
        parsed_date = parse_date(date_str) if date_str else None
        
        amount = None
        txn_type = None
        
        if amt_str:
            val = parse_amount(amt_str)
            if val is not None:
                amount = abs(val)
                txn_type = "income" if val > 0 else "expense"
        elif credit_str and parse_amount(credit_str):
            val = parse_amount(credit_str)
            if val is not None and val > 0:
                amount = val
                txn_type = "income"
        elif debit_str and parse_amount(debit_str):
            val = parse_amount(debit_str)
            if val is not None and val > 0:
                amount = val
                txn_type = "expense"
                
        status = "Ready"
        if not parsed_date or amount is None or not desc_str:
            status = "Missing Data"
            
        parsed_rows.append(ParsedTransactionRow(
            date=parsed_date,
            description=desc_str,
            merchant=merchant_str,
            amount=amount,
            type=txn_type,
            status=status,
            original_row=row
        ))
        
    return parsed_rows

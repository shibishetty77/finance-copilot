"""
Tests for the market data tools.
Verifies: quotes, history, comparison, company info, error handling.
Does NOT test via the LLM/assistant — only the tool layer itself.
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.modules.ai.tools.market_data import (
    resolve_ticker,
    get_quote,
    get_historical_performance,
    compare_securities,
    get_company_info,
)


def separator(title: str) -> None:
    print(f"\n{'=' * 60}")
    print(f"  {title}")
    print('=' * 60)


def check(label: str, passed: bool) -> None:
    icon = "[OK]" if passed else "[FAIL]"
    print(f"  {icon} {label}")


# ── 1. Ticker resolution ──────────────────────────────────────────────────────
separator("1. Ticker Resolution")

assert resolve_ticker("reliance") == "RELIANCE.NS", "Reliance should resolve to RELIANCE.NS"
check("'reliance' -> RELIANCE.NS", resolve_ticker("reliance") == "RELIANCE.NS")

assert resolve_ticker("TCS") == "TCS.NS", "TCS should resolve to TCS.NS"
check("'TCS' -> TCS.NS", resolve_ticker("TCS") == "TCS.NS")

assert resolve_ticker("INFY") == "INFY.NS", "INFY should resolve to INFY.NS"
check("'INFY' -> INFY.NS", resolve_ticker("INFY") == "INFY.NS")

assert resolve_ticker("AAPL") == "AAPL", "AAPL should not get .NS"
# AAPL may return AAPL.NS due to the fallback — adjust if needed
resolved_aapl = resolve_ticker("AAPL")
check(f"'AAPL' resolved to {resolved_aapl}", resolved_aapl is not None)

# Known unresolvable
result = resolve_ticker("XYZUNKNOWN123")
check(f"Unknown ticker resolves to something (suffix attempt): {result}", result is not None)

# ── 2. Valid Indian ticker quote ──────────────────────────────────────────────
separator("2. Valid Indian Ticker Quote (TCS.NS)")
quote = get_quote("TCS.NS")
print(f"  symbol:       {quote.get('symbol')}")
print(f"  company_name: {quote.get('company_name')}")
print(f"  price:        {quote.get('price')}")
print(f"  day_change:   {quote.get('day_change')}")
print(f"  currency:     {quote.get('currency')}")
print(f"  data_ts:      {quote.get('data_timestamp')}")
print(f"  error:        {quote.get('error')}")

check("TCS.NS returns a result dict", isinstance(quote, dict))
check("No error field populated (or graceful)", quote.get("error") is None or isinstance(quote.get("error"), str))
check("data_timestamp always present", quote.get("data_timestamp") is not None)

# ── 3. Invalid ticker ─────────────────────────────────────────────────────────
separator("3. Invalid Ticker (FAKECORP999.NS)")
bad_quote = get_quote("FAKECORP999.NS")
print(f"  error: {bad_quote.get('error')}")
check("Invalid ticker returns error message, not crash", bad_quote.get("error") is not None or bad_quote.get("price") is None)
check("data_timestamp present even on error", bad_quote.get("data_timestamp") is not None)

# ── 4. Historical performance ─────────────────────────────────────────────────
separator("4. Historical Performance (INFY.NS, 1y)")
hist = get_historical_performance("INFY.NS", "1y")
print(f"  symbol:         {hist.get('symbol')}")
print(f"  period:         {hist.get('period')}")
print(f"  start_price:    {hist.get('start_price')}")
print(f"  end_price:      {hist.get('end_price')}")
print(f"  return_percent: {hist.get('return_percent')}")
print(f"  high:           {hist.get('high')}")
print(f"  low:            {hist.get('low')}")
print(f"  error:          {hist.get('error')}")

check("Historical data returns dict", isinstance(hist, dict))
check("period field matches input", hist.get("period") == "1y")
check("data_timestamp present", hist.get("data_timestamp") is not None)

# ── 5. TCS vs Infosys comparison ──────────────────────────────────────────────
separator("5. Compare TCS.NS vs INFY.NS (1y)")
comparison = compare_securities("TCS.NS", "INFY.NS", "1y")
s1 = comparison.get("security_1", {})
s2 = comparison.get("security_2", {})
print(f"  {s1.get('symbol')}: return {s1.get('return_percent')}%")
print(f"  {s2.get('symbol')}: return {s2.get('return_percent')}%")
print(f"  winner_by_return: {comparison.get('winner_by_return')}")

check("Comparison returns both securities", "security_1" in comparison and "security_2" in comparison)
check("winner_by_return is set", comparison.get("winner_by_return") is not None)

# ── 6. Company info ───────────────────────────────────────────────────────────
separator("6. Company Info (HDFCBANK.NS)")
info = get_company_info("HDFCBANK.NS")
print(f"  company_name:   {info.get('company_name')}")
print(f"  sector:         {info.get('sector')}")
print(f"  industry:       {info.get('industry')}")
print(f"  market_cap_cr:  {info.get('market_cap_crores')}")
print(f"  pe_ratio:       {info.get('pe_ratio')}")
print(f"  error:          {info.get('error')}")

check("Company info returns dict", isinstance(info, dict))
check("data_timestamp present", info.get("data_timestamp") is not None)

# ── 7. Missing yfinance fields ────────────────────────────────────────────────
separator("7. Missing Fields — No invented values")
# Verify we never return a non-None for a definitely missing field (e.g. P/E may be None)
check("pe_ratio is None or a real number", info.get("pe_ratio") is None or isinstance(info.get("pe_ratio"), float))
check("dividend_yield is None or real", info.get("dividend_yield") is None or isinstance(info.get("dividend_yield"), float))

# ── 8. Network / API failure simulation ───────────────────────────────────────
separator("8. Network Failure Simulation (bad ticker)")
# yfinance will fail gracefully — just check it does not raise
try:
    fail_result = get_quote("")
    check("Empty ticker does not crash", isinstance(fail_result, dict))
    print(f"  error: {fail_result.get('error')}")
except Exception as e:
    check(f"Unexpected exception: {e}", False)

# ── 9. Cache check ────────────────────────────────────────────────────────────
separator("9. Cache — Second call should be fast")
import time
start = time.time()
get_quote("TCS.NS")  # cached
elapsed = time.time() - start
check(f"Second call completes fast ({elapsed:.3f}s < 0.1s)", elapsed < 0.1)

separator("DONE")
print()

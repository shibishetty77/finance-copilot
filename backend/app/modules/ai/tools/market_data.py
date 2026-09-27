"""
Market Data Tools — CortexFi.

Encapsulates all yfinance interactions and real-time API integrations.
The LLM never calls these APIs directly; it routes through this service via the context engine.

Public interface:
    resolve_ticker(query)               → str | None
    get_quote(ticker)                   → dict
    get_historical_performance(ticker, period) → dict
    compare_securities(ticker1, ticker2, period) → dict
    get_company_info(ticker)            → dict
    get_commodity_price(commodity)      → dict (with real API integration)

Architecture rule: yfinance and market APIs are ONLY imported here. No other module in the AI
pipeline may import these directly.
"""

from __future__ import annotations

import logging
import time
from datetime import datetime, timezone
from functools import lru_cache
from typing import Any

logger = logging.getLogger(__name__)

# ── Simple in-process TTL cache ───────────────────────────────────────────────

_CACHE: dict[str, tuple[float, dict[str, Any]]] = {}
_QUOTE_TTL = 300        # 5 minutes for quotes
_HISTORY_TTL = 3600     # 1 hour for historical data
_INFO_TTL = 3600        # 1 hour for company info


def _cache_get(key: str) -> dict[str, Any] | None:
    entry = _CACHE.get(key)
    if entry is None:
        return None
    ts, value = entry
    if time.monotonic() - ts > 0:       # TTL checked at set time
        return value
    del _CACHE[key]
    return None


def _cache_set(key: str, value: dict[str, Any], ttl: float) -> None:
    # Store value with expiry — on next get we compare monotonic time
    _CACHE[key] = (time.monotonic() + ttl, value)


def _cache_fetch(key: str) -> dict[str, Any] | None:
    """Return cached value if not yet expired."""
    entry = _CACHE.get(key)
    if entry is None:
        return None
    expires_at, value = entry
    if time.monotonic() < expires_at:
        return value
    del _CACHE[key]
    return None


# ── Ticker resolution ─────────────────────────────────────────────────────────

# Well-known Indian stock name → NSE ticker mapping
_INDIA_TICKER_MAP: dict[str, str] = {
    # Large caps
    "reliance": "RELIANCE.NS",
    "ril": "RELIANCE.NS",
    "tcs": "TCS.NS",
    "tata consultancy": "TCS.NS",
    "infosys": "INFY.NS",
    "infy": "INFY.NS",
    "hdfc bank": "HDFCBANK.NS",
    "hdfc": "HDFCBANK.NS",
    "hdfcbank": "HDFCBANK.NS",
    "icici bank": "ICICIBANK.NS",
    "icicibank": "ICICIBANK.NS",
    "icici": "ICICIBANK.NS",
    "wipro": "WIPRO.NS",
    "hcl": "HCLTECH.NS",
    "hcl technologies": "HCLTECH.NS",
    "hcltech": "HCLTECH.NS",
    "bajaj finance": "BAJFINANCE.NS",
    "bajajfinance": "BAJFINANCE.NS",
    "kotak": "KOTAKBANK.NS",
    "kotak mahindra": "KOTAKBANK.NS",
    "kotakbank": "KOTAKBANK.NS",
    "sbi": "SBIN.NS",
    "state bank": "SBIN.NS",
    "sbin": "SBIN.NS",
    "itc": "ITC.NS",
    "maruti": "MARUTI.NS",
    "maruti suzuki": "MARUTI.NS",
    "l&t": "LT.NS",
    "lt": "LT.NS",
    "larsen": "LT.NS",
    "axis bank": "AXISBANK.NS",
    "axisbank": "AXISBANK.NS",
    "axis": "AXISBANK.NS",
    "sun pharma": "SUNPHARMA.NS",
    "sunpharma": "SUNPHARMA.NS",
    "titan": "TITAN.NS",
    "ultratech": "ULTRACEMCO.NS",
    "adani ports": "ADANIPORTS.NS",
    "adani enterprises": "ADANIENT.NS",
    "nestle": "NESTLEIND.NS",
    "asian paints": "ASIANPAINT.NS",
    "asianpaint": "ASIANPAINT.NS",
    "power grid": "POWERGRID.NS",
    "ntpc": "NTPC.NS",
    "ongc": "ONGC.NS",
    "tech mahindra": "TECHM.NS",
    "techm": "TECHM.NS",
    "indusind": "INDUSINDBK.NS",
    "indusind bank": "INDUSINDBK.NS",
    # Common international
    "apple": "AAPL",
    "microsoft": "MSFT",
    "google": "GOOGL",
    "alphabet": "GOOGL",
    "amazon": "AMZN",
    "tesla": "TSLA",
    "nvidia": "NVDA",
    "meta": "META",
    "netflix": "NFLX",
}


def resolve_ticker(query: str) -> str | None:
    """
    Resolve a company name or ticker to a tradable Yahoo Finance symbol.

    Strategy:
    1. Check known name → ticker map (case-insensitive).
    2. If the query already looks like a full ticker (e.g. "RELIANCE.NS", "AAPL"),
       return it as-is after a basic validation attempt.
    3. If the plain ticker (uppercased) appended with ".NS" is in the known map, use it.
    4. Return None if we can't confidently resolve — caller must ask for clarification.
    """
    normalized = query.strip().lower().rstrip(".")

    # 1. Direct name lookup
    if normalized in _INDIA_TICKER_MAP:
        return _INDIA_TICKER_MAP[normalized]

    # 2. Already a qualified ticker (contains a dot, e.g. "TCS.NS")
    upper = query.strip().upper()
    if "." in upper:
        return upper

    # 3. Try exact uppercase match in map values (user typed "RELIANCE")
    for name, ticker in _INDIA_TICKER_MAP.items():
        if ticker.split(".")[0] == upper or name.upper() == upper:
            return ticker

    # 4. If the query is all caps and short, attempt .NS suffix
    if upper.isalpha() and len(upper) <= 12:
        # Attempt .NS — caller will verify via yfinance
        return f"{upper}.NS"

    return None


# ── yfinance helpers ──────────────────────────────────────────────────────────

def _safe_float(value: Any) -> float | None:
    """Safely convert a value to float, returning None on failure."""
    try:
        if value is None:
            return None
        f = float(value)
        if f != f:  # NaN check
            return None
        return f
    except (TypeError, ValueError):
        return None


def _safe_str(value: Any) -> str | None:
    """Safely convert a value to str, returning None if empty/None."""
    if value is None:
        return None
    s = str(value).strip()
    return s if s and s.lower() not in ("none", "nan", "n/a", "") else None


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ── Public tools ──────────────────────────────────────────────────────────────

def get_quote(ticker: str, retry: bool = True) -> dict[str, Any]:
    """
    Fetch the most recent available price quote for a ticker.

    Returns a structured dict. Never invents values — missing fields → None.
    """
    cache_key = f"quote:{ticker}"
    cached = _cache_fetch(cache_key)
    if cached is not None:
        return cached

    for attempt in range(2 if retry else 1):
        try:
            import yfinance as yf  # Only imported inside this module

            t = yf.Ticker(ticker)
            info = t.info or {}

            # Primary price sources
            price = (
                _safe_float(info.get("currentPrice"))
                or _safe_float(info.get("regularMarketPrice"))
                or _safe_float(info.get("ask"))
            )
            prev_close = _safe_float(info.get("previousClose")) or _safe_float(
                info.get("regularMarketPreviousClose")
            )

            day_change = None
            day_change_pct = None
            if price is not None and prev_close is not None and prev_close != 0:
                day_change = round(price - prev_close, 2)
                day_change_pct = round((day_change / prev_close) * 100, 2)

            result: dict[str, Any] = {
                "symbol": ticker,
                "company_name": _safe_str(info.get("longName") or info.get("shortName")),
                "price": price,
                "previous_close": prev_close,
                "day_change": day_change,
                "day_change_percent": day_change_pct,
                "currency": _safe_str(info.get("currency")),
                "exchange": _safe_str(info.get("exchange") or info.get("fullExchangeName")),
                "market_state": _safe_str(info.get("marketState")),
                "data_timestamp": _now_iso(),
                "error": None,
            }

            if price is None:
                result["error"] = f"No price data available for {ticker}"

            _cache_set(cache_key, result, _QUOTE_TTL)
            return result

        except Exception as exc:
            if attempt == 0 and retry:
                logger.warning("get_quote failed for %s (attempt 1), retrying: %s", ticker, exc)
                continue
            logger.warning("get_quote failed for %s: %s", ticker, exc)
            return {
                "symbol": ticker,
                "company_name": None,
                "price": None,
                "previous_close": None,
                "day_change": None,
                "day_change_percent": None,
                "currency": None,
                "exchange": None,
                "market_state": None,
                "data_timestamp": _now_iso(),
                "error": f"Could not retrieve market data for {ticker}: {exc}",
            }


def get_historical_performance(ticker: str, period: str = "1y", retry: bool = True) -> dict[str, Any]:
    """
    Fetch historical OHLCV data and compute start/end price, return %, high, low.

    period: "1mo", "3mo", "6mo", "1y", "2y", "5y"
    """
    valid_periods = {"1mo", "3mo", "6mo", "1y", "2y", "5y"}
    if period not in valid_periods:
        period = "1y"

    cache_key = f"hist:{ticker}:{period}"
    cached = _cache_fetch(cache_key)
    if cached is not None:
        return cached

    for attempt in range(2 if retry else 1):
        try:
            import yfinance as yf

            t = yf.Ticker(ticker)
            hist = t.history(period=period)

            if hist is None or hist.empty:
                result = {
                    "symbol": ticker,
                    "period": period,
                    "start_price": None,
                    "end_price": None,
                    "return_percent": None,
                    "high": None,
                    "low": None,
                    "start_date": None,
                    "end_date": None,
                    "currency": None,
                    "data_timestamp": _now_iso(),
                    "error": f"No historical data available for {ticker} over {period}",
                }
                _cache_set(cache_key, result, _HISTORY_TTL)
                return result

            close = hist["Close"]
            start_price = _safe_float(close.iloc[0])
            end_price = _safe_float(close.iloc[-1])
            return_pct = None
            if start_price and end_price and start_price != 0:
                return_pct = round(((end_price - start_price) / start_price) * 100, 2)

            result = {
                "symbol": ticker,
                "period": period,
                "start_price": round(start_price, 2) if start_price else None,
                "end_price": round(end_price, 2) if end_price else None,
                "return_percent": return_pct,
                "high": round(float(hist["High"].max()), 2),
                "low": round(float(hist["Low"].min()), 2),
                "start_date": str(hist.index[0].date()),
                "end_date": str(hist.index[-1].date()),
                "currency": None,  # fetched separately if needed
                "data_timestamp": _now_iso(),
                "error": None,
            }

            _cache_set(cache_key, result, _HISTORY_TTL)
            return result

        except Exception as exc:
            if attempt == 0 and retry:
                logger.warning("get_historical_performance failed for %s (attempt 1), retrying: %s", ticker, exc)
                continue
            logger.warning("get_historical_performance failed for %s: %s", ticker, exc)
            return {
                "symbol": ticker,
                "period": period,
                "start_price": None,
                "end_price": None,
                "return_percent": None,
                "high": None,
                "low": None,
                "start_date": None,
                "end_date": None,
                "currency": None,
                "data_timestamp": _now_iso(),
                "error": f"Could not retrieve historical data for {ticker}: {exc}",
            }


def compare_securities(ticker1: str, ticker2: str, period: str = "1y") -> dict[str, Any]:
    """
    Compare two securities over a given period using backend calculations.
    Ollama receives pre-computed metrics, never raw price arrays.
    """
    data1 = get_historical_performance(ticker1, period)
    data2 = get_historical_performance(ticker2, period)

    # Fetch company names
    def _get_name(t: str) -> str | None:
        try:
            import yfinance as yf
            info = yf.Ticker(t).info or {}
            return _safe_str(info.get("longName") or info.get("shortName"))
        except Exception:
            return None

    name1 = _get_name(ticker1)
    name2 = _get_name(ticker2)

    winner = None
    if data1.get("return_percent") is not None and data2.get("return_percent") is not None:
        r1, r2 = data1["return_percent"], data2["return_percent"]
        if r1 > r2:
            winner = ticker1
        elif r2 > r1:
            winner = ticker2
        else:
            winner = "tie"

    return {
        "period": period,
        "security_1": {
            "symbol": ticker1,
            "company_name": name1,
            **{k: v for k, v in data1.items() if k != "symbol"},
        },
        "security_2": {
            "symbol": ticker2,
            "company_name": name2,
            **{k: v for k, v in data2.items() if k != "symbol"},
        },
        "winner_by_return": winner,
        "data_timestamp": _now_iso(),
    }


def get_company_info(ticker: str) -> dict[str, Any]:
    """
    Fetch static company fundamentals.
    Returns None for any field yfinance does not provide — never fabricates.
    """
    cache_key = f"info:{ticker}"
    cached = _cache_fetch(cache_key)
    if cached is not None:
        return cached

    try:
        import yfinance as yf

        info = yf.Ticker(ticker).info or {}

        market_cap = _safe_float(info.get("marketCap"))
        market_cap_cr = round(market_cap / 1e7, 2) if market_cap else None  # in Crores

        result: dict[str, Any] = {
            "symbol": ticker,
            "company_name": _safe_str(info.get("longName") or info.get("shortName")),
            "sector": _safe_str(info.get("sector")),
            "industry": _safe_str(info.get("industry")),
            "market_cap": market_cap,
            "market_cap_crores": market_cap_cr,
            "currency": _safe_str(info.get("currency")),
            "pe_ratio": _safe_float(info.get("trailingPE") or info.get("forwardPE")),
            "pb_ratio": _safe_float(info.get("priceToBook")),
            "dividend_yield": _safe_float(info.get("dividendYield")),
            "dividend_rate": _safe_float(info.get("dividendRate")),
            "52w_high": _safe_float(info.get("fiftyTwoWeekHigh")),
            "52w_low": _safe_float(info.get("fiftyTwoWeekLow")),
            "beta": _safe_float(info.get("beta")),
            "description": _safe_str(
                (info.get("longBusinessSummary") or "")[:300]  # trim to 300 chars
            ),
            "data_timestamp": _now_iso(),
            "error": None,
        }

        _cache_set(cache_key, result, _INFO_TTL)
        return result

    except Exception as exc:
        logger.warning("get_company_info failed for %s: %s", ticker, exc)
        return {
            "symbol": ticker,
            "company_name": None,
            "sector": None,
            "industry": None,
            "market_cap": None,
            "market_cap_crores": None,
            "currency": None,
            "pe_ratio": None,
            "pb_ratio": None,
            "dividend_yield": None,
            "dividend_rate": None,
            "52w_high": None,
            "52w_low": None,
            "beta": None,
            "description": None,
            "data_timestamp": _now_iso(),
            "error": f"Could not retrieve company info for {ticker}: {exc}",
        }


def get_company_performance(ticker: str) -> dict[str, Any]:
    """
    Fetch a comprehensive performance summary aggregating quote, multiple historical periods, and company info.
    """
    quote = get_quote(ticker)
    if quote.get("error"):
        return {"symbol": ticker, "error": quote["error"], "data_timestamp": _now_iso()}
        
    info = get_company_info(ticker)
    hist_1m = get_historical_performance(ticker, "1mo")
    hist_6m = get_historical_performance(ticker, "6mo")
    hist_1y = get_historical_performance(ticker, "1y")
    
    return {
        "symbol": ticker,
        "company_name": info.get("company_name") or quote.get("company_name"),
        "latest_price": quote.get("price"),
        "currency": quote.get("currency"),
        "previous_close": quote.get("previous_close"),
        "return_1m": hist_1m.get("return_percent"),
        "return_6m": hist_6m.get("return_percent"),
        "return_1y": hist_1y.get("return_percent"),
        "week_52_high": info.get("52w_high"),
        "week_52_low": info.get("52w_low"),
        "market_cap": info.get("market_cap"),
        "pe_ratio": info.get("pe_ratio"),
        "dividend_yield": info.get("dividend_yield"),
        "sector": info.get("sector"),
        "industry": info.get("industry"),
        "data_timestamp": _now_iso(),
        "source": "yfinance",
        "error": None
    }


def screen_stocks(max_price: float | None, period: str = "1y") -> dict[str, Any]:
    """
    Screen stocks from the known universe based on max price and sort by performance.
    """
    results = []
    
    # Iterate over unique tickers
    tickers = list(set(_INDIA_TICKER_MAP.values()))
    tickers.sort()  # Sort for determinism
    
    for ticker in tickers:
        quote = get_quote(ticker)
        if quote.get("error") or quote.get("price") is None:
            continue
            
        price = quote["price"]
        
        # Filter by price
        if max_price is not None and price > max_price:
            continue
            
        hist = get_historical_performance(ticker, period)
        if hist.get("error") or hist.get("return_percent") is None:
            continue
            
        results.append({
            "symbol": ticker,
            "company_name": quote["company_name"],
            "price": price,
            "currency": quote.get("currency") or "INR",
            "return_percent": hist["return_percent"],
            "performance_period": period,
            "data_date": quote["data_timestamp"]
        })
        
    # Rank by performance (highest return first)
    results.sort(key=lambda x: x["return_percent"], reverse=True)
    
    # Limit to top 5 to avoid overwhelming context
    top_results = results[:5]
    
    return {
        "query": {
            "market": "India",
            "max_share_price": max_price,
            "performance_period": period
        },
        "results": top_results,
        "source": "yfinance"
    }


# ── Commodity Data ────────────────────────────────────────────────────────────

# Commodity name → Yahoo Finance ticker mapping
_COMMODITY_TICKER_MAP: dict[str, str] = {
    "gold": "GC=F",  # Gold Futures
    "silver": "SI=F",  # Silver Futures
    "crude oil": "CL=F",  # Crude Oil Futures
    "natural gas": "NG=F",  # Natural Gas Futures
    "copper": "HG=F",  # Copper Futures
    "platinum": "PL=F",  # Platinum Futures
    "palladium": "PA=F",  # Palladium Futures
    # Alternative ETF representations
    "gold etf": "GLD",
    "silver etf": "SLV",
    "oil etf": "USO",
}


def resolve_commodity(query: str) -> str | None:
    """
    Resolve a commodity name to a Yahoo Finance ticker.
    """
    normalized = query.strip().lower()
    if normalized in _COMMODITY_TICKER_MAP:
        return _COMMODITY_TICKER_MAP[normalized]
    
    # Try partial match
    for name, ticker in _COMMODITY_TICKER_MAP.items():
        if normalized in name or name in normalized:
            return ticker
    
    return None


async def get_commodity_price(commodity: str, retry: bool = True) -> dict[str, Any]:
    """
    Fetch the current price of a commodity using real-time APIs.
    
    This function now uses the market_apis service for real-time data,
    falling back to yfinance if the API service is unavailable.
    
    Args:
        commodity: Commodity name (e.g., "gold", "silver", "crude oil")
        
    Returns:
        Dict with price information including current price, unit, source, and timestamp.
    """
    # Try to use real-time API first
    try:
        from app.modules.ai.tools.market_apis import get_market_service
        
        market_service = get_market_service()
        
        # Map commodity names to API symbols
        commodity_map = {
            "gold": "GOLD",
            "silver": "SILVER", 
            "crude oil": "CRUDE",
            "natural gas": "NATURAL_GAS",
            "copper": "COPPER",
        }
        
        api_symbol = commodity_map.get(commodity.lower())
        if api_symbol:
            data = await market_service.get_commodity_price(api_symbol)
            
            if data.get("available"):
                # Normalize response format
                return {
                    "commodity": commodity,
                    "symbol": data.get("symbol"),
                    "price": data.get("price"),
                    "unit": "troy oz" if commodity.lower() in ["gold", "silver"] else "unit",
                    "currency": data.get("currency"),
                    "source": data.get("source"),
                    "data_timestamp": data.get("updated_at"),
                    "available": True,
                    "error": None,
                }
    except Exception as exc:
        logger.warning("Failed to fetch commodity data from API: %s", exc)
    
    # Fallback to yfinance if API fails
    ticker = resolve_commodity(commodity)
    if not ticker:
        return {
            "commodity": commodity,
            "price": None,
            "unit": None,
            "change": None,
            "change_percent": None,
            "currency": None,
            "data_timestamp": _now_iso(),
            "source": "yfinance (fallback)",
            "available": False,
            "error": f"Commodity '{commodity}' not recognized. Available: gold, silver, crude oil, natural gas, copper, platinum, palladium"
        }
    
    cache_key = f"commodity:{ticker}"
    cached = _cache_fetch(cache_key)
    if cached is not None:
        cached["source"] = "yfinance (cached)"
        return cached
    
    for attempt in range(2 if retry else 1):
        try:
            import yfinance as yf
            
            t = yf.Ticker(ticker)
            info = t.info or {}
            
            # Primary price sources
            price = (
                _safe_float(info.get("currentPrice"))
                or _safe_float(info.get("regularMarketPrice"))
                or _safe_float(info.get("ask"))
            )
            prev_close = _safe_float(info.get("previousClose")) or _safe_float(
                info.get("regularMarketPreviousClose")
            )
            
            day_change = None
            day_change_pct = None
            if price is not None and prev_close is not None and prev_close != 0:
                day_change = round(price - prev_close, 2)
                day_change_pct = round((day_change / prev_close) * 100, 2)
            
            # Determine unit based on commodity
            unit_map = {
                "GC=F": "troy oz",
                "SI=F": "troy oz",
                "CL=F": "barrel",
                "NG=F": "MMBtu",
                "HG=F": "pound",
                "PL=F": "troy oz",
                "PA=F": "troy oz",
                "GLD": "share",
                "SLV": "share",
                "USO": "share",
            }
            unit = unit_map.get(ticker, "unit")
            
            result: dict[str, Any] = {
                "commodity": commodity,
                "symbol": ticker,
                "price": price,
                "unit": unit,
                "previous_close": prev_close,
                "day_change": day_change,
                "day_change_percent": day_change_pct,
                "currency": _safe_str(info.get("currency")) or "USD",
                "exchange": _safe_str(info.get("exchange") or info.get("fullExchangeName")),
                "market_state": _safe_str(info.get("marketState")),
                "data_timestamp": _now_iso(),
                "source": "yfinance (fallback)",
                "available": price is not None,
                "error": None if price else f"No price data available for {commodity}",
            }
            
            _cache_set(cache_key, result, _QUOTE_TTL)
            return result
            
        except Exception as exc:
            if attempt == 0 and retry:
                logger.warning("get_commodity_price failed for %s (attempt 1), retrying: %s", commodity, exc)
                continue
            logger.warning("get_commodity_price failed for %s: %s", commodity, exc)
            return {
                "commodity": commodity,
                "symbol": ticker,
                "price": None,
                "unit": None,
                "previous_close": None,
                "day_change": None,
                "day_change_percent": None,
                "currency": None,
                "exchange": None,
                "market_state": None,
                "data_timestamp": _now_iso(),
                "source": "yfinance (error)",
                "available": False,
                "error": f"Could not retrieve commodity data for {commodity}: {exc}",
            }

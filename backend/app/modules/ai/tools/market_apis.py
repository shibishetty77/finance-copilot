"""
Real-time Market API Integrations — CortexFi.

Provides live market data from external APIs to prevent hallucination.
Each API integration includes source attribution, timestamps, and error handling.

Supported APIs:
- Frankfurter (Forex) - Free, no API key required
- CoinGecko (Crypto) - Free tier available
- Twelve Data (Stocks/Forex/Commodities) - API key required

Architecture rule: This module provides REAL data only. No hardcoded values.
"""

from __future__ import annotations

import logging
import os
from datetime import datetime, timezone
from typing import Any

import httpx

logger = logging.getLogger(__name__)

# ── Configuration ─────────────────────────────────────────────────────────────

# API Keys from environment
COINGECKO_API_KEY = os.getenv("COINGECKO_API_KEY", "")
TWELVE_DATA_API_KEY = os.getenv("TWELVE_DATA_API_KEY", "")

# ── HTTP Client ───────────────────────────────────────────────────────────────

class MarketAPIClient:
    """HTTP client for market data APIs with proper error handling."""
    
    def __init__(self):
        self.client = httpx.AsyncClient(timeout=10.0)
    
    async def close(self):
        await self.client.aclose()
    
    async def get(self, url: str, params: dict[str, Any] | None = None, headers: dict[str, str] | None = None) -> dict[str, Any]:
        """Make GET request with error handling."""
        try:
            response = await self.client.get(url, params=params, headers=headers)
            response.raise_for_status()
            return response.json()
        except httpx.TimeoutException:
            logger.warning("API request timed out: %s", url)
            return {"error": "timeout", "message": "API request timed out"}
        except httpx.HTTPStatusError as e:
            logger.warning("API request failed with status %d: %s", e.response.status_code, url)
            return {"error": "http_error", "status": e.response.status_code, "message": str(e)}
        except Exception as e:
            logger.warning("API request failed: %s", e)
            return {"error": "api_error", "message": str(e)}

# ── Frankfurter API (Forex) ───────────────────────────────────────────────────

class FrankfurterAPI:
    """Frankfurter API for forex rates - Free, no API key required."""
    
    BASE_URL = "https://api.frankfurter.dev/v1"
    
    def __init__(self, client: MarketAPIClient):
        self.client = client
    
    async def get_rate(self, from_currency: str, to_currency: str = "INR") -> dict[str, Any]:
        """
        Get current exchange rate.
        
        Args:
            from_currency: Source currency code (e.g., "USD", "EUR")
            to_currency: Target currency code (default: "INR")
            
        Returns:
            Dict with rate, timestamp, and source info
        """
        url = f"{self.BASE_URL}/latest"
        params = {"from": from_currency.upper(), "to": to_currency.upper()}
        
        data = await self.client.get(url, params=params)
        
        if "error" in data:
            return {
                "error": data.get("message", "Failed to fetch forex rate"),
                "source": "Frankfurter API",
                "available": False
            }
        
        rates = data.get("rates", {})
        if to_currency.upper() not in rates:
            return {
                "error": f"Currency pair {from_currency}/{to_currency} not available",
                "source": "Frankfurter API",
                "available": False
            }
        
        rate = rates[to_currency.upper()]
        date_str = data.get("date")
        
        return {
            "symbol": f"{from_currency.upper()}/{to_currency.upper()}",
            "price": rate,
            "currency": to_currency.upper(),
            "source": "Frankfurter API",
            "updated_at": f"{date_str}T12:00:00Z" if date_str else datetime.now(timezone.utc).isoformat(),
            "available": True
        }

# ── CoinGecko API (Crypto) ────────────────────────────────────────────────────

class CoinGeckoAPI:
    """CoinGecko API for cryptocurrency prices."""
    
    BASE_URL = "https://api.coingecko.com/api/v3"
    
    def __init__(self, client: MarketAPIClient):
        self.client = client
        self.api_key = COINGECKO_API_KEY
    
    async def get_price(self, coin_id: str, vs_currency: str = "inr") -> dict[str, Any]:
        """
        Get current cryptocurrency price.
        
        Args:
            coin_id: CoinGecko coin ID (e.g., "bitcoin", "ethereum")
            vs_currency: Target currency (default: "inr")
            
        Returns:
            Dict with price, timestamp, and source info
        """
        url = f"{self.BASE_URL}/simple/price"
        params = {
            "ids": coin_id.lower(),
            "vs_currencies": vs_currency.lower(),
            "include_last_updated_at": "true"
        }
        
        headers = {}
        if self.api_key:
            headers["x-cg-demo-api-key"] = self.api_key
        
        data = await self.client.get(url, params=params, headers=headers)
        
        if "error" in data:
            return {
                "error": data.get("message", "Failed to fetch crypto price"),
                "source": "CoinGecko API",
                "available": False
            }
        
        if coin_id.lower() not in data:
            return {
                "error": f"Cryptocurrency '{coin_id}' not found",
                "source": "CoinGecko API",
                "available": False
            }
        
        coin_data = data[coin_id.lower()]
        price = coin_data.get(vs_currency.lower())
        last_updated = coin_data.get("last_updated_at")
        
        if price is None:
            return {
                "error": f"Price data unavailable for {coin_id} in {vs_currency}",
                "source": "CoinGecko API",
                "available": False
            }
        
        # Convert timestamp to ISO format
        updated_at = datetime.fromtimestamp(last_updated, tz=timezone.utc).isoformat() if last_updated else datetime.now(timezone.utc).isoformat()
        
        return {
            "symbol": coin_id.upper(),
            "price": price,
            "currency": vs_currency.upper(),
            "source": "CoinGecko API",
            "updated_at": updated_at,
            "available": True
        }

# ── Twelve Data API (Stocks/Forex/Commodities) ───────────────────────────────

class TwelveDataAPI:
    """Twelve Data API for stocks, forex, and commodities."""
    
    BASE_URL = "https://api.twelvedata.com"
    
    def __init__(self, client: MarketAPIClient):
        self.client = client
        self.api_key = TWELVE_DATA_API_KEY
    
    async def get_price(self, symbol: str) -> dict[str, Any]:
        """
        Get current price for stocks, forex, or commodities.
        
        Args:
            symbol: Trading symbol (e.g., "AAPL", "EUR/USD", "GOLD")
            
        Returns:
            Dict with price, timestamp, and source info
        """
        if not self.api_key:
            return {
                "error": "Twelve Data API key not configured",
                "source": "Twelve Data API",
                "available": False
            }
        
        url = f"{self.BASE_URL}/price"
        params = {"symbol": symbol, "apikey": self.api_key}
        
        data = await self.client.get(url, params=params)
        
        if "error" in data:
            return {
                "error": data.get("message", "Failed to fetch price from Twelve Data"),
                "source": "Twelve Data API",
                "available": False
        }
        
        if "code" in data and data["code"] == 429:
            return {
                "error": "API rate limit exceeded",
                "source": "Twelve Data API",
                "available": False
            }
        
        price = data.get("price")
        if price is None:
            return {
                "error": f"Price data unavailable for {symbol}",
                "source": "Twelve Data API",
                "available": False
            }
        
        # Parse timestamp
        timestamp = data.get("timestamp")
        updated_at = datetime.fromtimestamp(timestamp, tz=timezone.utc).isoformat() if timestamp else datetime.now(timezone.utc).isoformat()
        
        return {
            "symbol": symbol.upper(),
            "price": price,
            "currency": data.get("currency", "USD"),
            "source": "Twelve Data API",
            "updated_at": updated_at,
            "available": True
        }

# ── Unified Market Service ─────────────────────────────────────────────────────

class MarketDataService:
    """Unified service for fetching live market data from multiple sources."""
    
    def __init__(self):
        self.client = MarketAPIClient()
        self.frankfurter = FrankfurterAPI(self.client)
        self.coingecko = CoinGeckoAPI(self.client)
        self.twelve_data = TwelveDataAPI(self.client)
    
    async def close(self):
        await self.client.close()
    
    async def get_forex_rate(self, from_currency: str, to_currency: str = "INR") -> dict[str, Any]:
        """Get forex rate using Frankfurter API."""
        return await self.frankfurter.get_rate(from_currency, to_currency)
    
    async def get_crypto_price(self, coin_id: str, vs_currency: str = "inr") -> dict[str, Any]:
        """Get cryptocurrency price using CoinGecko API."""
        return await self.coingecko.get_price(coin_id, vs_currency)
    
    async def get_stock_price(self, symbol: str) -> dict[str, Any]:
        """Get stock price using Twelve Data API."""
        return await self.twelve_data.get_price(symbol)
    
    async def get_commodity_price(self, symbol: str) -> dict[str, Any]:
        """Get commodity price using Twelve Data API."""
        return await self.twelve_data.get_price(symbol)

# ── Singleton instance ─────────────────────────────────────────────────────────

_market_service: MarketDataService | None = None

def get_market_service() -> MarketDataService:
    """Get or create the market service singleton."""
    global _market_service
    if _market_service is None:
        _market_service = MarketDataService()
    return _market_service

async def close_market_service():
    """Close the market service connection."""
    global _market_service
    if _market_service is not None:
        await _market_service.close()
        _market_service = None
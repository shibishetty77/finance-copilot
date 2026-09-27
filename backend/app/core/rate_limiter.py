"""
Rate limiter configuration using slowapi.
"""

from slowapi import Limiter
from slowapi.util import get_remote_address

from app.config import settings

# Global limiter — keyed by client IP
# Use higher limits for test environment to avoid rate limiting during tests
limiter = Limiter(
    key_func=get_remote_address,
    default_limits=["1000/minute"],  # Increased for CI tests
)

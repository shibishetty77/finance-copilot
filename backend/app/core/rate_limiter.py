"""
Rate limiter configuration using slowapi.
"""

from slowapi import Limiter
from slowapi.util import get_remote_address

from app.config import settings

# Global limiter — keyed by client IP
limiter = Limiter(
    key_func=get_remote_address,
    default_limits=[f"{settings.RATE_LIMIT_PER_MINUTE}/minute"],
)

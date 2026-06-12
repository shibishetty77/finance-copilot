"""
Date and timezone helpers for Indian Standard Time (IST).
"""

from datetime import date, datetime, timedelta, timezone

# Indian Standard Time offset
IST = timezone(timedelta(hours=5, minutes=30))


def now_ist() -> datetime:
    """Return current datetime in IST."""
    return datetime.now(IST)


def today_ist() -> date:
    """Return today's date in IST."""
    return now_ist().date()


def to_ist(dt: datetime) -> datetime:
    """Convert a UTC datetime to IST."""
    return dt.astimezone(IST)


def format_date_indian(d: date) -> str:
    """Format a date in Indian DD/MM/YYYY style."""
    return d.strftime("%d/%m/%Y")

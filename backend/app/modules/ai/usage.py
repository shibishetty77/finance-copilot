"""
AI module — usage tracking.

Tracks per-call metrics for every AI request: provider, model, latency,
token counts, and errors. Currently stored in-memory only.

Future upgrade path:
  - Replace in-memory accumulator with async DB writes (separate table).
  - Expose a /api/v1/ai/usage endpoint for the dashboard.
  - Add Prometheus metrics export.

Usage:
    tracker = AIUsageTracker()
    record = await tracker.record(
        provider="gemini",
        model="gemini-2.5-flash",
        prompt_length=120,
        completion_length=80,
        tokens_used=200,
        latency_ms=430.2,
    )
"""

import logging
import time
from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any

logger = logging.getLogger(__name__)


@dataclass
class UsageRecord:
    """
    A single AI call record.

    All fields are populated at call time; tokens_used may be None if the
    provider does not expose usage metadata.
    """

    provider: str
    model: str
    prompt_length: int
    completion_length: int
    tokens_used: int | None
    latency_ms: float
    success: bool
    error_type: str | None
    timestamp: datetime = field(default_factory=lambda: datetime.now(UTC))

    def to_dict(self) -> dict[str, Any]:
        """Serialise to a plain dict (e.g. for JSON logs or future DB writes)."""
        return {
            "provider": self.provider,
            "model": self.model,
            "prompt_length": self.prompt_length,
            "completion_length": self.completion_length,
            "tokens_used": self.tokens_used,
            "latency_ms": round(self.latency_ms, 2),
            "success": self.success,
            "error_type": self.error_type,
            "timestamp": self.timestamp.isoformat(),
        }


class AIUsageTracker:
    """
    In-memory usage tracker for AI calls.

    Collects UsageRecord objects and logs them. Does NOT persist to the DB yet.
    Thread-safe for typical async FastAPI usage (single-threaded event loop).
    """

    def __init__(self) -> None:
        self._records: list[UsageRecord] = []

    # ── Public API ────────────────────────────────────────────────────────────

    def record(
        self,
        *,
        provider: str,
        model: str,
        prompt_length: int,
        completion_length: int,
        tokens_used: int | None,
        latency_ms: float,
        success: bool = True,
        error_type: str | None = None,
    ) -> UsageRecord:
        """
        Create and store a UsageRecord.

        Args:
            provider:           Provider name (e.g. 'gemini').
            model:              Model name (e.g. 'gemini-2.5-flash').
            prompt_length:      Character length of the prompt sent.
            completion_length:  Character length of the response received.
            tokens_used:        Total tokens consumed (prompt + completion), or None.
            latency_ms:         Round-trip time in milliseconds.
            success:            False if the call raised an exception.
            error_type:         Exception class name if success=False, else None.

        Returns:
            The created UsageRecord.
        """
        record = UsageRecord(
            provider=provider,
            model=model,
            prompt_length=prompt_length,
            completion_length=completion_length,
            tokens_used=tokens_used,
            latency_ms=latency_ms,
            success=success,
            error_type=error_type,
        )
        self._records.append(record)
        self._log(record)
        return record

    def get_summary(self) -> dict[str, Any]:
        """
        Return aggregate statistics over all recorded calls.

        Useful for a future /api/v1/ai/usage dashboard endpoint.
        """
        if not self._records:
            return {
                "total_calls": 0,
                "successful_calls": 0,
                "failed_calls": 0,
                "total_tokens": 0,
                "avg_latency_ms": 0.0,
            }

        successful = [r for r in self._records if r.success]
        failed = [r for r in self._records if not r.success]
        tokens = [r.tokens_used for r in self._records if r.tokens_used is not None]
        latencies = [r.latency_ms for r in successful]

        return {
            "total_calls": len(self._records),
            "successful_calls": len(successful),
            "failed_calls": len(failed),
            "total_tokens": sum(tokens),
            "avg_latency_ms": round(sum(latencies) / len(latencies), 2) if latencies else 0.0,
        }

    def get_recent(self, limit: int = 20) -> list[dict[str, Any]]:
        """Return the most recent N usage records as dicts."""
        return [r.to_dict() for r in self._records[-limit:]]

    # ── Helpers ───────────────────────────────────────────────────────────────

    @staticmethod
    def _log(record: UsageRecord) -> None:
        """Emit a structured log line for each AI call."""
        if record.success:
            logger.info(
                "AI call | provider=%s model=%s latency=%.1fms tokens=%s "
                "prompt_len=%d completion_len=%d",
                record.provider,
                record.model,
                record.latency_ms,
                record.tokens_used,
                record.prompt_length,
                record.completion_length,
            )
        else:
            logger.warning(
                "AI call FAILED | provider=%s model=%s latency=%.1fms error=%s",
                record.provider,
                record.model,
                record.latency_ms,
                record.error_type,
            )


def start_timer() -> float:
    """Return the current monotonic time in seconds. Use with elapsed_ms()."""
    return time.monotonic()


def elapsed_ms(start: float) -> float:
    """Return milliseconds elapsed since start_timer() was called."""
    return (time.monotonic() - start) * 1_000

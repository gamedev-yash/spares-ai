"""
Retry policy.

Only failures that a second attempt could plausibly fix are retried: 429,
5xx, and transport-level faults. 400/401/403/404 are decisions, not
weather - retrying them wastes time and hides the real problem. 401 is
handled separately by the client, which refreshes the token and makes one
more attempt.

Backoff is exponential with jitter. The jitter matters once more than one
worker is reading: without it, a fleet that all hit a 503 retries in
lockstep and re-creates the overload it is backing off from.

A ``Retry-After`` header wins over the computed delay when the server
supplies one - it knows better than the schedule does.
"""

from __future__ import annotations

import logging
import random
import time
from dataclasses import dataclass
from typing import Callable, TypeVar

from .errors import CPIError

log = logging.getLogger("cpi_client.retry")

T = TypeVar("T")

RETRYABLE_STATUS = frozenset({429, 500, 502, 503, 504})


@dataclass(frozen=True)
class RetryPolicy:
    attempts: int = 3            # total tries, not retries after the first
    base_delay: float = 1.0
    multiplier: float = 2.0
    max_delay: float = 30.0
    jitter: float = 0.25         # +/- this fraction of the computed delay

    def delay_for(self, attempt: int, *, retry_after: float | None = None) -> float:
        """Seconds to wait before ``attempt`` (1-based: attempt 2 is the first retry)."""
        if retry_after is not None:
            return min(retry_after, self.max_delay)
        raw = self.base_delay * (self.multiplier ** max(0, attempt - 2))
        raw = min(raw, self.max_delay)
        if self.jitter:
            spread = raw * self.jitter
            raw = max(0.0, raw + random.uniform(-spread, spread))
        return raw


DEFAULT_POLICY = RetryPolicy()


def is_retryable(error: BaseException) -> bool:
    if isinstance(error, CPIError):
        return bool(error.retryable)
    return False


def run_with_retry(
    operation: Callable[[int], T],
    *,
    policy: RetryPolicy = DEFAULT_POLICY,
    describe: str = "request",
    sleep: Callable[[float], None] = time.sleep,
) -> T:
    """Call ``operation(attempt)`` until it succeeds or retries run out.

    ``operation`` receives the 1-based attempt number so it can log or vary
    behaviour. Non-retryable errors propagate immediately.
    """
    last: BaseException | None = None
    for attempt in range(1, policy.attempts + 1):
        try:
            return operation(attempt)
        except BaseException as exc:  # noqa: BLE001 - re-raised below
            if not is_retryable(exc) or attempt == policy.attempts:
                raise
            last = exc
            wait = policy.delay_for(
                attempt + 1, retry_after=getattr(exc, "retry_after", None)
            )
            log.warning(
                "%s failed (attempt %d/%d): %s - retrying in %.1fs",
                describe, attempt, policy.attempts, exc, wait,
            )
            sleep(wait)

    assert last is not None  # unreachable: the loop either returns or raises
    raise last

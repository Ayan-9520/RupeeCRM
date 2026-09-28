"""Simple in-memory rate limit for public ingest endpoints."""

from __future__ import annotations

import time
from collections import defaultdict, deque

from fastapi import HTTPException, Request, status

# ip -> deque of timestamps
_buckets: dict[str, deque[float]] = defaultdict(deque)


def check_rate_limit(
    request: Request,
    *,
    limit: int = 30,
    window_sec: int = 60,
) -> None:
    ip = request.client.host if request.client else "unknown"
    now = time.time()
    q = _buckets[ip]
    while q and now - q[0] > window_sec:
        q.popleft()
    if len(q) >= limit:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many requests — try again shortly",
        )
    q.append(now)

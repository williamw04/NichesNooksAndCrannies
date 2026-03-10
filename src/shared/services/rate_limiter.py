"""Rate limiting utilities for API calls."""

import time
from collections import defaultdict
from threading import Lock
from typing import Optional


class RateLimiter:
    def __init__(self, requests_per_minute: int = 60, requests_per_second: Optional[int] = None):
        self.requests_per_minute = requests_per_minute
        self.requests_per_second = requests_per_second or max(1, requests_per_minute // 60)
        self.min_interval = 60.0 / requests_per_minute
        self._last_request_time: dict[str, float] = defaultdict(float)
        self._lock = Lock()

    def wait(self, service: str = "default") -> None:
        with self._lock:
            now = time.time()
            last = self._last_request_time[service]
            elapsed = now - last

            if elapsed < self.min_interval:
                sleep_time = self.min_interval - elapsed
                time.sleep(sleep_time)

            self._last_request_time[service] = time.time()

    def acquire(self, service: str = "default") -> float:
        with self._lock:
            now = time.time()
            last = self._last_request_time[service]
            elapsed = now - last

            if elapsed < self.min_interval:
                return self.min_interval - elapsed

            self._last_request_time[service] = time.time()
            return 0

    def reset(self, service: str = "default") -> None:
        with self._lock:
            self._last_request_time[service] = 0


class TokenBucket:
    def __init__(self, rate: float, capacity: int):
        self.rate = rate
        self.capacity = capacity
        self.tokens = capacity
        self.last_update = time.time()
        self._lock = Lock()

    def consume(self, tokens: int = 1) -> bool:
        with self._lock:
            now = time.time()
            elapsed = now - self.last_update
            self.tokens = min(self.capacity, self.tokens + elapsed * self.rate)
            self.last_update = now

            if self.tokens >= tokens:
                self.tokens -= tokens
                return True
            return False

    def wait_for_token(self, tokens: int = 1) -> None:
        while not self.consume(tokens):
            time.sleep(0.1)


_default_rate_limits = {
    "reddit": RateLimiter(requests_per_minute=60),
    "google_maps": RateLimiter(requests_per_minute=50),
    "serpapi": RateLimiter(requests_per_minute=30),
    "default": RateLimiter(requests_per_minute=60),
}


def get_rate_limiter(service: str) -> RateLimiter:
    return _default_rate_limits.get(service, _default_rate_limits["default"])

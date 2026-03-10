"""Simple in-memory caching service."""

import hashlib
import json
import time
from typing import Any, Optional


class Cache:
    def __init__(self, default_ttl: int = 3600):
        self.default_ttl = default_ttl
        self._cache: dict[str, tuple[Any, float]] = {}

    def _hash_key(self, key: str) -> str:
        return hashlib.md5(key.encode()).hexdigest()

    def get(self, key: str) -> Optional[Any]:
        hashed = self._hash_key(key)
        if hashed in self._cache:
            value, expiry = self._cache[hashed]
            if time.time() < expiry:
                return value
            del self._cache[hashed]
        return None

    def set(self, key: str, value: Any, ttl: Optional[int] = None) -> None:
        hashed = self._hash_key(key)
        expiry = time.time() + (ttl or self.default_ttl)
        self._cache[hashed] = (value, expiry)

    def delete(self, key: str) -> bool:
        hashed = self._hash_key(key)
        if hashed in self._cache:
            del self._cache[hashed]
            return True
        return False

    def clear(self) -> None:
        self._cache.clear()

    def cleanup_expired(self) -> int:
        now = time.time()
        expired = [k for k, (_, exp) in self._cache.items() if now >= exp]
        for key in expired:
            del self._cache[key]
        return len(expired)

    def get_or_set(self, key: str, factory: callable, ttl: Optional[int] = None) -> Any:
        value = self.get(key)
        if value is not None:
            return value
        value = factory()
        self.set(key, value, ttl)
        return value

    def cache_json(self, key: str, data: dict, ttl: Optional[int] = None) -> None:
        self.set(key, json.dumps(data), ttl)

    def get_json(self, key: str) -> Optional[dict]:
        value = self.get(key)
        if value:
            return json.loads(value)
        return None

    def stats(self) -> dict:
        return {
            "entries": len(self._cache),
            "keys": list(self._cache.keys()),
        }


_default_cache = Cache()


def get_cache() -> Cache:
    return _default_cache

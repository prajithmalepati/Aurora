"""Simple in-memory TTL cache for API query results.

Single-user app — no Redis needed. Each entry stores (value, expiry_timestamp).
"""

import time
from typing import Any


class TTLCache:
    """Dict-backed cache with per-key TTL expiration."""

    def __init__(self, default_ttl: float = 30.0):
        self._cache: dict[str, tuple[Any, float]] = {}
        self._default_ttl = default_ttl

    def get(self, key: str) -> Any | None:
        """Return cached value if not expired, else None."""
        entry = self._cache.get(key)
        if entry is None:
            return None
        value, expiry = entry
        if time.monotonic() >= expiry:
            del self._cache[key]
            return None
        return value

    def set(self, key: str, value: Any, ttl: float | None = None) -> None:
        """Store a value with optional per-key TTL (seconds)."""
        if ttl is None:
            ttl = self._default_ttl
        self._cache[key] = (value, time.monotonic() + ttl)

    def invalidate(self, key: str | None = None) -> None:
        """Invalidate a specific key, or clear all if key is None."""
        if key is None:
            self._cache.clear()
        else:
            self._cache.pop(key, None)

    def invalidate_prefix(self, prefix: str) -> None:
        """Remove all keys that start with the given prefix."""
        keys = [k for k in self._cache if k.startswith(prefix)]
        for k in keys:
            del self._cache[k]


# Global cache instances with different default TTLs
song_cache = TTLCache(default_ttl=30.0)       # 30s for song lists
folder_cache = TTLCache(default_ttl=60.0)     # 60s for folder tree
playlist_cache = TTLCache(default_ttl=15.0)   # 15s for playlist lists
tag_cache = TTLCache(default_ttl=30.0)        # 30s for tag lists

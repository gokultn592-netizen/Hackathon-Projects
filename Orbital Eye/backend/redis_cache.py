"""
backend/redis_cache.py

Resilient In-Memory & Distributed Caching Layer for OrbitalEye.
Supports Redis (primary) with automatic in-memory TTL fallback (secondary).
Guarantees zero-downtime: if Redis is offline, calls gracefully degrade without throwing errors.
"""

import asyncio
import json
import logging
import os
import time
from typing import Any, Optional
import redis.asyncio as aioredis
from dotenv import load_dotenv

logger = logging.getLogger(__name__)

# Global Redis client
_redis_client: Optional[aioredis.Redis] = None
_redis_available: bool = False
_last_connect_attempt: float = 0.0
RECONNECT_COOLDOWN_SEC = 30.0

# In-memory L1/fallback cache storage: { key: (data_json_str, expire_timestamp) }
_in_memory_cache: dict[str, tuple[str, float]] = {}


def is_redis_available() -> bool:
    """Return whether Redis is currently connected and active."""
    return _redis_available


async def init_redis() -> bool:
    """
    Initialize the async Redis client using environment variables.
    Safe to call on startup; never raises an exception.
    """
    global _redis_client, _redis_available, _last_connect_attempt
    load_dotenv()

    enabled = os.getenv("REDIS_ENABLED", "true").lower() in ("true", "1", "yes")
    if not enabled:
        logger.info("Redis caching disabled via REDIS_ENABLED=false; using in-memory fallback cache.")
        _redis_available = False
        return False

    host = os.getenv("REDIS_HOST", "localhost")
    port = int(os.getenv("REDIS_PORT", "6379"))
    password = os.getenv("REDIS_PASSWORD") or None
    db = int(os.getenv("REDIS_DB", "0"))

    _last_connect_attempt = time.time()
    try:
        client = aioredis.Redis(
            host=host,
            port=port,
            password=password,
            db=db,
            socket_timeout=1.5,
            socket_connect_timeout=1.5,
            decode_responses=True,
        )
        # Verify connection with ping (strict 1.5s timeout on Windows TCP)
        await asyncio.wait_for(client.ping(), timeout=1.5)
        _redis_client = client
        _redis_available = True
        logger.info(f"Connected to Redis cache at {host}:{port} (db={db})")
        return True
    except Exception as e:
        _redis_available = False
        _redis_client = None
        logger.info(f"Redis not reachable at {host}:{port} ({e}); using resilient in-memory TTL cache.")
        return False


async def close_redis() -> None:
    """Close the Redis client pool on application shutdown."""
    global _redis_client, _redis_available
    if _redis_client is not None:
        try:
            await _redis_client.aclose()
            logger.info("Redis cache client closed.")
        except Exception as e:
            logger.warning(f"Error closing Redis client: {e}")
        finally:
            _redis_client = None
            _redis_available = False


async def _maybe_reconnect_redis():
    """Background reconnect attempt if cooldown has elapsed."""
    global _last_connect_attempt
    if not _redis_available and (time.time() - _last_connect_attempt) > RECONNECT_COOLDOWN_SEC:
        await init_redis()


async def get_cached_json(key: str) -> Optional[Any]:
    """
    Retrieve cached JSON data by key.
    Checks Redis first; if Redis is down or key is missing, checks in-memory cache.
    Returns deserialized Python object (dict/list) or None if expired/not found.
    """
    await _maybe_reconnect_redis()

    # 1. Try Redis
    if _redis_available and _redis_client is not None:
        try:
            raw = await _redis_client.get(key)
            if raw is not None:
                return json.loads(raw)
        except Exception as e:
            logger.debug(f"Redis get error for {key}: {e}; falling back to memory.")

    # 2. In-memory fallback
    now = time.time()
    entry = _in_memory_cache.get(key)
    if entry is not None:
        data_str, expires_at = entry
        if now < expires_at:
            try:
                return json.loads(data_str)
            except Exception:
                return None
        else:
            _in_memory_cache.pop(key, None)

    return None


async def set_cached_json(key: str, data: Any, ttl_seconds: int = 10) -> bool:
    """
    Store data as JSON with a time-to-live in seconds.
    Writes to both Redis (if available) and in-memory cache.
    """
    try:
        data_str = json.dumps(data)
    except Exception as e:
        logger.warning(f"Failed to serialize cache data for key {key}: {e}")
        return False

    success = False
    now = time.time()

    # Always write to in-memory cache for fast L1 lookup & offline resilience
    _in_memory_cache[key] = (data_str, now + ttl_seconds)

    # Clean stale in-memory items periodically if cache grows large
    if len(_in_memory_cache) > 200:
        for k in list(_in_memory_cache.keys()):
            if _in_memory_cache[k][1] <= now:
                _in_memory_cache.pop(k, None)

    # Try Redis
    if _redis_available and _redis_client is not None:
        try:
            await _redis_client.set(key, data_str, ex=ttl_seconds)
            success = True
        except Exception as e:
            logger.debug(f"Redis set error for {key}: {e}")
    else:
        success = True  # Memory cache successfully saved

    return success

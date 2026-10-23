"""
Shared pytest fixtures for the OrbitalEye DBMS Edition test suite.

The backend is a FastAPI app that talks to Oracle 21c through an *async*
connection pool (`backend/db.py`). Two properties of `oracledb`'s async pool
drive the design of this file:

1. `oracledb.create_pool_async()` requires a **running** event loop, so the
   pool can only be created from inside a coroutine.
2. The pool is **bound to the event loop that created it**. Reusing a pool
   from a different loop fails with
   "got Future attached to a different loop", and reusing it after that
   loop has been closed fails with
   "AttributeError: 'NoneType' object has no attribute 'send'".

Because pytest gives every test function its own event loop, the pool
fixtures below are deliberately **function scoped**: the pool is created and
torn down inside the same loop that runs the test. `tests/test_service_disconnect.py`
predates this file and creates its pool inside a single `asyncio.run()` call,
which is loop-safe for the same reason.

The fixtures also reset the module-level `db._pool` global before and after
each test, so a pool left behind by another test (bound to a now-closed loop)
can never leak into the next one.
"""

import os
import sys
import socket
import urllib.request
import urllib.error

import pytest

# ---------------------------------------------------------------------------
# Project layout
# ---------------------------------------------------------------------------

TESTS_DIR = os.path.abspath(os.path.dirname(__file__))
ROOT_DIR = os.path.abspath(os.path.join(TESTS_DIR, ".."))
BACKEND_DIR = os.path.join(ROOT_DIR, "backend")
FRONTEND_DIR = os.path.join(ROOT_DIR, "frontend")
DATABASE_DIR = os.path.join(ROOT_DIR, "database")
DDL_DIR = os.path.join(DATABASE_DIR, "ddl")
OUTPUT_DIR = os.path.join(ROOT_DIR, "output")
ENV_FILE = os.path.join(ROOT_DIR, ".env")

# The backend is not an installed package: `backend/` is added to sys.path so
# that `main`, `db`, `schemas`, `routes.*` and `repositories.*` are importable
# exactly as they are when uvicorn runs from the backend directory.
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)


# ---------------------------------------------------------------------------
# Environment
# ---------------------------------------------------------------------------

def _load_project_env() -> None:
    """Load the project .env so Oracle/Redis settings are available in tests."""
    if not os.path.exists(ENV_FILE):
        return
    try:
        from dotenv import load_dotenv
        load_dotenv(dotenv_path=ENV_FILE, override=False)
    except Exception:  # pragma: no cover - dotenv is a hard runtime dependency
        pass


_load_project_env()


# ---------------------------------------------------------------------------
# Helper utilities
# ---------------------------------------------------------------------------

def port_is_open(host: str, port: int, timeout: float = 1.0) -> bool:
    """Return True when a TCP connection to host:port succeeds."""
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return True
    except OSError:
        return False


def http_get_json(url: str, timeout: float = 5.0):
    """GET a URL and decode the JSON body, or return None on any failure."""
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "OrbitalEye-Test"})
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            import json
            return json.loads(resp.read().decode("utf-8"))
    except Exception:
        return None


async def _reset_db_pool() -> None:
    """Drop any existing Oracle pool, even one bound to a dead event loop.

    `db.init_pool()` returns the existing pool when one is already registered,
    so a stale pool from a previous test would silently be reused and then
    fail with a cross-loop error. Clearing the global first guarantees every
    test gets a pool bound to its own event loop.
    """
    import db as db_module

    pool = db_module._pool
    db_module._pool = None
    if pool is None:
        return
    try:
        await pool.close()
    except Exception:
        # The owning loop may already be closed; the pool is being discarded
        # anyway, so a failure here is not actionable.
        pass


def _clear_memory_cache() -> None:
    """Empty the resilient in-memory cache so tests never see stale rows."""
    try:
        import redis_cache
        redis_cache._in_memory_cache.clear()
    except Exception:
        pass


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(autouse=True)
def _reset_caches_between_tests():
    """Guarantee every test starts with an empty fallback cache."""
    _clear_memory_cache()
    yield
    _clear_memory_cache()


@pytest.fixture
def project_root() -> str:
    return ROOT_DIR


@pytest.fixture
def frontend_dir() -> str:
    return FRONTEND_DIR


@pytest.fixture
def backend_dir() -> str:
    return BACKEND_DIR


@pytest.fixture
async def db_pool():
    """A function-scoped Oracle async pool bound to the test's event loop.

    With `asyncio_mode = auto` pytest-asyncio runs this async fixture on the
    same event loop that the test itself runs on, which is exactly what
    `oracledb`'s async pool requires.

    The test is skipped (rather than failed) when the database is unreachable,
    so the suite stays usable on a machine without an Oracle instance.
    """
    import db as db_module

    await _reset_db_pool()
    try:
        pool = db_module.init_pool()
    except Exception as exc:
        pytest.skip(f"Oracle database is not reachable: {exc}")

    try:
        yield pool
    finally:
        await _reset_db_pool()


@pytest.fixture
async def api_client():
    """An in-process ASGI client bound to the FastAPI app.

    Using `httpx.ASGITransport` exercises the real routing, dependency and
    serialisation stack in-process, so no separate server has to be running.
    """
    from httpx import ASGITransport, AsyncClient

    from main import app

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        yield client


@pytest.fixture
async def api_client_with_db(api_client, db_pool):
    """An ASGI client that also has a live Oracle pool available.

    The `db_pool` dependency is what guarantees `db.get_pool()` succeeds for
    the routes that talk to the database.
    """
    yield api_client

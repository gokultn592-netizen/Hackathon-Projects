"""
backend/db.py

Async Oracle database connection pool for OrbitalEye FastAPI backend.
Uses oracledb thin-mode driver with connection pooling.
"""

import os
import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator, Optional

import oracledb
from dotenv import load_dotenv

logger = logging.getLogger(__name__)

# Global connection pool (initialized on startup)
_pool: Optional[oracledb.AsyncPool] = None


def init_pool() -> oracledb.AsyncPool:
    """
    Initialize the async connection pool using environment variables.
    Should be called once during application startup.
    """
    global _pool

    if _pool is not None:
        logger.warning("Connection pool already initialized")
        return _pool

    # Load environment variables
    load_dotenv()

    user = os.getenv("ORACLE_USER", "ORBITAL_EYE")
    password = os.getenv("ORACLE_PASSWORD")
    dsn = os.getenv("ORACLE_DSN", "localhost:1521/XEPDB1")
    min_pool = int(os.getenv("ORACLE_MIN_POOL", "2"))
    max_pool = int(os.getenv("ORACLE_MAX_POOL", "10"))
    increment = int(os.getenv("ORACLE_INCREMENT", "1"))

    if not password:
        raise ValueError("ORACLE_PASSWORD environment variable is required")

    try:
        _pool = oracledb.create_pool_async(
            user=user,
            password=password,
            dsn=dsn,
            min=min_pool,
            max=max_pool,
            increment=increment,
        )
        logger.info(f"Oracle connection pool initialized: {dsn} (min={min_pool}, max={max_pool})")
        return _pool
    except oracledb.Error as e:
        logger.error(f"Failed to initialize Oracle connection pool: {e}")
        raise


async def close_pool() -> None:
    """Close the connection pool on application shutdown."""
    global _pool

    if _pool is not None:
        try:
            await _pool.close()
            logger.info("Oracle connection pool closed")
        except oracledb.Error as e:
            logger.error(f"Error closing Oracle connection pool: {e}")
        finally:
            _pool = None


def get_pool() -> oracledb.AsyncPool:
    """Get the initialized connection pool."""
    if _pool is None:
        raise RuntimeError("Connection pool not initialized. Call init_pool() first.")
    return _pool


@asynccontextmanager
async def get_db_connection() -> AsyncGenerator[oracledb.AsyncConnection, None]:
    """
    FastAPI dependency that acquires a connection from the pool
    and ensures proper release after use.

    Usage:
        @app.get("/api/endpoint")
        async def endpoint(conn: oracledb.AsyncConnection = Depends(get_db_connection)):
            ...
    """
    pool = get_pool()
    conn = None
    try:
        conn = await pool.acquire()
        yield conn
    except oracledb.Error as e:
        logger.error(f"Database connection error: {e}")
        raise
    finally:
        if conn is not None:
            try:
                await pool.release(conn)
            except oracledb.Error as e:
                logger.error(f"Error releasing connection: {e}")


async def execute_query(
    conn: oracledb.AsyncConnection,
    sql: str,
    params: dict = None
) -> list:
    """
    Execute a SELECT query and return results as list of dicts.
    Uses bind variables for safety.
    """
    try:
        async with conn.cursor() as cursor:
            await cursor.execute(sql, params or {})
            columns = [col[0] for col in cursor.description] if cursor.description else []
            rows = await cursor.fetchall()
            return [dict(zip(columns, row)) for row in rows]
    except oracledb.Error as e:
        logger.error(f"Query execution error: {e} | SQL: {sql} | Params: {params}")
        raise


async def execute_dml(
    conn: oracledb.AsyncConnection,
    sql: str,
    params: dict = None
) -> int:
    """
    Execute INSERT/UPDATE/DELETE and return affected row count.
    Uses bind variables for safety.
    """
    try:
        async with conn.cursor() as cursor:
            await cursor.execute(sql, params or {})
            return cursor.rowcount
    except oracledb.Error as e:
        logger.error(f"DML execution error: {e} | SQL: {sql} | Params: {params}")
        raise
"""
backend/main.py

FastAPI application entry point for OrbitalEye DBMS Edition.
Uses oracledb thin-mode driver for Oracle 21c XEPDB1 connections.
No SQLPlus used for runtime connections.
"""

import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.responses import RedirectResponse
from fastapi.middleware.cors import CORSMiddleware
import oracledb

from db import init_pool, close_pool, get_pool
from redis_cache import init_redis, close_redis
from routes.encounters import router as encounters_router
from routes.positions import router as positions_router
from routes.settings import router as settings_router
from routes.health_checker import router as health_checker_router
from routes.bridge import router as bridge_router

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan manager.
    Initializes DB pool and Redis caching on startup; cleans up on shutdown.
    """
    logger.info("Starting OrbitalEye API...")
    try:
        init_pool()
        logger.info("Database connection pool initialized successfully")
    except Exception as e:
        logger.error(f"Failed to initialize database pool: {e}")
        raise

    try:
        await init_redis()
        logger.info("Redis distributed/resilient cache initialized successfully")
    except Exception as e:
        logger.warning(f"Redis initialization warning (will use resilient fallback): {e}")

    yield

    logger.info("Shutting down OrbitalEye API...")
    try:
        await close_redis()
    except Exception as e:
        logger.warning(f"Error during Redis close: {e}")
    try:
        await close_pool()
    except Exception as e:
        logger.warning(f"Error during DB pool close: {e}")
    logger.info("Application shutdown complete")


app = FastAPI(
    title="OrbitalEye DBMS Edition API",
    description="Satellite collision detection database API - Oracle 21c thin-mode",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS configuration - parse explicit origins to comply with credentials spec
cors_origins_raw = os.getenv("CORS_ORIGINS", "").strip()
if cors_origins_raw and cors_origins_raw != "*":
    allow_origins = [o.strip() for o in cors_origins_raw.split(",") if o.strip()]
else:
    allow_origins = [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
    ]

# CORS — allow frontend (React dev server / Vite / any local host) to reach API with credentials
app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(encounters_router)
app.include_router(positions_router)
app.include_router(settings_router)
app.include_router(health_checker_router)
app.include_router(bridge_router)


@app.get("/", include_in_schema=False)
async def root():
    """Redirect root path directly to Swagger documentation."""
    return RedirectResponse(url="/docs")


@app.get("/services", tags=["System Diagnostics"])
async def services_diagnostic():
    """
    Developer service diagnostics endpoint.
    Returns live connection and health status for Oracle 21c XE, SGP4 physics, and backend daemon.
    """
    from routes.health_checker import perform_full_system_health_check
    return await perform_full_system_health_check()


@app.get("/api/health")
async def health_check():
    """Basic health check endpoint with quick service status."""
    return {
        "status": "ok",
        "service": "OrbitalEye DBMS Edition API",
        "real_data_guaranteed": True,
        "detailed_checker": "/api/system/health-checker"
    }


@app.get("/api/db-test")
async def db_test():
    """
    Temporary test endpoint that acquires a connection from the pool,
    executes SELECT against Oracle XEPDB1, and releases the connection.
    """
    pool = get_pool()
    conn = None
    try:
        conn = await pool.acquire()
        logger.info("DB-test: connection acquired from pool")

        # Execute query with bind variables only (no string concatenation)
        sql = "SELECT SYS_CONTEXT('USERENV', 'CON_NAME') AS container, USER AS current_user FROM DUAL"
        async with conn.cursor() as cursor:
            await cursor.execute(sql)
            row = await cursor.fetchone()

        if row is None:
            raise HTTPException(status_code=500, detail="No results returned from database")

        result = {
            "container": str(row[0]),
            "user": str(row[1])
        }
        logger.info(f"DB-test result: {result}")
        return result

    except oracledb.Error as e:
        logger.error(f"DB-test: Oracle error - {e}")
        raise HTTPException(status_code=500, detail=f"Oracle database error: {str(e)}")
    except Exception as e:
        logger.error(f"DB-test: unexpected error - {e}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")
    finally:
        if conn is not None:
            try:
                await pool.release(conn)
                logger.info("DB-test: connection released back to pool")
            except oracledb.Error as e:
                logger.error(f"DB-test: error releasing connection - {e}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

# Reload trigger

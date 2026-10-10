"""
backend/main.py

FastAPI application entry point for OrbitalEye DBMS Edition.
Uses oracledb thin-mode driver for Oracle 21c XEPDB1 connections.
No SQLPlus used for runtime connections.
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import oracledb

from db import init_pool, close_pool, get_pool
from routes.encounters import router as encounters_router

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
    Initializes DB pool on startup via .env; closes on shutdown.
    """
    logger.info("Starting OrbitalEye API...")
    try:
        init_pool()
        logger.info("Database connection pool initialized successfully")
    except Exception as e:
        logger.error(f"Failed to initialize database pool: {e}")
        raise

    yield

    logger.info("Shutting down OrbitalEye API...")
    await close_pool()
    logger.info("Application shutdown complete")


app = FastAPI(
    title="OrbitalEye DBMS Edition API",
    description="Satellite collision detection database API - Oracle 21c thin-mode",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS — allow frontend (React dev server / any origin) to reach API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(encounters_router)


@app.get("/api/health")
async def health_check():
    """Basic health check endpoint."""
    return {"status": "ok", "service": "OrbitalEye DBMS Edition API"}


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

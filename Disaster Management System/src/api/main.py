"""
FastAPI Server Entrypoint - Flood Command Center Backend
"""
import logging
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.api.routes import router
from src.api.monitoring_routes import router as monitor_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)

# Environment validation - fail fast if required vars are missing
REQUIRED_ENV_VARS = [
    "HOST",
    "PORT",
    "ENVIRONMENT",
    "LOG_LEVEL"
]
missing = [var for var in REQUIRED_ENV_VARS if not os.getenv(var)]
if missing:
    raise RuntimeError(f"Missing critical env vars: {', '.join(missing)}")

# Validate allowed origins from environment
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000").split(",")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Lifespan context manager for proper startup/shutdown handling.
    Loads heavy ML models and resources once at startup.
    """
    # Startup: Initialize singleton instances
    logger = logging.getLogger(__name__)
    logger.info("Initializing Flood Command Center services...")

    from src.models import FloodPredictorModel
    from src.optimizer import ResourceAllocator
    from src.preprocessing import DataFusionPipeline

    app.state.predictor = FloodPredictorModel()
    app.state.optimizer = ResourceAllocator()
    app.state.fusion_pipeline = DataFusionPipeline()

    logger.info("Flood Command Center services initialized successfully.")
    yield

    # Shutdown: Cleanup (if needed)
    logger.info("Shutting down Flood Command Center services.")


app = FastAPI(
    title="Flood Command Center Backend API",
    description="Production-grade, hackathon-appropriate disaster management platform backend providing data fusion, flood risk ML predictions, and resource allocation optimization.",
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)
app.include_router(monitor_router)


@app.get("/")
def root():
    return {
        "message": "Welcome to Flood Command Center Backend API",
        "documentation": "/docs",
        "health_check": "/api/v1/health"
    }


if __name__ == "__main__":
    import uvicorn
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("src.api.main:app", host=host, port=port, reload=True)

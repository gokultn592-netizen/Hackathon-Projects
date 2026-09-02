"""
FastAPI Server Entrypoint - Flood Command Center Backend
"""
import logging

try:
    from fastapi import FastAPI
    from fastapi.middleware.cors import CORSMiddleware
    HAS_FASTAPI = True
except ImportError:
    HAS_FASTAPI = False
    class FastAPI:
        def __init__(self, *args, **kwargs): pass
        def add_middleware(self, *args, **kwargs): pass
        def include_router(self, *args, **kwargs): pass
        def get(self, *args, **kwargs): return lambda f: f

from src.api.routes import router
from src.api.monitoring_routes import router as monitor_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)

app = FastAPI(
    title="Flood Command Center Backend API",
    description="Production-grade, hackathon-appropriate disaster management platform backend providing data fusion, flood risk ML predictions, and resource allocation optimization.",
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

if HAS_FASTAPI:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
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
    if HAS_FASTAPI:
        import uvicorn
        uvicorn.run("src.api.main:app", host="0.0.0.0", port=8000, reload=True)
    else:
        print("FastAPI is not installed in the current environment. Run: pip install -r requirements.txt")

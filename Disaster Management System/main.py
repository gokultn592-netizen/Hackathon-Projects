"""
FastAPI application entry point — Red River Basin Flood Command Center
"""
from fastapi import FastAPI
from src.api.routes import router
from src.optimizer.resource_allocator import ResourceAllocator
from src.preprocessing.fusion_pipeline import DataFusionPipeline
from src.models.flood_predictor import FloodPredictorModel

app = FastAPI(
    title="Red River Basin Flood Command Center",
    description="US Disaster Management Decision Support System",
    version="v0.2.0-US",
)

# Mount API routes
app.include_router(router, prefix="/api/v1")

# Initialize core services on startup
@app.on_event("startup")
async def startup():
    app.state.predictor = FloodPredictorModel()
    app.state.optimizer = ResourceAllocator()
    app.state.fusion_pipeline = DataFusionPipeline()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

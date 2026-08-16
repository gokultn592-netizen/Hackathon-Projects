"""
FastAPI Application Routes
"""
import logging
from typing import List, Dict, Any

try:
    from fastapi import APIRouter, HTTPException, Depends
    HAS_FASTAPI = True
except ImportError:
    HAS_FASTAPI = False
    class APIRouter:
        def __init__(self, *args, **kwargs): pass
        def get(self, *args, **kwargs): return lambda f: f
        def post(self, *args, **kwargs): return lambda f: f
    class HTTPException(Exception):
        def __init__(self, status_code: int, detail: str):
            self.status_code = status_code
            self.detail = detail
            super().__init__(detail)

from src.api.schemas import (
    HealthCheckResponse,
    TelemetryRequest,
    FloodPredictionRequest,
    FloodPredictionResponse,
    ResourceAllocationRequest,
    ResourceAllocationResponse,
)
from src.data_collectors import IMDDataCollector, WRISDataCollector, BhuvanDataCollector, DEMDataCollector
from src.preprocessing import DataFusionPipeline
from src.models import FloodPredictorModel
from src.optimizer import ResourceAllocator

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1", tags=["Flood Command Center API"])

# Initialize singleton instances
predictor = FloodPredictorModel()
optimizer = ResourceAllocator()
fusion_pipeline = DataFusionPipeline()


@router.get("/health", response_model=HealthCheckResponse)
def health_check():
    """Health check endpoint exposing service state & model initialization."""
    return HealthCheckResponse(
        status="HEALTHY",
        service="flood_command_center_backend",
        version="0.1.0",
        model_loaded=predictor.is_trained
    )


@router.post("/collect-data")
def collect_and_fuse_telemetry(req: TelemetryRequest):
    """
    Triggers multi-source telemetry acquisition (IMD, WRIS, Bhuvan, DEM) and runs data fusion.
    """
    try:
        imd_df = IMDDataCollector().fetch(region_code=req.region_code, use_simulation=req.use_simulation)
        wris_df = WRISDataCollector().fetch(region_code=req.region_code, use_simulation=req.use_simulation)
        bhuvan_df = BhuvanDataCollector().fetch(region_code=req.region_code, use_simulation=req.use_simulation)
        dem_df = DEMDataCollector().fetch(region_code=req.region_code, use_simulation=req.use_simulation)

        fused_df = fusion_pipeline.process_and_fuse(imd_df, wris_df, bhuvan_df, dem_df)
        
        return {
            "status": "SUCCESS",
            "records_fused": len(fused_df),
            "fused_telemetry": fused_df.to_dict(orient="records")
        }
    except Exception as e:
        logger.error(f"Data collection & fusion failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/predict", response_model=FloodPredictionResponse)
def predict_flood_risk(req: FloodPredictionRequest):
    """
    Calculates flood risk scores, severity levels, and estimated inundation depth for each district.
    """
    try:
        predictions = []
        for item in req.telemetry:
            res = predictor.predict_district(item.model_dump())
            predictions.append(res)

        return FloodPredictionResponse(
            status="SUCCESS",
            total_districts_evaluated=len(predictions),
            predictions=predictions
        )
    except Exception as e:
        logger.error(f"Flood prediction endpoint error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/optimize-resources", response_model=ResourceAllocationResponse)
def optimize_resources(req: ResourceAllocationRequest):
    """
    Runs the emergency resource optimization engine to allocate teams, boats, and medical supplies.
    """
    try:
        scores_input = [item.model_dump() for item in req.district_scores]
        resources_input = req.available_resources.model_dump() if req.available_resources else {}

        res = optimizer.optimize_allocation(scores_input, resources_input)
        return res
    except Exception as e:
        logger.error(f"Resource optimization endpoint error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

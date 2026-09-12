"""
FastAPI Application Routes (US Red River Basin)
"""
import logging
from typing import List, Dict, Any
from fastapi import APIRouter, HTTPException, Depends, Request

from src.api.schemas import (
    HealthCheckResponse,
    TelemetryRequest,
    FloodPredictionRequest,
    FloodPredictionResponse,
    ResourceAllocationRequest,
    ResourceAllocationResponse,
    DataAuditResponse,
)
from src.data_collectors import USGSDataCollector, NOAADataCollector, NOAAInundationCollector, CensusDataCollector, DEMDataCollector
from src.preprocessing import DataFusionPipeline
from src.models import FloodPredictorModel
from src.optimizer import ResourceAllocator, assign_evacuation_routes, deploy_fema_teams, generate_priority_list

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1", tags=["Red River Basin Flood Command Center API"])

from pydantic import BaseModel

class EvacuationRequest(BaseModel):
    communities: List[Dict[str, Any]]
    shelters: List[Dict[str, Any]]

class FEMADeploymentRequest(BaseModel):
    communities: List[Dict[str, Any]]
    fema_teams: List[Dict[str, Any]]

class PriorityRequest(BaseModel):
    communities: List[Dict[str, Any]]

class CostParameters(BaseModel):
    cost_false_alarm: float = 10000.0
    cost_missed_flood: float = 250000.0

@router.get("/health", response_model=HealthCheckResponse)
def health_check(request: Request):
    predictor = request.app.state.predictor
    return HealthCheckResponse(
        status="HEALTHY",
        service="red_river_flood_command_center_backend",
        version="v0.2.0",
        model_loaded=predictor.is_trained if hasattr(predictor, 'is_trained') else False
    )

@router.get("/data-audit", response_model=DataAuditResponse)
def audit_data_sources():
    import os
    sources = {}
    real_count = 0

    # 1. NOAA Rainfall
    noaa_path = "data/processed/noaa_rainfall.csv"
    sources["noaa_rainfall"] = {
        "name": "NOAA Daily Rainfall / Weather",
        "type": "REAL_DATA" if os.path.exists(noaa_path) else "MOCK_DATA",
        "status": "VERIFIED_REAL" if os.path.exists(noaa_path) else "SIMULATED_FALLBACK",
        "file_path": noaa_path,
        "records_count": 0,
        "file_size_bytes": 0,
        "details": "US NOAA weather and rainfall data for Red River Basin counties.",
        "source_url": "https://www.noaa.gov/"
    }
    if os.path.exists(noaa_path):
        real_count += 1

    # 2. USGS River Water Level
    usgs_path = "data/processed/usgs_river_levels.csv"
    sources["usgs_river_levels"] = {
        "name": "USGS NWIS River Gauge Telemetry",
        "type": "REAL_DATA" if os.path.exists(usgs_path) else "MOCK_DATA",
        "status": "VERIFIED_REAL" if os.path.exists(usgs_path) else "SIMULATED_FALLBACK",
        "file_path": usgs_path,
        "records_count": 0,
        "file_size_bytes": 0,
        "details": "Real river water level data for Red River stations (Fargo ND, Grand Forks ND, Wahpeton ND, Pembina ND).",
        "source_url": "https://waterdata.usgs.gov/"
    }
    if os.path.exists(usgs_path):
        real_count += 1

    # 3. US Census Population
    census_path = "data/raw/us_census_population.csv"
    sources["us_census_population"] = {
        "name": "US Census / American Community Survey County Population",
        "type": "REAL_DATA" if os.path.exists(census_path) else "MOCK_DATA",
        "status": "VERIFIED_REAL" if os.path.exists(census_path) else "SIMULATED_FALLBACK",
        "file_path": census_path,
        "records_count": 0,
        "file_size_bytes": 0,
        "details": "County-level population density for Red River Basin counties (Cass ND, Clay MN, Polk MN, etc.).",
        "source_url": "https://data.census.gov/"
    }
    if os.path.exists(census_path):
        real_count += 1

    # 4. NOAA Inundation / Soil Moisture
    inund_path = "data/raw/noaa_inundation.csv"
    sources["noaa_inundation"] = {
        "name": "NOAA Flood Extent & Soil Moisture",
        "type": "REAL_DATA" if os.path.exists(inund_path) else "MOCK_DATA",
        "status": "VERIFIED_REAL" if os.path.exists(inund_path) else "SIMULATED_FALLBACK",
        "file_path": inund_path,
        "records_count": 0,
        "file_size_bytes": 0,
        "details": "Satellite-derived flood extent and soil saturation estimates for US counties.",
        "source_url": "https://www.noaa.gov/"
    }
    if os.path.exists(inund_path):
        real_count += 1

    # 5. DEM (USGS 3DEP / OpenTopography SRTM)
    srtm_path = "data/raw/srtm_redriver.tif"
    sources["srtm_dem_elevation"] = {
        "name": "USGS 3DEP / OpenTopography SRTM DEM",
        "type": "REAL_DATA" if os.path.exists(srtm_path) else "MOCK_DATA",
        "status": "VERIFIED_REAL" if os.path.exists(srtm_path) else "SIMULATED_FALLBACK",
        "file_path": srtm_path,
        "records_count": 0,
        "file_size_bytes": 0,
        "details": "30m resolution elevation raster for Red River Basin.",
        "source_url": "https://www.usgs.gov/"
    }
    if os.path.exists(srtm_path):
        real_count += 1

    return DataAuditResponse(
        status="SUCCESS",
        is_all_real_data=real_count == len(sources),
        verified_real_sources_count=real_count,
        total_sources_count=len(sources),
        sources=sources
    )

@router.post("/collect-data")
def collect_and_fuse_telemetry(req: TelemetryRequest, request: Request):
    fusion_pipeline = request.app.state.fusion_pipeline
    noaa_df = NOAADataCollector().fetch(region_code=req.region_code, use_simulation=req.use_simulation)
    usgs_df = USGSDataCollector().fetch(region_code=req.region_code, use_simulation=req.use_simulation)
    inund_df = NOAAInundationCollector().fetch(region_code=req.region_code, use_simulation=req.use_simulation)
    census_df = CensusDataCollector().fetch(region_code=req.region_code, use_simulation=req.use_simulation)
    dem_df = DEMDataCollector().fetch(region_code=req.region_code, use_simulation=req.use_simulation)

    # For fusion, census and dem are combined
    import pandas as pd
    census_dem_df = pd.merge(census_df, dem_df, on="county_id", how="outer")
    fused_df = fusion_pipeline.process_and_fuse(noaa_df, usgs_df, inund_df, census_dem_df)
    return {
        "status": "SUCCESS",
        "records_fused": len(fused_df),
        "fused_telemetry": fused_df.to_dict(orient="records")
    }

@router.post("/predict", response_model=FloodPredictionResponse)
def predict_flood_risk(req: FloodPredictionRequest, request: Request):
    if not req.telemetry:
        raise HTTPException(status_code=400, detail="Telemetry data is required")
    predictor = request.app.state.predictor
    predictions = []
    for item in req.telemetry:
        res = predictor.predict_district(item.model_dump())
        predictions.append(res)
    return FloodPredictionResponse(
        status="SUCCESS",
        total_districts_evaluated=len(predictions),
        predictions=predictions
    )

@router.post("/optimize-resources", response_model=ResourceAllocationResponse)
def optimize_resources(req: ResourceAllocationRequest, request: Request, cost_params: CostParameters = CostParameters()):
    if not req.district_scores:
        raise HTTPException(status_code=400, detail="District scores are required")
    optimizer = request.app.state.optimizer
    scores_input = [item.model_dump() for item in req.district_scores]
    resources_input = req.available_resources.model_dump() if req.available_resources else {}
    # Resolve cost_params from request or default; keep original type for later access
    raw_cost_params = req.cost_params if (hasattr(req, 'cost_params') and req.cost_params) else CostParameters()
    # Convert to dict for resources_input update, but preserve attribute access if needed
    cost_dict = raw_cost_params.model_dump() if hasattr(raw_cost_params, 'model_dump') else dict(raw_cost_params)
    resources_input.update(cost_dict)
    resources_input["cost_false_alarm"] = cost_dict.get("cost_false_alarm", 10000.0)
    resources_input["cost_missed_flood"] = cost_dict.get("cost_missed_flood", 250000.0)
    return optimizer.optimize_allocation(scores_input, resources_input)

@router.post("/optimize-advanced/evacuation-routes")
def optimize_evacuation_routes(req: EvacuationRequest):
    communities = req.communities if hasattr(req, 'communities') else req.get('communities', [])
    shelters = req.shelters if hasattr(req, 'shelters') else req.get('shelters', [])
    if not communities:
        raise HTTPException(status_code=400, detail="Towns/counties are required")
    return assign_evacuation_routes(communities, shelters)

@router.post("/optimize-advanced/deploy-fema-teams", tags=["FEMA Team Deployment"])
def optimize_fema_deployment(req: FEMADeploymentRequest):
    communities = req.communities if hasattr(req, 'communities') else req.get('communities', [])
    fema_teams = req.fema_teams if hasattr(req, 'fema_teams') else req.get('fema_teams', [])
    if not communities:
        raise HTTPException(status_code=400, detail="Towns/counties are required")
    # Rename FEMA to US Emergency Response for Red River context
    return deploy_fema_teams(communities, fema_teams)

@router.post("/optimize-advanced/priority-list")
def generate_priority_ranking(req: PriorityRequest):
    communities = req.communities if hasattr(req, 'communities') else req.get('communities', [])
    if not communities:
        raise HTTPException(status_code=400, detail="Communities are required")
    ranked = generate_priority_list(communities)
    return {
        "status": "SUCCESS",
        "communities_ranked": len(ranked),
        "priority_list": ranked
    }

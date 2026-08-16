"""
Pydantic Schemas for API Requests & Responses
"""
from typing import List, Dict, Optional, Any
from pydantic import BaseModel, Field


class HealthCheckResponse(BaseModel):
    status: str = "HEALTHY"
    service: str = "flood_command_center_backend"
    version: str = "0.1.0"
    model_loaded: bool = False


class TelemetryRequest(BaseModel):
    region_code: str = Field(default="ALL", description="Region or state code")
    use_simulation: bool = Field(default=True, description="Force simulation fallback data if true")


class DistrictTelemetryData(BaseModel):
    district_id: str
    rainfall_24h_mm: float = 0.0
    rainfall_3d_accum_mm: float = 0.0
    humidity_percent: float = 0.0
    temperature_celsius: float = 0.0
    water_level_meters: float = 0.0
    danger_level_meters: float = 0.0
    discharge_rate_cumecs: float = 0.0
    reservoir_capacity_percent: float = 0.0
    is_above_danger: int = 0
    inundated_area_sqkm: float = 0.0
    inundation_percentage: float = 0.0
    soil_saturation_index: float = 0.0
    ndwi_water_index: float = 0.0
    mean_elevation_meters: float = 50.0
    mean_slope_degrees: float = 2.0
    drainage_density_km_sqkm: float = 1.5
    coastal_proximity_km: float = 20.0


class FloodPredictionRequest(BaseModel):
    telemetry: List[DistrictTelemetryData]


class DistrictPredictionResult(BaseModel):
    district_id: str
    risk_score: float
    risk_level: str
    estimated_inundation_depth_meters: float
    recommend_evacuation: bool


class FloodPredictionResponse(BaseModel):
    status: str = "SUCCESS"
    total_districts_evaluated: int
    predictions: List[DistrictPredictionResult]


class ResourceInventory(BaseModel):
    ndrf_teams: int = Field(default=50, ge=0)
    rescue_boats: int = Field(default=100, ge=0)
    medical_kits: int = Field(default=3000, ge=0)
    shelter_tents: int = Field(default=1500, ge=0)


class DistrictRiskScoreInput(BaseModel):
    district_id: str
    risk_score: float
    population_estimate: Optional[int] = 100000


class ResourceAllocationRequest(BaseModel):
    district_scores: List[DistrictRiskScoreInput]
    available_resources: Optional[ResourceInventory] = Field(default_factory=ResourceInventory)


class DistrictAllocationDetail(BaseModel):
    district_id: str
    priority_level: str
    risk_score: float
    allocated_ndrf_teams: int
    allocated_rescue_boats: int
    allocated_medical_kits: int
    allocated_shelter_tents: int
    evacuation_center_recommended: bool


class ResourceAllocationResponse(BaseModel):
    status: str
    total_districts_serviced: int
    unallocated_resources: Dict[str, int]
    district_allocations: List[DistrictAllocationDetail]

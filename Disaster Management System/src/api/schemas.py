"""
Pydantic Schemas for FastAPI Routes (US Red River Basin)
"""
from pydantic import BaseModel
from typing import List, Dict, Any

class HealthCheckResponse(BaseModel):
    status: str
    service: str
    version: str
    model_loaded: bool

class TelemetryRequest(BaseModel):
    region_code: str
    use_simulation: bool = False
    telemetry: List[Dict[str, Any]] = []

class FloodPredictionRequest(BaseModel):
    telemetry: List[Dict[str, Any]]

class FloodPredictionResponse(BaseModel):
    status: str
    total_districts_evaluated: int
    predictions: List[Dict[str, Any]]

class ResourceAllocationRequest(BaseModel):
    district_scores: List[Any]
    available_resources: Any = None
    cost_params: Any = None

class ResourceAllocationResponse(BaseModel):
    status: str
    total_districts_serviced: int
    unallocated_resources: Dict[str, int]
    district_allocations: List[Dict[str, Any]]

class DataAuditResponse(BaseModel):
    status: str
    is_all_real_data: bool
    verified_real_sources_count: int
    total_sources_count: int
    sources: Dict[str, Any]

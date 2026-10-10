"""
backend/schemas.py

Pydantic response models for the OrbitalEye FastAPI backend.
"""

from pydantic import BaseModel, Field


class EncounterPairResponse(BaseModel):
    """Response model for an encounter pair query result."""

    pair_id: int = Field(
        ..., description="Unique encounter pair identifier",
        example=1
    )
    sat_a_name: str = Field(
        ..., description="Name of satellite A",
        example="LEO-DEMO-25544"
    )
    sat_b_name: str = Field(
        ..., description="Name of satellite B",
        example="LEO-DEMO-25546"
    )
    miss_distance_km: float = Field(
        ..., description="Closest approach distance in kilometers",
        example=18.53
    )
    rel_velocity_kms: float = Field(
        ..., description="Relative velocity at closest approach in km/s",
        example=7.55
    )
    tca_utc: str = Field(
        ..., description="Time of closest approach as ISO 8601 UTC string",
        example="2026-10-03T12:00:00"
    )
    collision_prob: float = Field(
        ..., description="Collision probability (0.0 to 1.0)",
        example=0.0
    )
    sat_a_norad: int | None = Field(
        default=None, description="NORAD catalog ID for satellite A",
        example=25544
    )
    sat_b_norad: int | None = Field(
        default=None, description="NORAD catalog ID for satellite B",
        example=25546
    )


class SatellitePositionResponse(BaseModel):
    norad_id: int
    name: str
    x: float          # Three.js scene X (normalized to Earth radius = 1.0 unit)
    y: float          # Three.js scene Y
    z: float          # Three.js scene Z
    lat_deg: float    # Geodetic latitude
    lon_deg: float    # Geodetic longitude
    alt_km: float     # Altitude above Earth surface in km
    velocity_kms: float
    inclination_deg: float
    dataset_tag: str
    risk_category: str  # "CRITICAL" | "CAUTION" | "NOMINAL"


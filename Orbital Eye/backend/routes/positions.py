"""
Route: /api/satellites/positions — real-time SGP4 propagated positions
"""

import logging
from fastapi import APIRouter, Query, HTTPException, status
from repositories.satellite_position_repository import get_satellite_positions
from schemas import SatellitePositionResponse

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/satellites",
    tags=["satellites"],
)

@router.get(
    "/positions",
    response_model=list[SatellitePositionResponse],
    summary="Real-time satellite positions via SGP4",
    description=(
        "Propagates all TLE records in Oracle to the current UTC time using the SGP4 model. "
        "Returns 3D scene XYZ coordinates (Earth radius = 1.0 unit) ready for Three.js, "
        "plus geodetic lat/lon/alt and risk classification."
    ),
)
async def satellite_positions(
    dataset: str = Query(default="REALTIME", description="REALTIME or ACCIDENT"),
    limit: int = Query(default=100, ge=1, le=500, description="Max satellites to return"),
):
    try:
        return await get_satellite_positions(dataset_tag=dataset, limit=limit)
    except Exception as exc:
        logger.error("Satellite positions query failed: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to compute satellite positions.",
        )

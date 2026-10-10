"""
backend/routes/encounters.py

Route handler for encounter pair queries.
"""

import logging

from fastapi import APIRouter, Query, HTTPException, status
from pydantic import BaseModel, Field, conint

from repositories.encounter_repository import get_encounters
from schemas import EncounterPairResponse

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/encounters",
    tags=["encounters"],
)


class QueryParams(BaseModel):
    dataset: str = Field(
        default="REALTIME",
        description="Dataset tag filter (REALTIME or ACCIDENT)",
        example="REALTIME",
    )
    limit: conint(ge=1, le=200) = Field(
        default=50,
        description="Maximum number of results (1-200)",
        example=50,
    )


@router.get(
    "",
    response_model=list[EncounterPairResponse],
    summary="Retrieve encounter pairs",
    description=(
        "Returns encounter pair records with satellite names resolved via JOIN. "
        "Results are filtered by dataset_tag, ordered by miss_distance_km ascending, "
        "and paginated using FETCH FIRST."
    ),
)
@router.get(
    "/",
    response_model=list[EncounterPairResponse],
    include_in_schema=False,
)
async def list_encounters(
    dataset: str = Query(default="REALTIME", description="Dataset tag filter"),
    limit: int = Query(default=50, ge=1, le=200, description="Result limit (1-200)"),
):
    try:
        logger.info("GET /api/encounters dataset=%s limit=%d", dataset, limit)
        results = await get_encounters(dataset_tag=dataset, limit=limit)
        return results
    except Exception as exc:
        # Sanitized error — never expose raw Oracle codes
        logger.error("Encounter query failed: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error: unable to retrieve encounter data.",
        )

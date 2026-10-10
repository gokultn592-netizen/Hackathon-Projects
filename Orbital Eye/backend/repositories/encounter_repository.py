"""
backend/repositories/encounter_repository.py

Repository layer for encounter pair queries against Oracle 21c.
"""

import logging
import time
from typing import List

import oracledb

from schemas import EncounterPairResponse
from db import get_pool

logger = logging.getLogger(__name__)


async def get_encounters(
    dataset_tag: str = "REALTIME",
    limit: int = 50,
) -> List[EncounterPairResponse]:
    """
    Query encounter pairs from Oracle, joining with satellites (twice)
    to resolve NORAD IDs to satellite names.

    Uses bind variables exclusively (no string interpolation in SQL).
    Connection is properly released in a finally block.
    """
    pool = get_pool()
    conn = None
    start_time = time.time()

    try:
        conn = await pool.acquire()
        logger.info("Encounter query started (dataset_tag=%s, limit=%d)", dataset_tag, limit)

        # JOIN: encounter_pairs -> satellites (aliased s_a) on sat_a_norad = norad_id
        #       -> satellites (aliased s_b) on sat_b_norad = norad_id
        sql = """
            SELECT
                ep.pair_id,
                sa.satellite_name AS sat_a_name,
                sb.satellite_name AS sat_b_name,
                ep.miss_distance_km,
                ep.rel_velocity_kms,
                TO_CHAR(ep.tca_utc, 'YYYY-MM-DD"T"HH24:MI:SS') AS tca_utc,
                ep.collision_prob,
                ep.sat_a_norad,
                ep.sat_b_norad
            FROM encounter_pairs ep
            JOIN satellites sa ON ep.sat_a_norad = sa.norad_id
            JOIN satellites sb ON ep.sat_b_norad = sb.norad_id
            WHERE ep.dataset_tag = :dataset_tag
            ORDER BY ep.miss_distance_km ASC
            FETCH FIRST :limit ROWS ONLY
        """

        params = {
            "dataset_tag": dataset_tag,
            "limit": limit,
        }

        async with conn.cursor() as cursor:
            await cursor.execute(sql, params)
            rows = await cursor.fetchall()

            results = []
            for row in rows:
                results.append(EncounterPairResponse(
                    pair_id=int(row[0]),
                    sat_a_name=str(row[1]),
                    sat_b_name=str(row[2]),
                    miss_distance_km=round(float(row[3]), 2) if row[3] is not None else 0.0,
                    rel_velocity_kms=round(float(row[4]), 2) if row[4] is not None else 0.0,
                    tca_utc=str(row[5]),
                    collision_prob=round(float(row[6]), 2) if row[6] is not None else 0.0,
                    sat_a_norad=int(row[7]) if row[7] is not None else None,
                    sat_b_norad=int(row[8]) if row[8] is not None else None,
                ))

        elapsed = time.time() - start_time
        logger.info(
            "Encounter query completed (%d rows, %.3fs)", len(results), elapsed
        )
        return results

    except oracledb.Error as e:
        logger.error("Oracle DB error in get_encounters: %s", e, exc_info=True)
        # Do NOT expose raw Oracle error codes to clients
        raise
    finally:
        if conn is not None:
            try:
                await pool.release(conn)
                logger.debug("Connection released back to pool")
            except oracledb.Error as e:
                logger.error("Error releasing connection: %s", e)

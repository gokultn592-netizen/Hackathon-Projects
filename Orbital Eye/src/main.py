"""OrbitalEye — Pipeline Orchestrator (Vin Kan).
Sequential: Phase 1 → Filter → Phase 2 → Phase 3 → Phase 4 (if high risk).
"""
import logging
from skyfield.api import load
from src.ingest import fetch_catalog_tles, parse_catalog, preprocess_catalog
from src.filter import orbital_shell_filter, coarse_screen_catalog
from src.propagate import propagate_trajectory, initialize_covariance, pipeline_for_pair
from src.encounter import find_tca, b_plane_projection, combined_covariance_on_bplane, probability_collision
from src.mitigate import optimize_avoidance_maneuver

logging.basicConfig(level=logging.INFO, format="%(name)s | %(message)s")
logger = logging.getLogger("main")

ISS_CAT = 25544
TIANGONG_CAT = 48274

def run_pipeline():
    logger.info("Phase 1: Fetching catalog (%d objects)...", 2)
    raw_catalog = fetch_catalog_tles([ISS_CAT, TIANGONG_CAT])
    sats = preprocess_catalog(parse_catalog(raw_catalog))

    logger.info("Phase 1: Screening %d satellites...", len(sats))
    pairs = orbital_shell_filter(sats)
    ts = load.timescale()
    epoch = ts.utc(2026, 9, 16, 12, 0, 0)
    flagged = coarse_screen_catalog(sats, epoch)
    if not flagged:
        logger.info("No high-risk pairs flagged. Ending pipeline.")
        return
    pair = flagged[0]
    logger.info("Candidate pair: %s", pair)

    logger.info("Phase 2: Propagating trajectories...")
    start, end = epoch, ts.utc(2026, 9, 17, 12, 0, 0)
    result = pipeline_for_pair(sats, pair, start, end, step_sec=60)

    logger.info("Phase 3: Computing TCA and B-plane...")
    tca = find_tca(result["trajectory_x"], result["trajectory_y"], None)
    bp = b_plane_projection(tca)
    S = combined_covariance_on_bplane(result["P_r_x"], result["P_r_y"], bp)
    pc = probability_collision(S, bp["miss_distance_km"])
    logger.info("TCA miss distance: %.4f km | B·T: %.4f | Pc: %.6f", bp["miss_distance_km"], bp["B_T"], pc)

    if pc > 0.05:
        logger.info("Phase 4: HIGH RISK — Triggering avoidance optimization...")
        maneuver = optimize_avoidance_maneuver(tca, bp, S)
        logger.info("Optimal delta-v: %s km/s (mag: %.6f) | Status: %s",
                    maneuver["delta_v_km_s"], maneuver["delta_v_magnitude_km_s"], maneuver["status"])
    else:
        logger.info("Phase 4: Risk acceptable (Pc=%.6f). No maneuver required.", pc)

if __name__ == "__main__":
    run_pipeline()

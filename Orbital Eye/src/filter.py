"""OrbitalEye — Target-Centric Altitude Filter module. Solves $O(N^2)$ pair explosion."""
from __future__ import annotations
import logging
from concurrent.futures import ProcessPoolExecutor
from typing import List, Tuple
import numpy as np
from skyfield.api import EarthSatellite

logger = logging.getLogger(__name__)
SAFE_DISTANCE_KM = 50.0
MU_EARTH_KM3_S2 = 398600.4418
RADIUS_EARTH_KM = 6378.137
TARGET_ISS_NORAD_ID = 25544


def compute_perigee_apogee(satellite: EarthSatellite) -> Tuple[float, float]:
    """Calculate perigee and apogee altitudes in km from SGP4 mean motion and eccentricity."""
    no_kozai = satellite.model.no_kozai  # rad / min
    e = satellite.model.ecco
    if no_kozai <= 0:
        return float('nan'), float('nan')
    n_rad_s = no_kozai / 60.0
    a = (MU_EARTH_KM3_S2 / (n_rad_s ** 2)) ** (1.0 / 3.0)
    r_p = a * (1.0 - e)
    r_a = a * (1.0 + e)
    perigee_km = r_p - RADIUS_EARTH_KM
    apogee_km = r_a - RADIUS_EARTH_KM
    return perigee_km, apogee_km


def altitude_prune_catalog(
    satellites: List[EarthSatellite],
    target_norad_id: int = TARGET_ISS_NORAD_ID,
    band_km: float = 50.0
) -> Tuple[int, List[int]]:
    """Filters background catalog based on the target asset's altitude threat band.
    Discards any satellite whose apogee is below threat_min or perigee is above threat_max.
    Returns (target_index, list_of_pruned_background_indices).
    """
    target_idx = None
    for idx, s in enumerate(satellites):
        if getattr(s.model, 'satnum', None) == target_norad_id:
            target_idx = idx
            break
    if target_idx is None:
        target_idx = 0

    target_sat = satellites[target_idx]
    t_hp, t_ha = compute_perigee_apogee(target_sat)
    threat_min = t_hp - band_km
    threat_max = t_ha + band_km

    pruned_indices = []
    for idx, s in enumerate(satellites):
        if idx == target_idx:
            continue
        hp, ha = compute_perigee_apogee(s)
        if np.isnan(hp) or np.isnan(ha):
            continue
        # Discard if apogee < threat_min or perigee > threat_max
        if ha < threat_min or hp > threat_max:
            continue
        pruned_indices.append(idx)

    target_name = getattr(target_sat, 'name', 'Target')
    target_catnum = getattr(target_sat.model, 'satnum', target_norad_id)
    logger.info(
        "Altitude Screen (%s NORAD %d): perigee %.1f km, apogee %.1f km -> threat band [%.1f, %.1f] km. Retained %d/%d satellites.",
        target_name, target_catnum, t_hp, t_ha, threat_min, threat_max, len(pruned_indices), max(0, len(satellites) - 1)
    )
    return target_idx, pruned_indices


def _check_pair_batch(args):
    pairs_batch, positions, threshold_km = args
    flagged = []
    threshold_sq = threshold_km * threshold_km
    for i, j in pairs_batch:
        diff = positions[i] - positions[j]
        dist_sq = diff[0] * diff[0] + diff[1] * diff[1] + diff[2] * diff[2]
        if dist_sq < threshold_sq:
            flagged.append((i, j))
    return flagged


def orbital_shell_filter(satellites: List[EarthSatellite], max_sma_diff_km: float = 500.0) -> List[Tuple[int, int]]:
    periods = []
    for s in satellites:
        n = s.model.no_kozai / (60.0 * 2.0 * np.pi)
        period_min = 1.0 / (n * 24.0 / 1440.0) if n > 0 else float('inf')
        periods.append(period_min)
    periods = np.array(periods)
    survivors = []
    n_sat = len(satellites)
    for i in range(n_sat):
        for j in range(i + 1, n_sat):
            if abs(periods[i] - periods[j]) < 120.0:
                survivors.append((i, j))
    logger.info("Orbital shell filter: %d/%d pairs retained", len(survivors), n_sat * (n_sat - 1) // 2)
    return survivors


def coarse_screen_catalog(
    satellites: List[EarthSatellite],
    epoch,
    threshold_km: float = SAFE_DISTANCE_KM,
    target_norad_id: int = TARGET_ISS_NORAD_ID
) -> List[Tuple[int, int]]:
    if not satellites or len(satellites) < 2:
        return []

    # 1. Target-Centric Altitude Filtering
    target_idx, pruned_bg_indices = altitude_prune_catalog(satellites, target_norad_id=target_norad_id, band_km=50.0)
    if not pruned_bg_indices:
        return []

    # 2. Extract ECI positions at epoch
    positions = np.array([s.at(epoch).position.km for s in satellites])

    # 3. Linear Screening Pairs: (target_asset, background_satellite)
    target_pairs = [(target_idx, bg_idx) for bg_idx in pruned_bg_indices]

    # 4. Multi-core distance screening across CPUs
    batch_size = max(500, len(target_pairs) // 16)
    batches = [target_pairs[i:i + batch_size] for i in range(0, len(target_pairs), batch_size)]

    flagged = []
    tasks = [(batch, positions, threshold_km) for batch in batches]

    with ProcessPoolExecutor() as executor:
        results = executor.map(_check_pair_batch, tasks)
        for res in results:
            flagged.extend(res)

    logger.info(
        "Target-Centric Linear Screen: %d/%d pairs flagged under %s km",
        len(flagged), len(target_pairs), threshold_km
    )
    return flagged

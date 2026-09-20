"""OrbitalEye — Phase 2: Propagation & Uncertainty Engine."""
from __future__ import annotations
import logging
from typing import List, Tuple, Dict
import numpy as np
from skyfield.api import EarthSatellite
logger = logging.getLogger(__name__)
POS_STD_M = 30.0
VEL_STD_MPS = 0.001

def propagate_trajectory(satellite: EarthSatellite, start_utc, end_utc, step_sec: int = 60) -> np.ndarray:
    steps = max(1, int((end_utc.utc_datetime() - start_utc.utc_datetime()).total_seconds() // step_sec))
    records = []
    current = start_utc
    for _ in range(steps):
        geo = satellite.at(current)
        r = np.array(geo.position.km)
        v = np.array(geo.velocity.km_per_s)
        records.append([current.utc_iso(), float(r[0]), float(r[1]), float(r[2]), float(v[0]), float(v[1]), float(v[2])])
        from skyfield.api import load
        current = load.timescale().utc(current.utc[0], current.utc[1], current.utc[2], current.utc[3], current.utc[4], current.utc[5] + step_sec)
    return np.array(records, dtype=object)

def initialize_covariance() -> Tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    pos_std_km = POS_STD_M / 1000.0
    vel_std_km_s = VEL_STD_MPS / 1000.0
    P_r = np.eye(3) * (pos_std_km ** 2)
    P_v = np.eye(3) * (vel_std_km_s ** 2)
    return P_r, P_v, P_r.copy(), P_v.copy()

def pipeline_for_pair(satellites: List[EarthSatellite], pair: Tuple[int, int], start_utc, end_utc, step_sec: int = 60) -> Dict:
    i, j = pair
    P_r_x, P_v_x, P_r_y, P_v_y = initialize_covariance()
    traj_x = propagate_trajectory(satellites[i], start_utc, end_utc, step_sec)
    traj_y = propagate_trajectory(satellites[j], start_utc, end_utc, step_sec)
    return {
        "primary_index": i, "secondary_index": j,
        "P_r_x": P_r_x, "P_v_x": P_v_x, "P_r_y": P_r_y, "P_v_y": P_v_y,
        "trajectory_x": traj_x, "trajectory_y": traj_y,
    }

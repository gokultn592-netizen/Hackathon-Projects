"""Integration: Phase 1 (ingest/filter) + Phase 2 (propagate) end-to-end."""
import numpy as np
from skyfield.api import load
from src.ingest import fetch_catalog_tles, parse_catalog, preprocess_catalog
from src.filter import orbital_shell_filter, coarse_screen_catalog
from src.propagate import initialize_covariance, pipeline_for_pair, propagate_trajectory
ISS_CAT = 25544

def test_pipeline_phases_1_2():
    raw_catalog = fetch_catalog_tles([ISS_CAT, ISS_CAT])
    sats = preprocess_catalog(parse_catalog(raw_catalog))
    assert len(sats) >= 2
    pairs = orbital_shell_filter(sats)
    assert len(pairs) > 0
    ts = load.timescale()
    epoch = ts.utc(2026, 9, 16, 12, 0, 0)
    flagged = coarse_screen_catalog(sats, epoch)
    assert isinstance(flagged, list)
    P_r_x, P_v_x, P_r_y, P_v_y = initialize_covariance()
    assert P_r_x.shape == (3, 3) and P_v_x.shape == (3, 3)
    assert np.allclose(P_r_x, P_r_x.T)
    start, end = epoch, ts.utc(2026, 9, 17, 12, 0, 0)
    pair = flagged[0] if flagged else pairs[0]
    result = pipeline_for_pair(sats, pair, start, end, step_sec=60)
    traj = result["trajectory_x"]
    assert traj.shape[1] == 7  # [t, r3, v3]
    assert len(traj) >= 1

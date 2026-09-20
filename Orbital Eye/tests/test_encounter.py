"""Unit & Integration Tests for Phase 3 — src/encounter.py."""
from src.encounter import find_tca, b_plane_projection, combined_covariance_on_bplane, probability_collision
from src.propagate import initialize_covariance, propagate_trajectory
from src.ingest import fetch_catalog_tles, parse_catalog, preprocess_catalog
from skyfield.api import load
ISS_CAT = 25544

def test_tca_and_bplane():
    raw = fetch_catalog_tles([ISS_CAT, ISS_CAT])
    sats = preprocess_catalog(parse_catalog(raw))
    ts = load.timescale()
    start = ts.utc(2026, 9, 16, 12, 0, 0)
    end = ts.utc(2026, 9, 16, 13, 0, 0)
    traj_x = propagate_trajectory(sats[0], start, end, step_sec=60)
    traj_y = propagate_trajectory(sats[1], start, end, step_sec=60)
    tca = find_tca(traj_x, traj_y, None)
    assert "min_distance_km" in tca
    assert tca["min_distance_km"] >= 0
    bp = b_plane_projection(tca)
    assert "B_T" in bp
    assert "miss_distance_km" in bp

def test_covariance_and_pc():
    P_r, _, _, _ = initialize_covariance()
    tca_info = {"v_rel_km_s": [1.0, 0.0, 0.1], "r_rel_km": [0.0, 0.05, 0.0]}
    bp = b_plane_projection(tca_info)
    S = combined_covariance_on_bplane(P_r, P_r, bp)
    assert S.shape == (2, 2)
    pc = probability_collision(S, bp["miss_distance_km"], hard_body_radius_km=0.01)
    assert 0.0 <= pc <= 1.0

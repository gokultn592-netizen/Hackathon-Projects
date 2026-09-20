"""Tests for src/propagate.py — Propagation & Uncertainty."""
from src.propagate import propagate_trajectory, initialize_covariance, pipeline_for_pair, POS_STD_M
from src.ingest import fetch_catalog_tles, parse_catalog, preprocess_catalog
from skyfield.api import load

ISS_CAT = 25544

def test_covariance_init():
    P_r, P_v, _, _ = initialize_covariance()
    assert P_r.shape == (3, 3)
    assert P_v.shape == (3, 3)

def test_prop_trajectory_shape():
    raw = fetch_catalog_tles([ISS_CAT])
    sats = preprocess_catalog(parse_catalog(raw))
    ts = load.timescale()
    start = ts.utc(2026, 9, 16, 12, 0, 0)
    end = ts.utc(2026, 9, 16, 12, 1, 0)
    traj = propagate_trajectory(sats[0], start, end, step_sec=60)
    assert len(traj) > 0
    assert len(traj[0]) == 7

def test_pipeline_for_pair():
    raw = fetch_catalog_tles([ISS_CAT, ISS_CAT])
    sats = preprocess_catalog(parse_catalog(raw))
    ts = load.timescale()
    start = ts.utc(2026, 9, 16, 12, 0, 0)
    end = ts.utc(2026, 9, 16, 12, 0, 30)
    result = pipeline_for_pair(sats, (0, 1), start, end, step_sec=60)
    assert "P_r_x" in result
    assert "trajectory_x" in result

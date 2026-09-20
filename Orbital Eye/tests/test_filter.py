"""Tests for src/filter.py — Coarse Screening Filter."""
from src.filter import orbital_shell_filter, coarse_screen_catalog, SAFE_DISTANCE_KM
from src.ingest import fetch_catalog_tles, parse_catalog, preprocess_catalog
from skyfield.api import load

ISS_CAT = 25544

def test_fixed_threshold():
    assert SAFE_DISTANCE_KM == 100.0

def test_orbital_shell_filter():
    raw = fetch_catalog_tles([ISS_CAT, ISS_CAT])
    sats = preprocess_catalog(parse_catalog(raw))
    pairs = orbital_shell_filter(sats)
    assert isinstance(pairs, list)

def test_coarse_screen_catalog():
    raw = fetch_catalog_tles([ISS_CAT])
    sats = preprocess_catalog(parse_catalog(raw)) + preprocess_catalog(parse_catalog(raw))
    ts = load.timescale()
    epoch = ts.utc(2026, 9, 16, 12, 0, 0)
    flagged = coarse_screen_catalog(sats, epoch)
    assert isinstance(flagged, list)

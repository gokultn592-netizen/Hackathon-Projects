"""Unit tests for scalable $N$-catalog ingestion (ISS + multi-record)."""
from src.ingest import (
    fetch_tle, parse_tle, parse_pair,
    fetch_catalog_tles, parse_catalog, preprocess_catalog
)

ISS_CAT = 25544

def test_parse_pair_iss():
    raw = fetch_tle(ISS_CAT)
    (name_x, l1_x, l2_x), (name_y, l1_y, l2_y) = parse_pair(raw, raw)
    assert len(l1_x) == 69 and len(l2_y) == 69


def test_multi_catalog_batch():
    """Batch fetch and parse $N$ catalog objects."""
    raw = fetch_catalog_tles([ISS_CAT])
    records = parse_catalog(raw)
    assert isinstance(records, list)
    assert len(records) >= 1
    sats = preprocess_catalog(records)
    assert isinstance(sats, list)
    assert len(sats) >= 1

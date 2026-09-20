"""
OrbitalEye (Vin Kan) — Data ingestion, TLE parsing, and ECI frame transformation.

Exposes a clean public API:
    fetch_tle(cat_nr)
    parse_tle(raw_text)
    get_eci_state(satellite, ts, t)

No side effects occur at import time (no top-level network calls,
no timescale initialization).
"""

from __future__ import annotations

import logging
import re
from pathlib import Path
from typing import Tuple

import requests
from skyfield.api import EarthSatellite, load

logger = logging.getLogger(__name__)

# Resolve data directory relative to this file (not cwd)
DATA_DIR = Path(__file__).resolve().parent.parent / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)

CELESTRAK_GP_URL = "https://celestrak.org/NORAD/elements/gp.php"


def fetch_tle(cat_nr: int) -> str:
    """Fetch the two-line element set (TLE) for the given catalog number.

    Queries the CelesTrak GP endpoint. The raw TLE text is cached to
    ``data/{cat_nr}.tle`` on first fetch; subsequent calls read from the
    cache file instead of hitting the network.

    Args:
        cat_nr: Catalog number (NORAD ID) of the satellite.

    Returns:
        Raw multi-line TLE string.

    Raises:
        ValueError: If the response is empty, malformed, or the HTTP
            request fails for any reason (connection error, non-200 status).
    """
    cache_file = DATA_DIR / f"{cat_nr}.tle"

    # Return cached data if available
    if cache_file.exists():
        logger.info("Cache hit for CATNR=%s: %s", cat_nr, cache_file)
        raw_text = cache_file.read_text(encoding="utf-8")
        return raw_text

    url = f"{CELESTRAK_GP_URL}?CATNR={cat_nr}&FORMAT=TLE"
    logger.info("Fetching TLE for CATNR=%s from %s", cat_nr, url)

    try:
        response = requests.get(url, timeout=30)
    except requests.exceptions.ConnectionError as exc:
        msg = f"Connection error fetching TLE for CATNR={cat_nr}: {exc}"
        logger.error(msg)
        raise ValueError(msg) from exc
    except requests.exceptions.Timeout as exc:
        msg = f"Request timeout fetching TLE for CATNR={cat_nr}: {exc}"
        logger.error(msg)
        raise ValueError(msg) from exc

    if response.status_code != 200:
        msg = (
            f"HTTP {response.status_code} fetching TLE for CATNR={cat_nr}: "
            f"{response.text!r}"
        )
        logger.error(msg)
        raise ValueError(msg)

    raw_text = response.text
    if not raw_text or not raw_text.strip():
        msg = f"Empty or malformed TLE response for CATNR={cat_nr}"
        logger.error(msg)
        raise ValueError(msg)

    # Write cache regardless of where script was invoked from
    cache_file.write_text(raw_text, encoding="utf-8")
    logger.info("TLE cached to %s", cache_file)
    return raw_text


def parse_tle(raw_text: str) -> Tuple[str, str, str]:
    """Parse and validate a raw TLE string.

    Strips whitespace from each line, extracts exactly three lines
    (satellite name, TLE line 1, TLE line 2), validates line prefixes,
    checks exact 69-character line lengths, and verifies the standard
    TLE checksum digit on lines 1 and 2.

    Args:
        raw_text: Raw multi-line string from fetch_tle.

    Returns:
        A tuple of (satellite_name, line1, line2).

    Raises:
        ValueError: If line prefixes are wrong, line lengths are not 69,
            or the checksum digit does not match.
    """
    lines = [line.strip() for line in raw_text.splitlines() if line.strip() != ""]

    if len(lines) < 3:
        raise ValueError(f"Expected at least 3 non-empty lines, got {len(lines)}")

    name = lines[0]
    line1 = lines[1]
    line2 = lines[2]

    # Validate line prefixes
    if not line1.startswith("1 "):
        raise ValueError(f"TLE line 1 must start with '1 ', got: {line1!r}")
    if not line2.startswith("2 "):
        raise ValueError(f"TLE line 2 must start with '2 ', got: {line2!r}")

    # Validate exact 69-character length
    if len(line1) != 69:
        raise ValueError(
            f"TLE line 1 must be exactly 69 characters, got {len(line1)}"
        )
    if len(line2) != 69:
        raise ValueError(
            f"TLE line 2 must be exactly 69 characters, got {len(line2)}"
        )

    # Validate checksum digit (last character, standard TLE algorithm)
    def _checksum(tle_line: str) -> int:
        # Sum all digits; count dashes as 1; ignore letters; last char excluded
        s = 0
        for ch in tle_line[:-1]:
            if ch.isdigit():
                s += int(ch)
            elif ch == "-":
                s += 1
        return s % 10

    expected1 = int(line1[-1])
    expected2 = int(line2[-1])

    if _checksum(line1) != expected1:
        raise ValueError(
            f"TLE line 1 checksum mismatch (expected {expected1}, "
            f"computed {_checksum(line1)})"
        )
    if _checksum(line2) != expected2:
        raise ValueError(
            f"TLE line 2 checksum mismatch (expected {expected2}, "
            f"computed {_checksum(line2)})"
        )

    return name, line1, line2


def get_eci_state(
    satellite: EarthSatellite, ts, t
) -> dict:
    """Evaluate satellite position and velocity in the GCRS/ECI frame.

    Uses Skyfield's ``.at(t)`` method. The GCRS (Geocentric Celestial
    Reference System) is Skyfield's true inertial frame and is the correct
    frame for applying Newton's and Kepler's laws — distinct from TEME,
    which is the raw SGP4 output frame and includes additional rotations.

    Args:
        satellite: A Skyfield EarthSatellite object.
        ts: A loaded Skyfield timescale (not initialized here).
        t: A Skyfield Time object representing the evaluation epoch.

    Returns:
        Dictionary with keys:
        - ``position_km`` (list of 3 floats): position vector in km.
        - ``velocity_km_s`` (list of 3 floats): velocity vector in km/s.
        - ``epoch`` (str): ISO-format UTC string of the evaluation time.
    """
    # GCRS is Skyfield's implementation of the true ECI inertial frame,
    # required for lawful application of Newton's and Kepler's laws.
    # TEME (raw SGP4 output) includes Earth-orientation rotations that
    # must be removed before applying orbital dynamics.
    geocentric = satellite.at(t)

    position_km = geocentric.position.km
    velocity_km_s = geocentric.velocity.km_per_s

    # Extract as Python floats (Skyfield returns array-like objects)
    return {
        "position_km": [float(position_km[0]), float(position_km[1]), float(position_km[2])],
        "velocity_km_s": [float(velocity_km_s[0]), float(velocity_km_s[1]), float(velocity_km_s[2])],
        "epoch": t.utc_iso()
    }


def parse_pair(raw_text_x: str, raw_text_y: str):
    """Parse a primary ($x$) and secondary debris ($y$) TLE pair for encounter analysis."""
    return parse_tle(raw_text_x), parse_tle(raw_text_y)

# ===== Scalable multi-object $N$-catalog pipeline =====

CELESTRAK_ACTIVE_LEO_URL = "https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=tle"


def fetch_active_leo_tles(limit: int | None = None) -> str:
    """Fetch active LEO satellites from CelesTrak, cached locally in data/active_leo.tle."""
    cache_file = DATA_DIR / "active_leo.tle"
    if cache_file.exists():
        logger.info("Cache hit for Active LEO catalog: %s", cache_file)
        raw_text = cache_file.read_text(encoding="utf-8")
    else:
        logger.info("Fetching Active LEO TLE catalog from %s", CELESTRAK_ACTIVE_LEO_URL)
        res = requests.get(CELESTRAK_ACTIVE_LEO_URL, timeout=30)
        res.raise_for_status()
        raw_text = res.text
        cache_file.write_text(raw_text, encoding="utf-8")
    
    lines = [l.strip() for l in raw_text.splitlines() if l.strip()]
    if limit is not None:
        lines = lines[: limit * 3]
    return "\n".join(lines)


def fetch_catalog_tles(cat_nrs: list[int] = None, limit: int | None = None) -> str:
    """Batch fetch group TLE data from CelesTrak.
    If cat_nrs is provided, fetches specific satellites.
    Otherwise, fetches active LEO catalog."""
    if not cat_nrs:
        return fetch_active_leo_tles(limit=limit)
    combined = []
    for cat in cat_nrs:
        combined.append(fetch_tle(cat))
    catalog_path = DATA_DIR / "catalog.tle"
    catalog_path.write_text("\n".join(combined), encoding="utf-8")
    logger.info("Batch catalog saved: %d objects -> %s", len(cat_nrs), catalog_path)
    return "\n".join(combined)


def parse_catalog(raw_text: str) -> list:
    """Robust multi-TLE parser for $N$ satellite records.
    Discards corrupt entries with warnings; returns valid tuples."""
    results = []
    lines = [line.strip() for line in raw_text.splitlines() if line.strip() != ""]
    i = 0
    while i < len(lines):
        try:
            name = lines[i]
            line1 = lines[i + 1]
            line2 = lines[i + 2]
            results.append(parse_tle(raw_text=f"{name}\n{line1}\n{line2}"))
            i += 3
        except (IndexError, ValueError) as exc:
            logger.warning("Discarding corrupt catalog entry at line %d: %s", i, exc)
            i += 1
    return results


# Initialize Skyfield engine once for array-based preprocessing
_ts, _eph = None, None

def init_skyfield():
    global _ts, _eph
    _ts = load.timescale()
    _eph = load('de421.bsp')
    return _ts, _eph

def preprocess_catalog(sat_records: list) -> list:
    """Array-based preprocessing: return list of EarthSatellite objects."""
    ts, eph = init_skyfield()
    satellites = []
    for name, line1, line2 in sat_records:
        sat = EarthSatellite(line1, line2, name, ts)
        satellites.append(sat)
    return satellites


def get_active_leo_catalog(limit: int | None = None) -> list[EarthSatellite]:
    """Fetch active LEO catalog TLEs, parse, and return list of EarthSatellite objects."""
    raw_text = fetch_active_leo_tles(limit=limit)
    records = parse_catalog(raw_text)
    return preprocess_catalog(records)

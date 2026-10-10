"""
Repository: compute real-time satellite positions from TLE data using SGP4.
"""

import logging
import math
from datetime import datetime, timezone
from typing import List

import oracledb
from sgp4.api import Satrec, jday

from db import get_pool
from schemas import SatellitePositionResponse

logger = logging.getLogger(__name__)

EARTH_RADIUS_KM = 6371.0
SCENE_SCALE = 0.7  # Same scale factor used in Globe3D: radius = 1.0 + (alt_km / 6371) * 0.7


def _normalize_tle_line2(line2: str) -> str:
    """Ensure standard 69-char column alignment for SGP4 line 2."""
    tokens = line2.split()
    if len(tokens) >= 8 and tokens[0] == '2':
        norad = tokens[1]
        try:
            inc = float(tokens[2])
            raan = float(tokens[3])
            ecco = tokens[4].lstrip('0.').ljust(7, '0')[:7]
            argp = float(tokens[5])
            m = float(tokens[6])
            n = float(tokens[7])
            rev = tokens[8] if len(tokens) > 8 else '0'
            l2 = f"2 {norad:>5} {inc:8.4f} {raan:8.4f} {ecco:>07} {argp:8.4f} {m:8.4f} {n:11.8f}{rev:>5}"
            if len(l2) < 69:
                l2 = l2.ljust(69, '0')
            return l2
        except Exception:
            return line2
    return line2


def _tle_to_position(tle_line1: str, tle_line2: str, dt_utc: datetime):
    """
    Propagate a TLE to a given UTC datetime using SGP4.
    Returns (x_km, y_km, z_km, velocity_km_s) in ECI frame, or None on error.
    """
    try:
        norm_l2 = _normalize_tle_line2(tle_line2)
        try:
            sat = Satrec.twoline2rv(tle_line1, norm_l2)
        except Exception:
            sat = Satrec.twoline2rv(tle_line1, tle_line2)

        jd, fr = jday(dt_utc.year, dt_utc.month, dt_utc.day,
                      dt_utc.hour, dt_utc.minute,
                      dt_utc.second + dt_utc.microsecond / 1e6)
        e, r, v = sat.sgp4(jd, fr)
        if e != 0 or r is None or v is None:
            # Fallback to TLE epoch if long-term propagation decayed or returned warning
            e, r, v = sat.sgp4(sat.jdsatepoch, sat.jdsatepochF)
        if r is None or v is None:
            return None
        vx, vy, vz = v
        vel = math.sqrt(vx**2 + vy**2 + vz**2)
        return r[0], r[1], r[2], vel
    except Exception as ex:
        logger.warning("SGP4 propagation failed: %s", ex)
        return None


def _eci_to_geo(x_km: float, y_km: float, z_km: float, dt_utc: datetime):
    """
    Convert ECI (Earth-Centered Inertial) XYZ to geodetic lat/lon/alt.
    Uses Greenwich Sidereal Time rotation.
    """
    # GST (approximate)
    J2000 = 2451545.0
    from sgp4.api import jday as _jday
    jd, fr = _jday(dt_utc.year, dt_utc.month, dt_utc.day,
                   dt_utc.hour, dt_utc.minute,
                   dt_utc.second + dt_utc.microsecond / 1e6)
    t = (jd + fr - J2000) / 36525.0
    gst = math.radians((280.46061837 + 360.98564736629 * (jd + fr - J2000)) % 360)

    # ECI -> ECEF rotation around Z axis
    cos_gst = math.cos(gst)
    sin_gst = math.sin(gst)
    x_ecef = x_km * cos_gst + y_km * sin_gst
    y_ecef = -x_km * sin_gst + y_km * cos_gst
    z_ecef = z_km

    # ECEF -> lat/lon/alt
    p = math.sqrt(x_ecef**2 + y_ecef**2)
    lon_deg = math.degrees(math.atan2(y_ecef, x_ecef))

    # Iterative geodetic lat (Bowring method, 3 iterations)
    a = 6378.137        # WGS-84 semi-major axis km
    e2 = 0.00669438     # WGS-84 eccentricity squared
    lat = math.atan2(z_ecef, p * (1 - e2))
    for _ in range(3):
        N = a / math.sqrt(1 - e2 * math.sin(lat)**2)
        lat = math.atan2(z_ecef + e2 * N * math.sin(lat), p)
    alt_km = p / math.cos(lat) - a / math.sqrt(1 - e2 * math.sin(lat)**2)

    return math.degrees(lat), lon_deg, max(0.0, alt_km)


def _geo_to_scene_xyz(lat_deg: float, lon_deg: float, alt_km: float):
    """
    Convert geodetic lat/lon/alt to Three.js scene XYZ.
    Earth radius = 1.0 scene unit. SCENE_SCALE matches Globe3D.tsx.
    """
    scene_r = 1.0 + (alt_km / EARTH_RADIUS_KM) * SCENE_SCALE
    lat_r = math.radians(lat_deg)
    lon_r = math.radians(lon_deg)
    x = scene_r * math.cos(lat_r) * math.sin(lon_r)
    y = scene_r * math.sin(lat_r)
    z = scene_r * math.cos(lat_r) * math.cos(lon_r)
    return x, y, z


async def get_satellite_positions(dataset_tag: str = "REALTIME", limit: int = 100) -> List[SatellitePositionResponse]:
    """
    Query TLE data from Oracle, propagate to NOW with SGP4, return 3D positions.
    """
    pool = get_pool()
    conn = None
    dt_now = datetime.now(timezone.utc)

    try:
        conn = await pool.acquire()

        # Pull TLE lines + satellite name + inclination from Oracle
        # One TLE per satellite (most recent epoch per norad_id)
        sql = """
            SELECT
                s.norad_id,
                s.satellite_name,
                ts.tle_line1,
                ts.tle_line2,
                ep.miss_distance_km
            FROM tle_sets ts
            JOIN satellites s ON ts.satellite_id = s.satellite_id
            LEFT JOIN (
                SELECT sat_a_norad AS norad_id, MIN(miss_distance_km) AS miss_distance_km
                FROM encounter_pairs
                WHERE dataset_tag = :dataset_tag
                GROUP BY sat_a_norad
            ) ep ON s.norad_id = ep.norad_id
            WHERE ts.dataset_tag = :dataset_tag
            AND ts.epoch_utc = (
                SELECT MAX(ts2.epoch_utc)
                FROM tle_sets ts2
                WHERE ts2.satellite_id = ts.satellite_id
                AND ts2.dataset_tag = ts.dataset_tag
            )
            FETCH FIRST :limit ROWS ONLY
        """

        positions = []
        async with conn.cursor() as cursor:
            await cursor.execute(sql, {"dataset_tag": dataset_tag, "limit": limit})
            rows = await cursor.fetchall()

            for row in rows:
                norad_id = int(row[0])
                name = str(row[1])
                tle1 = str(row[2])
                tle2 = str(row[3])
                miss_dist = float(row[4]) if row[4] is not None else 999.0

                result = _tle_to_position(tle1, tle2, dt_now)
                if result is None:
                    continue

                x_km, y_km, z_km, vel = result
                lat, lon, alt = _eci_to_geo(x_km, y_km, z_km, dt_now)
                sx, sy, sz = _geo_to_scene_xyz(lat, lon, alt)

                # Parse inclination from TLE line 2 (columns 8-16)
                try:
                    inclination_deg = float(tle2[8:16].strip())
                except Exception:
                    inclination_deg = 0.0

                # Risk category based on miss distance to any encounter pair
                if miss_dist < 1.0:
                    risk = "CRITICAL"
                elif miss_dist < 5.0:
                    risk = "CAUTION"
                else:
                    risk = "NOMINAL"

                positions.append(SatellitePositionResponse(
                    norad_id=norad_id,
                    name=name,
                    x=round(sx, 6),
                    y=round(sy, 6),
                    z=round(sz, 6),
                    lat_deg=round(lat, 4),
                    lon_deg=round(lon, 4),
                    alt_km=round(alt, 2),
                    velocity_kms=round(vel, 3),
                    inclination_deg=round(inclination_deg, 2),
                    dataset_tag=dataset_tag,
                    risk_category=risk,
                ))

        logger.info("SGP4 propagated %d satellites for dataset_tag=%s", len(positions), dataset_tag)
        return positions

    except oracledb.Error as e:
        logger.error("Oracle error in get_satellite_positions: %s", e, exc_info=True)
        raise
    finally:
        if conn is not None:
            try:
                await pool.release(conn)
            except oracledb.Error:
                pass

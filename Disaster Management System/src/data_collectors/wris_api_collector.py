"""
WRIS Real-Time API Collector

Fetches live river water level data from the Central Water Commission's
Water Resources Information System (WRIS) API.

API Documentation: https://wriscwc.gov.in/api/
Station List: https://wriscwc.gov.in/stations/Bihar_stations.csv
"""

import os
import sys
import logging
from typing import Optional, Dict, Any, List, Tuple
from datetime import datetime, timedelta
import requests
import pandas as pd
import numpy as np

from src.data_collectors.base_collector import BaseDataCollector

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# WRIS API Configuration
WRIS_API_BASE = "https://wriscwc.gov.in/api/v1"
WRIS_TIMEOUT = 15

# Bihar WRIS Station Codes - These are the key identifiers
BIHAR_WRIS_STATIONS = {
    # Ganga Basin
    "GNG_PTN": {
        "station_id": "GNG_PTN",
        "name": "Ganga at Patna (Gandhighat)",
        "district": "Patna",
        "river": "Ganga",
        "lat": 25.5937,
        "lon": 85.1376,
        "danger_level": 48.5,
    },
    # Kosi Basin
    "KOS_BRP": {
        "station_id": "KOS_BRP",
        "name": "Kosi at Birpur Barrage",
        "district": "Supaul",
        "river": "Kosi",
        "lat": 26.5236,
        "lon": 86.9300,
        "danger_level": 45.0,
    },
    "KOS_BLT": {
        "station_id": "KOS_BLT",
        "name": "Kosi at Baltara",
        "district": "Bhagalpur",
        "river": "Kosi",
        "lat": 25.5413,
        "lon": 87.5755,
        "danger_level": 35.5,
    },
    # Gandak Basin
    "GDK_VLM": {
        "station_id": "GDK_VLM",
        "name": "Gandak at Valmikinagar Barrage",
        "district": "West Champaran",
        "river": "Gandak",
        "lat": 27.4326,
        "lon": 83.9072,
        "danger_level": 60.0,
    },
    "GDK_RWG": {
        "station_id": "GDK_RWG",
        "name": "Gandak at Rewaghat",
        "district": "Muzaffarpur",
        "river": "Gandak",
        "lat": 25.9801,
        "lon": 85.2200,
        "danger_level": 50.2,
    },
    # Bagmati Basin
    "BGM_JAJ": {
        "station_id": "BGM_JAJ",
        "name": "Bagmati at Jhanjharpur",
        "district": "Darbhanga",
        "river": "Bagmati",
        "lat": 26.1542,
        "lon": 85.8918,
        "danger_level": 42.0,
    },
    # Burhi Gandak
    "BDK_SKN": {
        "station_id": "BDK_SKN",
        "name": "Burhi Gandak at Sikandarpur",
        "district": "Muzaffarpur",
        "river": "Burhi Gandak",
        "lat": 26.1209,
        "lon": 85.3647,
        "danger_level": 38.5,
    },
    # Mahananda
    "MHN_KTH": {
        "station_id": "MHN_KTH",
        "name": "Mahananda at Katihar",
        "district": "Katihar",
        "river": "Mahananda",
        "lat": 25.5413,
        "lon": 87.5755,
        "danger_level": 28.0,
    },
}


def fetch_wris_station_data(
    station_id: str,
    api_key: Optional[str] = None,
    timeout: int = WRIS_TIMEOUT
) -> Optional[Dict[str, Any]]:
    """
    Fetches latest water level observation for a single WRIS station.

    Parameters
    ----------
    station_id : str
        WRIS station identifier (e.g., "GNG_PTN" for Ganga at Patna)
    api_key : Optional[str]
        WRIS API authentication key
    timeout : int
        HTTP request timeout in seconds

    Returns
    -------
    Optional[Dict[str, Any]]
        Dictionary with station data or None if fetch failed
    """
    if not api_key:
        api_key = os.getenv("WRIS_API_KEY", "")

    if not api_key:
        logger.warning("WRIS_API_KEY not set in environment. Cannot fetch live data.")
        return None

    # Construct API endpoint
    # Example: https://wriscwc.gov.in/api/v1/stations/{station_id}/observations?latest=1
    url = f"{WRIS_API_BASE}/stations/{station_id}/observations"

    headers = {
        "Authorization": f"Bearer {api_key}",
        "User-Agent": "FloodCommandCenter/1.0",
        "Accept": "application/json"
    }

    params = {
        "latest": 1,  # Get only latest observation
        "parameter": "stage,discharge,storage"  # Parameters to fetch
    }

    try:
        logger.info(f"Fetching WRIS data for station {station_id}...")
        response = requests.get(url, headers=headers, params=params, timeout=timeout)

        if response.status_code == 200:
            data = response.json()
            logger.info(f"✅ Successfully fetched data for station {station_id}")
            return data
        elif response.status_code == 401:
            logger.error(f"WRIS API authentication failed. Check API_KEY. Status: {response.status_code}")
            return None
        elif response.status_code == 404:
            logger.warning(f"WRIS station {station_id} not found. Status: {response.status_code}")
            return None
        else:
            logger.warning(f"WRIS API returned status {response.status_code}")
            return None

    except requests.exceptions.Timeout:
        logger.warning(f"WRIS API request timed out for station {station_id}")
        return None
    except requests.exceptions.ConnectionError as e:
        logger.warning(f"WRIS API connection error: {e}")
        return None
    except Exception as e:
        logger.warning(f"Unexpected error fetching WRIS data: {e}")
        return None


def parse_wris_response(response_data: Dict[str, Any], station_meta: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """
    Parses WRIS API JSON response and extracts water level, discharge, and status.

    Parameters
    ----------
    response_data : Dict[str, Any]
        Raw response from WRIS API
    station_meta : Dict[str, Any]
        Station metadata (name, danger_level, coordinates, etc.)

    Returns
    -------
    Optional[Dict[str, Any]]
        Parsed record or None if parsing failed
    """
    try:
        # Navigate WRIS response structure
        # Typical structure: {"data": [{"timestamp": "...", "stage": 48.5, "discharge": 12450, ...}]}

        observations = response_data.get("data", [])
        if not observations:
            logger.warning(f"No observations in WRIS response for {station_meta.get('name')}")
            return None

        latest = observations[0]  # Get most recent observation

        timestamp_str = latest.get("timestamp", datetime.now().isoformat())
        water_level = float(latest.get("stage", latest.get("water_level", 0.0)))
        discharge = float(latest.get("discharge", 0.0))
        storage_pct = float(latest.get("storage", 0.0))

        danger_level = station_meta.get("danger_level", 50.0)
        is_above_danger = water_level >= danger_level

        record = {
            "timestamp": timestamp_str,
            "station_id": station_meta.get("station_id"),
            "station_name": station_meta.get("name"),
            "district_id": station_meta.get("district"),
            "river_name": station_meta.get("river"),
            "latitude": station_meta.get("lat"),
            "longitude": station_meta.get("lon"),
            "water_level_meters": round(water_level, 2),
            "danger_level_meters": round(danger_level, 2),
            "is_above_danger": int(is_above_danger),
            "discharge_rate_cumecs": round(discharge, 1),
            "reservoir_capacity_percent": round(storage_pct, 1),
            "data_source": "WRIS_API"
        }

        return record

    except Exception as e:
        logger.warning(f"Error parsing WRIS response: {e}")
        return None


def fetch_all_bihar_stations(api_key: Optional[str] = None) -> pd.DataFrame:
    """
    Fetches real-time data from all Bihar WRIS stations.

    Parameters
    ----------
    api_key : Optional[str]
        WRIS API key (uses env var if not provided)

    Returns
    -------
    pd.DataFrame
        DataFrame with water level data from all Bihar stations
    """
    records = []

    logger.info(f"Fetching real-time data from {len(BIHAR_WRIS_STATIONS)} Bihar WRIS stations...")

    for station_key, station_meta in BIHAR_WRIS_STATIONS.items():
        # Fetch data from WRIS API
        response = fetch_wris_station_data(station_key, api_key=api_key)

        if response:
            # Parse response
            record = parse_wris_response(response, station_meta)
            if record:
                records.append(record)
                logger.info(f"  ✅ {station_meta['name']}: {record['water_level_meters']}m")
        else:
            logger.warning(f"  ⚠️ Failed to fetch {station_meta['name']}")

    if records:
        df = pd.DataFrame(records)
        logger.info(f"✅ Successfully fetched {len(records)} station observations")
        return df
    else:
        logger.warning("❌ No WRIS data fetched. Returning empty DataFrame.")
        return pd.DataFrame()


class WRISAPICollector(BaseDataCollector):
    """
    Collector for real-time WRIS API data from Bihar river stations.

    Fetches live water levels, discharge rates, and reservoir capacity
    from Central Water Commission's Water Resources Information System (WRIS).

    Example:
        >>> collector = WRISAPICollector()
        >>> df = collector.fetch_live_data()
        >>> print(df[['station_name', 'water_level_meters', 'is_above_danger']])
    """

    def __init__(self, api_key: Optional[str] = None):
        """
        Initialize WRIS API Collector.

        Parameters
        ----------
        api_key : Optional[str]
            WRIS API key (uses WRIS_API_KEY env var if not provided)
        """
        self.api_key = api_key or os.getenv("WRIS_API_KEY", "")

    def fetch_live_data(self, region_code: str = "ALL") -> pd.DataFrame:
        """
        Fetch real-time water level data from WRIS API for Bihar stations.

        Parameters
        ----------
        region_code : str
            Region code (currently "ALL" for all Bihar stations)

        Returns
        -------
        pd.DataFrame
            Real-time station observations or empty DataFrame if API unavailable
        """
        if not self.api_key:
            logger.warning("WRIS_API_KEY not configured. Cannot fetch live data.")
            return pd.DataFrame()

        df = fetch_all_bihar_stations(api_key=self.api_key)
        return df

    def generate_simulated_data(self, region_code: str = "ALL", num_samples: int = 8) -> pd.DataFrame:
        """
        Generate simulated WRIS-like data for testing without API access.

        Parameters
        ----------
        region_code : str
            Region code
        num_samples : int
            Number of samples (default 8 for Bihar stations)

        Returns
        -------
        pd.DataFrame
            Simulated water level observations
        """
        records = []
        np.random.seed(42)

        for station_key, station_meta in list(BIHAR_WRIS_STATIONS.items())[:num_samples]:
            danger_level = station_meta["danger_level"]
            # Simulate water level variations around danger level
            water_level = danger_level + np.random.uniform(-3.0, 2.0)
            discharge = np.random.uniform(1000, 15000)
            storage = np.random.uniform(40, 95)

            record = {
                "timestamp": datetime.now().isoformat(),
                "station_id": station_meta["station_id"],
                "station_name": station_meta["name"],
                "district_id": station_meta["district"],
                "river_name": station_meta["river"],
                "latitude": station_meta["lat"],
                "longitude": station_meta["lon"],
                "water_level_meters": round(water_level, 2),
                "danger_level_meters": round(danger_level, 2),
                "is_above_danger": int(water_level >= danger_level),
                "discharge_rate_cumecs": round(discharge, 1),
                "reservoir_capacity_percent": round(storage, 1),
                "data_source": "SIMULATION"
            }
            records.append(record)

        return pd.DataFrame(records)


if __name__ == "__main__":
    print("\n" + "="*70)
    print(" WRIS API COLLECTOR - TEST")
    print("="*70)

    # Test with API key from environment
    api_key = os.getenv("WRIS_API_KEY")

    if api_key:
        print(f"\n✅ WRIS_API_KEY found in environment")
        print(f"Attempting to fetch live data from {len(BIHAR_WRIS_STATIONS)} stations...\n")

        collector = WRISAPICollector(api_key=api_key)
        df_live = collector.fetch_live_data()

        if not df_live.empty:
            print("✅ Live WRIS Data Fetched:")
            print(df_live[['station_name', 'water_level_meters', 'danger_level_meters', 'is_above_danger']].to_string(index=False))
        else:
            print("⚠️ No data returned from API (may be offline)")
    else:
        print("\n⚠️ WRIS_API_KEY not set in environment")
        print("Falling back to simulated data for demonstration...\n")

    # Always show simulated data for testing
    collector = WRISAPICollector()
    df_sim = collector.generate_simulated_data()
    print("\n📊 Simulated WRIS Data (for testing without API):")
    print(df_sim[['station_name', 'water_level_meters', 'danger_level_meters', 'is_above_danger']].to_string(index=False))

    print("\n" + "="*70)

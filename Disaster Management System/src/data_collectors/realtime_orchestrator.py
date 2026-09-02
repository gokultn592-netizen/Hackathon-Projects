"""
Real-Time Data Orchestrator
Coordinates IMD rainfall, WRIS river gauges, satellite data, and other collectors
into unified real-time telemetry stream for flood prediction.
"""

import logging
import sys
import os
from typing import Dict, List, Optional, Any
from datetime import datetime
import pandas as pd
import numpy as np

try:
    from .imd_collector import IMDDataCollector, download_bihar_rainfall
    from .wris_api_collector import WRISAPICollector
    from .bhuvan_collector import BhuvanDataCollector
    from .dem_collector import DEMDataCollector
except ImportError:
    sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))
    from src.data_collectors.imd_collector import IMDDataCollector, download_bihar_rainfall
    from src.data_collectors.wris_api_collector import WRISAPICollector
    from src.data_collectors.bhuvan_collector import BhuvanDataCollector
    from src.data_collectors.dem_collector import DEMDataCollector

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class RealtimeDataOrchestrator:
    """
    Orchestrates real-time data collection from multiple OSINT sources:
    - IMD rainfall (gridded, 0.25° resolution)
    - WRIS river gauges (10 Bihar stations)
    - NDWI/satellite data (Bhuvan)
    - Terrain (DEM)

    Aggregates by district and outputs real-time telemetry for flood prediction.
    """

    def __init__(self):
        self.imd_collector = IMDDataCollector()
        self.wris_collector = WRISAPICollector()
        self.bhuvan_collector = BhuvanDataCollector()
        self.dem_collector = DEMDataCollector()
        logger.info("RealtimeDataOrchestrator initialized with 4 OSINT collectors")

    def collect_imd_rainfall(self) -> pd.DataFrame:
        """Fetch IMD gridded rainfall for current monsoon season."""
        logger.info("[IMD] Fetching real-time rainfall data...")
        try:
            df_imd = self.imd_collector.fetch_live_data(region_code="BIHAR")
            logger.info(f"[IMD] SUCCESS: Loaded {len(df_imd)} rainfall records")
            return df_imd
        except Exception as e:
            logger.error(f"[IMD] Failed to fetch: {e}")
            return pd.DataFrame()

    def collect_wris_rivers(self) -> pd.DataFrame:
        """Fetch WRIS real-time river gauge levels for 10 Bihar stations."""
        logger.info("[WRIS] Fetching real-time river gauge data...")
        try:
            df_wris = self.wris_collector.fetch_live_data(region_code="BIHAR")
            logger.info(f"[WRIS] SUCCESS: Loaded {len(df_wris)} river gauge records")
            return df_wris
        except Exception as e:
            logger.error(f"[WRIS] Failed to fetch: {e}")
            return pd.DataFrame()

    def collect_satellite_data(self) -> pd.DataFrame:
        """Fetch NDWI and satellite-derived inundation data."""
        logger.info("[BHUVAN] Fetching satellite water index data...")
        try:
            df_bhuvan = self.bhuvan_collector.fetch_live_data(region_code="BIHAR")
            logger.info(f"[BHUVAN] SUCCESS: Loaded {len(df_bhuvan)} satellite records")
            return df_bhuvan
        except Exception as e:
            logger.error(f"[BHUVAN] Failed to fetch: {e}")
            return pd.DataFrame()

    def collect_terrain_data(self) -> pd.DataFrame:
        """Fetch DEM and terrain characteristics."""
        logger.info("[DEM] Fetching terrain elevation data...")
        try:
            df_dem = self.dem_collector.fetch_live_data(region_code="BIHAR")
            logger.info(f"[DEM] SUCCESS: Loaded {len(df_dem)} terrain records")
            return df_dem
        except Exception as e:
            logger.error(f"[DEM] Failed to fetch: {e}")
            return pd.DataFrame()

    def aggregate_by_district(self, fused_df: pd.DataFrame) -> pd.DataFrame:
        """
        Aggregate multi-modal telemetry by district for flood risk assessment.

        Computes district-level statistics:
        - Mean rainfall (24h, 48h, 72h)
        - Max water level, danger level ratio
        - Mean NDWI (water index)
        - Mean population density
        """
        if fused_df.empty:
            logger.warning("Cannot aggregate: input DataFrame is empty")
            return pd.DataFrame()

        logger.info(f"Aggregating {len(fused_df)} records by district...")

        # Define district grouping key
        group_key = "district_id" if "district_id" in fused_df.columns else "station_name"

        agg_dict = {}

        # Rainfall aggregations
        if "rainfall_mm" in fused_df.columns:
            agg_dict["rainfall_24h_mm"] = ("rainfall_mm", "mean")
        if "rainfall_48h_mm" in fused_df.columns:
            agg_dict["rainfall_48h_mm"] = ("rainfall_48h_mm", "mean")
        if "rainfall_72h_mm" in fused_df.columns:
            agg_dict["rainfall_72h_mm"] = ("rainfall_72h_mm", "mean")

        # River gauge aggregations
        if "water_level_m" in fused_df.columns:
            agg_dict["water_level_max_m"] = ("water_level_m", "max")
            agg_dict["water_level_mean_m"] = ("water_level_m", "mean")
        if "river_rise_rate" in fused_df.columns:
            agg_dict["river_rise_rate_mean"] = ("river_rise_rate", "mean")

        # Satellite & environmental aggregations
        if "ndwi" in fused_df.columns:
            agg_dict["ndwi_mean"] = ("ndwi", "mean")
        if "soil_saturation" in fused_df.columns:
            agg_dict["soil_saturation_mean"] = ("soil_saturation", "mean")
        if "population_density" in fused_df.columns:
            agg_dict["population_density_mean"] = ("population_density", "mean")

        # Terrain aggregations
        if "elevation" in fused_df.columns:
            agg_dict["elevation_mean"] = ("elevation", "mean")

        try:
            if group_key in fused_df.columns and agg_dict:
                df_agg = fused_df.groupby(group_key).agg(**agg_dict).reset_index()
                df_agg["timestamp"] = datetime.utcnow().isoformat()
                logger.info(f"Aggregation complete: {len(df_agg)} districts")
                return df_agg
            else:
                logger.warning(f"Group key '{group_key}' or aggregation dict not found")
                return fused_df
        except Exception as e:
            logger.error(f"Aggregation failed: {e}")
            return fused_df

    def orchestrate_collection(self, use_simulation: bool = False) -> Dict[str, Any]:
        """
        Orchestrate full real-time data collection from all OSINT sources.

        Parameters
        ----------
        use_simulation : bool
            If True, use simulated data instead of live API calls.

        Returns
        -------
        Dict with keys:
            - 'status': 'SUCCESS' or 'PARTIAL'
            - 'timestamp': Timestamp of collection
            - 'imd': IMD rainfall DataFrame
            - 'wris': WRIS river gauge DataFrame
            - 'bhuvan': Bhuvan satellite DataFrame
            - 'dem': DEM terrain DataFrame
            - 'fused': Merged and aggregated telemetry
            - 'districts_affected': List of districts with high risk
        """
        logger.info("=" * 70)
        logger.info("STARTING REAL-TIME DATA ORCHESTRATION")
        logger.info("=" * 70)

        collection_time = datetime.utcnow().isoformat()

        # Collect from all sources
        if use_simulation:
            logger.info("Using SIMULATION mode (no live API calls)")
            df_imd = self.imd_collector.generate_simulated_data(num_samples=100)
            df_wris = self.wris_collector.generate_simulated_data(num_samples=50)
            df_bhuvan = self.bhuvan_collector.generate_simulated_data(num_samples=100)
            df_dem = self.dem_collector.generate_simulated_data(num_samples=50)
        else:
            logger.info("Using LIVE mode (fetching real OSINT data)")
            df_imd = self.collect_imd_rainfall()
            df_wris = self.collect_wris_rivers()
            df_bhuvan = self.collect_satellite_data()
            df_dem = self.collect_terrain_data()

        # Check if we have data from at least 2 sources
        sources_available = sum([
            not df_imd.empty,
            not df_wris.empty,
            not df_bhuvan.empty,
            not df_dem.empty
        ])

        if sources_available < 2:
            logger.error("Insufficient data sources available for reliable prediction")
            return {
                "status": "FAILED",
                "timestamp": collection_time,
                "imd": df_imd,
                "wris": df_wris,
                "bhuvan": df_bhuvan,
                "dem": df_dem,
                "fused": pd.DataFrame(),
                "error": "Less than 2 data sources available"
            }

        # Aggregate by district
        df_agg = self.aggregate_by_district(df_imd)

        # Identify districts with elevated risk
        districts_affected = []
        if not df_agg.empty:
            if "rainfall_72h_mm" in df_agg.columns:
                high_rain = df_agg[df_agg["rainfall_72h_mm"] > 150]["district_id"].tolist()
                districts_affected.extend(high_rain)
            if "water_level_mean_m" in df_agg.columns:
                high_water = df_agg[df_agg["water_level_mean_m"] > 40]["district_id"].tolist()
                districts_affected.extend(high_water)
            districts_affected = list(set(districts_affected))

        logger.info("=" * 70)
        logger.info("DATA ORCHESTRATION COMPLETE")
        logger.info("=" * 70)
        logger.info(f"IMD Records: {len(df_imd)}")
        logger.info(f"WRIS Records: {len(df_wris)}")
        logger.info(f"Satellite Records: {len(df_bhuvan)}")
        logger.info(f"Terrain Records: {len(df_dem)}")
        logger.info(f"Districts with elevated risk: {districts_affected}")

        return {
            "status": "SUCCESS" if sources_available == 4 else "PARTIAL",
            "timestamp": collection_time,
            "sources_available": sources_available,
            "imd": df_imd,
            "wris": df_wris,
            "bhuvan": df_bhuvan,
            "dem": df_dem,
            "fused": df_agg,
            "districts_affected": districts_affected
        }


if __name__ == "__main__":
    # Example: Run in simulation mode
    orchestrator = RealtimeDataOrchestrator()
    result = orchestrator.orchestrate_collection(use_simulation=True)

    print("\n" + "=" * 70)
    print("ORCHESTRATION RESULT SUMMARY")
    print("=" * 70)
    print(f"Status: {result['status']}")
    print(f"Timestamp: {result['timestamp']}")
    print(f"Sources Available: {result['sources_available']}/4")
    print(f"Districts Affected: {result['districts_affected']}")

    if not result["fused"].empty:
        print("\nAggregated District Telemetry:")
        print(result["fused"].head())

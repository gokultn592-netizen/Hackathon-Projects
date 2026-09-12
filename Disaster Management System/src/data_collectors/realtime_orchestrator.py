"""
Real-Time Data Orchestrator (US Red River Basin)
Coordinates NOAA rainfall/weather, USGS river gauges, NOAA inundation/soil,
US Census population, and USGS 3DEP DEM data for Red River Basin.
"""
import logging, sys, os
from typing import Dict, List, Optional, Any
from datetime import datetime
import pandas as pd, numpy as np

from src.data_collectors.usgs_collector import USGSDataCollector
from src.data_collectors.noaa_collector import NOAADataCollector
from src.data_collectors.noaa_inundation_collector import NOAAInundationCollector
from src.data_collectors.census_collector import CensusDataCollector
from src.data_collectors.dem_collector import DEMDataCollector

logger = logging.getLogger(__name__)

class RealtimeDataOrchestrator:
    def __init__(self):
        self.noaa_collector = NOAADataCollector()
        self.usgs_collector = USGSDataCollector()
        self.inund_collector = NOAAInundationCollector()
        self.census_collector = CensusDataCollector()
        self.dem_collector = DEMDataCollector()
        logger.info("RealtimeDataOrchestrator initialized with 5 US OSINT collectors")

    def collect_noaa_weather(self) -> pd.DataFrame:
        try:
            df = self.noaa_collector.fetch_live_data(region_code="RED_RIVER")
            logger.info(f"[NOAA] SUCCESS: Loaded {len(df)} weather records")
            return df
        except Exception as e:
            logger.error(f"[NOAA] Failed to fetch: {e}")
            return pd.DataFrame()

    def collect_usgs_rivers(self) -> pd.DataFrame:
        try:
            df = self.usgs_collector.fetch_live_data(region_code="RED_RIVER")
            logger.info(f"[USGS] SUCCESS: Loaded {len(df)} river gauge records")
            return df
        except Exception as e:
            logger.error(f"[USGS] Failed to fetch: {e}")
            return pd.DataFrame()

    def collect_Noaa_inundation(self) -> pd.DataFrame:
        try:
            df = self.inund_collector.fetch_live_data(region_code="RED_RIVER")
            logger.info(f"[NOAA_INUND] SUCCESS: Loaded {len(df)} inundation records")
            return df
        except Exception as e:
            logger.error(f"[NOAA_INUND] Failed to fetch: {e}")
            return pd.DataFrame()

    def collect_census(self) -> pd.DataFrame:
        try:
            df = self.census_collector.fetch_live_data(region_code="RED_RIVER")
            logger.info(f"[CENSUS] SUCCESS: Loaded {len(df)} census records")
            return df
        except Exception as e:
            logger.error(f"[CENSUS] Failed to fetch: {e}")
            return pd.DataFrame()

    def collect_dem(self) -> pd.DataFrame:
        try:
            df = self.dem_collector.fetch_live_data(region_code="RED_RIVER")
            logger.info(f"[DEM] SUCCESS: Loaded {len(df)} terrain records")
            return df
        except Exception as e:
            logger.error(f"[DEM] Failed to fetch: {e}")
            return pd.DataFrame()

    def aggregate_by_county(self, fused_df: pd.DataFrame) -> pd.DataFrame:
        if fused_df.empty:
            logger.warning("Cannot aggregate: input DataFrame is empty")
            return pd.DataFrame()
        logger.info(f"Aggregating {len(fused_df)} records by county...")
        group_key = "county_id" if "county_id" in fused_df.columns else "station_id"
        agg_dict = {}
        if "rainfall_24h_in" in fused_df.columns:
            agg_dict["rainfall_24h_in"] = ("rainfall_24h_in", "mean")
        if "rainfall_72h_accum_in" in fused_df.columns:
            agg_dict["rainfall_72h_accum_in"] = ("rainfall_72h_accum_in", "mean")
        if "water_level_ft" in fused_df.columns:
            agg_dict["max_water_level_ft"] = ("water_level_ft", "max")
        if "inundated_area_sqkm" in fused_df.columns:
            agg_dict["total_inundated_sqkm"] = ("inundated_area_sqkm", "sum")
        if "population_density_per_sqmi" in fused_df.columns:
            agg_dict["mean_pop_density"] = ("population_density_per_sqmi", "mean")
        if "mean_elevation_meters" in fused_df.columns:
            agg_dict["mean_elevation_meters"] = ("mean_elevation_meters", "mean")
        try:
            if group_key in fused_df.columns and agg_dict:
                df_agg = fused_df.groupby(group_key).agg(**agg_dict).reset_index()
                df_agg["timestamp"] = datetime.utcnow().isoformat()
                logger.info(f"Aggregation complete: {len(df_agg)} counties")
                return df_agg
            else:
                logger.warning(f"Group key '{group_key}' or aggregation dict not found")
                return fused_df
        except Exception as e:
            logger.error(f"Aggregation failed: {e}")
            return fused_df

    def orchestrate_collection(self, use_simulation: bool = False) -> Dict[str, Any]:
        logger.info("=" * 70)
        logger.info("STARTING REAL-TIME DATA ORCHESTRATION - RED RIVER BASIN")
        logger.info("=" * 70)
        collection_time = datetime.utcnow().isoformat()
        if use_simulation:
            logger.info("Using SIMULATION mode")
            df_noaa = self.noaa_collector.generate_simulated_data(num_samples=100)
            df_usgs = self.usgs_collector.generate_simulated_data(num_samples=50)
            df_inund = self.inund_collector.generate_simulated_data(num_samples=100)
            df_census = self.census_collector.generate_simulated_data(num_samples=50)
            df_dem = self.dem_collector.generate_simulated_data(num_samples=50)
        else:
            logger.info("Using LIVE mode")
            df_noaa = self.collect_noaa_weather()
            df_usgs = self.collect_usgs_rivers()
            df_inund = self.collect_Noaa_inundation()
            df_census = self.collect_census()
            df_dem = self.collect_dem()
        sources_available = sum([not df.empty for df in [df_noaa, df_usgs, df_inund, df_census, df_dem]])
        if sources_available < 2:
            logger.error("Insufficient data sources available")
            return {
                "status":"FAILED",
                "timestamp": collection_time,
                "sources_available": sources_available,
                "error":"Less than 2 data sources available"
            }
        df_agg = self.aggregate_by_county(df_noaa)
        counties_affected = []
        if not df_agg.empty:
            if "rainfall_72h_accum_in" in df_agg.columns:
                high_rain = df_agg[df_agg["rainfall_72h_accum_in"] > 5]["county_id"].tolist()
                counties_affected.extend(high_rain)
            if "max_water_level_ft" in df_agg.columns:
                high_water = df_agg[df_agg["max_water_level_ft"] > 15]["county_id"].tolist()
                counties_affected.extend(high_water)
            counties_affected = list(set(counties_affected))
        logger.info(f"USGS Records: {len(df_usgs)}, NOAA Records: {len(df_noaa)}")
        logger.info(f"Counties with elevated risk: {counties_affected}")
        return {
            "status":"SUCCESS" if sources_available == 5 else "PARTIAL",
            "timestamp": collection_time,
            "sources_available": sources_available,
            "counties_affected": counties_affected,
        }

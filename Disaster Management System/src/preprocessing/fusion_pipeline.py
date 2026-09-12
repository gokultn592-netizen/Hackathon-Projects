"""
Spatio-Temporal Data Fusion Pipeline (US Red River Basin) — FIXED
Combines NOAA rainfall/weather, USGS river levels (with full station-to-county mapping),
NOAA inundation/soil, and US Census/DEM data.
"""
import logging
from typing import Dict, Optional, Tuple
import pandas as pd
import numpy as np

logger = logging.getLogger(__name__)

# Full station-to-county mapping (all 8 USGS stations)
STATION_TO_COUNTY = {
    "USGS_05054000": "Cass ND",
    "USGS_05082500": "Grand Forks ND",
    "USGS_05059000": "Cass ND",
    "USGS_05053000": "Walsh ND",
    "USGS_05079000": "Grand Forks ND",  # Red Lake River at Crookston MN -> Grand Forks ND (nearest county)
    "USGS_05087500": "Clay MN",       # Red River at St Hilaire MN -> Clay MN
    "USGS_05092000": "Traill ND",      # Red River at Drayton ND -> Traill ND
    "USGS_05085000": "Polk MN",       # Red River at Halstad MN -> Polk MN
}

# Flood stage reference (approx USGS flood stages for Red River stations)
FLOOD_STAGE_MAP = {
    "Cass ND": 18.0,
    "Grand Forks ND": 28.0,
    "Clay MN": 28.0,
    "Polk MN": 28.0,
    "Walsh ND": 18.0,
    "Traill ND": 28.0,
    "Norman MN": 28.0,
}

def haversine_distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371.0
    dlat = np.radians(lat2 - lat1)
    dlon = np.radians(lon2 - lon1)
    a = np.sin(dlat / 2.0)**2 + np.cos(np.radians(lat1)) * np.cos(np.radians(lat2)) * np.sin(dlon / 2.0)**2
    c = 2.0 * np.arctan2(np.sqrt(a), np.sqrt(1.0 - a))
    return R * c


class DataFusionPipeline:
    def __init__(self):
        pass

    def process_and_fuse(
        self,
        noaa_df: pd.DataFrame,
        usgs_df: pd.DataFrame,
        noaa_inund_df: pd.DataFrame,
        census_dem_df: pd.DataFrame,
    ) -> pd.DataFrame:
        logger.info("Executing Data Fusion Pipeline for Red River Basin (USA)...")

        # 1. Aggregate NOAA rainfall/weather by county
        noaa_agg = noaa_df.groupby("county_id").agg({
            "rainfall_24h_in": "mean",
            "rainfall_72h_accum_in": "mean",
            "temperature_f": "mean",
            "humidity_percent": "mean",
        }).reset_index()

        # 2. Aggregate USGS river levels by station -> county using FULL mapping
        usgs_agg = usgs_df.groupby("station_id").agg({
            "water_level_ft": ["mean", "max"],
        }).reset_index()
        # Flatten multi-level column names
        usgs_agg.columns = ["station_id", "mean_water_level_ft", "max_water_level_ft"]
        # Apply full station-to-county mapping
        usgs_agg["county_id"] = usgs_agg["station_id"].map(STATION_TO_COUNTY)
        # Fallback spatial join for unmapped stations (using station lat/lon if available)
        unmapped = usgs_agg["county_id"].isna()
        if unmapped.any() and "station_lat" in usgs_df.columns and "station_lon" in usgs_df.columns:
            for idx in usgs_agg[unmapped].index:
                station_lat = usgs_df.loc[usgs_df["station_id"] == usgs_agg.loc[idx, "station_id"], "station_lat"]
                station_lon = usgs_df.loc[usgs_df["station_id"] == usgs_agg.loc[idx, "station_id"], "station_lon"]
                if not station_lat.empty:
                    # Find nearest county by haversine distance from station lat/lon
                    counties = [
                        ("Cass ND", 46.88, -96.79),
                        ("Grand Forks ND", 47.93, -97.03),
                        ("Clay MN", 46.85, -96.43),
                        ("Walsh ND", 48.10, -97.20),
                        ("Traill ND", 47.60, -97.05),
                        ("Polk MN", 47.85, -96.80),
                        ("Norman MN", 47.30, -96.20),
                    ]
                    station_lat_val = float(station_lat.values[0])
                    station_lon_val = float(station_lon.values[0])
                    nearest = min(counties, key=lambda c: haversine_distance_km(station_lat_val, station_lon_val, c[1], c[2]))
                    usgs_agg.at[idx, "county_id"] = nearest[0]
        # Drop stations that don't map
        usgs_agg = usgs_agg.dropna(subset=["county_id"])
        # Aggregate by county (take max water level per county for risk assessment)
        usgs_agg = usgs_agg.groupby("county_id").agg({
            "mean_water_level_ft": "mean",
            "max_water_level_ft": "max",
        }).reset_index()

        # Flood stage reference
        usgs_agg["danger_level_ft"] = usgs_agg["county_id"].map(FLOOD_STAGE_MAP)
        usgs_agg["water_level_ratio"] = usgs_agg["max_water_level_ft"] / (usgs_agg["danger_level_ft"] + 1e-5)

        # 3. Aggregate NOAA inundation / soil by county
        inund_agg = noaa_inund_df.groupby("county_id").agg({
            "inundated_area_sqkm": "sum",
            "inundation_percentage": "mean",
            "soil_saturation_index": "mean",
        }).reset_index()

        # 4. Census / DEM by county
        census_dem_agg = census_dem_df.groupby("county_id").agg({
            "mean_elevation_meters": "mean",
            "mean_slope_degrees": "mean",
            "drainage_density_km_sqkm": "mean",
            "coastal_proximity_km": "mean",
            "population_density_per_sqmi": "mean",
        }).reset_index()

        # Merge all on county_id (full outer to keep all counties)
        fused = noaa_agg.merge(usgs_agg, on="county_id", how="outer")
        fused = fused.merge(inund_agg, on="county_id", how="outer")
        fused = fused.merge(census_dem_agg, on="county_id", how="outer")

        # Fill missing numerical values with median per column
        num_cols = fused.select_dtypes(include=[np.number]).columns
        fused[num_cols] = fused[num_cols].fillna(fused[num_cols].median())
        # Fill county_id gaps if any
        fused["county_id"] = fused["county_id"].fillna("Unknown")

        # Feature Engineering: Composite vulnerability metrics
        fused["runoff_potential_index"] = (
            (fused.get("rainfall_72h_accum_in", 0) / 8.0) *
            (fused.get("soil_saturation_index", 0) + 0.1) /
            (np.sin(np.radians(fused.get("mean_slope_degrees", 2.0))) + 0.05)
        )
        fused["composite_vulnerability_score"] = (
            0.35 * (fused.get("rainfall_72h_accum_in", 0) / 8.0) +
            0.30 * fused.get("water_level_ratio", 0) +
            0.20 * (fused.get("inundation_percentage", 0) / 50.0) +
            0.15 * (1.0 / (fused.get("mean_elevation_meters", 200) + 1.0))
        )
        fused = fused.round(4)
        logger.info(f"Data Fusion completed for US Red River Basin. Output shape: {fused.shape} | Counties: {fused['county_id'].tolist()}")
        return fused

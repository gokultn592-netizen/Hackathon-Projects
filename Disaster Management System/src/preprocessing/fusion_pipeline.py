"""
Spatio-Temporal Data Fusion Pipeline
Combines multi-modal telemetry from IMD, WRIS, Bhuvan, and DEM data sources.
"""
import logging
from typing import Dict, Optional, Tuple
import pandas as pd
import numpy as np

logger = logging.getLogger(__name__)


class DataFusionPipeline:
    """
    Data Fusion Engine merging meteorological, hydrological, satellite, and terrain datasets.
    """

    def __init__(self):
        pass

    def process_and_fuse(
        self,
        imd_df: pd.DataFrame,
        wris_df: pd.DataFrame,
        bhuvan_df: pd.DataFrame,
        dem_df: pd.DataFrame
    ) -> pd.DataFrame:
        """
        Clean, aggregate, and fuse heterogenous data frames into a single feature-engineered matrix.
        """
        logger.info("Executing Data Fusion Pipeline across 4 telemetry modalities...")

        # 1. Aggregate IMD by district_id
        imd_agg = imd_df.groupby("district_id").agg({
            "rainfall_24h_mm": "mean",
            "rainfall_3d_accum_mm": "mean",
            "humidity_percent": "mean",
            "temperature_celsius": "mean"
        }).reset_index()

        # 2. Aggregate WRIS by district_id
        wris_agg = wris_df.groupby("district_id").agg({
            "water_level_meters": "max",
            "danger_level_meters": "mean",
            "discharge_rate_cumecs": "mean",
            "reservoir_capacity_percent": "max",
            "is_above_danger": "any"
        }).reset_index()

        # Calculate relative water height above danger level
        wris_agg["water_level_ratio"] = wris_agg["water_level_meters"] / (wris_agg["danger_level_meters"] + 1e-5)

        # 3. Aggregate Bhuvan by district_id
        bhuvan_agg = bhuvan_df.groupby("district_id").agg({
            "inundated_area_sqkm": "sum",
            "inundation_percentage": "mean",
            "soil_saturation_index": "mean",
            "ndwi_water_index": "mean"
        }).reset_index()

        # 4. DEM terrain characteristics by district_id
        dem_agg = dem_df.groupby("district_id").agg({
            "mean_elevation_meters": "mean",
            "mean_slope_degrees": "mean",
            "drainage_density_km_sqkm": "mean",
            "coastal_proximity_km": "mean"
        }).reset_index()

        # Merge all dataframes on district_id
        fused = imd_agg.merge(wris_agg, on="district_id", how="outer")
        fused = fused.merge(bhuvan_agg, on="district_id", how="outer")
        fused = fused.merge(dem_agg, on="district_id", how="outer")

        # Fill missing numerical values with medians/defaults
        num_cols = fused.select_dtypes(include=[np.number]).columns
        fused[num_cols] = fused[num_cols].fillna(fused[num_cols].median())

        if "is_above_danger" in fused.columns:
            fused["is_above_danger"] = fused["is_above_danger"].fillna(False).astype(int)

        # Feature Engineering: Derive Composite Runoff & Flood Vulnerability Metrics
        # High rainfall + high water level ratio + low slope = High Risk
        fused["runoff_potential_index"] = (
            (fused["rainfall_24h_mm"] / 50.0) *
            (fused["soil_saturation_index"] + 0.1) /
            (np.sin(np.radians(fused["mean_slope_degrees"])) + 0.05)
        )

        fused["composite_vulnerability_score"] = (
            0.35 * (fused["rainfall_3d_accum_mm"] / 200.0) +
            0.30 * fused["water_level_ratio"] +
            0.20 * (fused["inundation_percentage"] / 50.0) +
            0.15 * (1.0 / (fused["mean_elevation_meters"] + 1.0))
        )

        # Round numerical features for clean storage/display
        fused = fused.round(4)
        logger.info(f"Data Fusion completed successfully. Output shape: {fused.shape}")
        return fused

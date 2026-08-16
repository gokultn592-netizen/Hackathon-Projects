"""
Flood Command Center - Data Collection & Fusion CLI Script

Fetches telemetry datasets from IMD, WRIS, Bhuvan, and DEM data collectors,
saves raw records to `data/raw/`, executes the spatio-temporal data fusion pipeline,
and saves the cleaned, feature-engineered matrix to `data/processed/fused_telemetry.csv`.
"""

import os
import sys
import logging
import pandas as pd

# Add root directory to python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from src.data_collectors import (
    IMDDataCollector,
    WRISDataCollector,
    BhuvanDataCollector,
    DEMDataCollector
)
from src.preprocessing import DataFusionPipeline

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("collect_data")


def main():
    print("=" * 70)
    print(" FLOOD COMMAND CENTER - DATA INGESTION & FUSION PIPELINE")
    print("=" * 70)

    raw_dir = os.path.join("data", "raw")
    processed_dir = os.path.join("data", "processed")
    os.makedirs(raw_dir, exist_ok=True)
    os.makedirs(processed_dir, exist_ok=True)

    # 1. Instantiate Collectors
    logger.info("Initializing telemetry data collectors...")
    imd_collector = IMDDataCollector()
    wris_collector = WRISDataCollector()
    bhuvan_collector = BhuvanDataCollector()
    dem_collector = DEMDataCollector()

    # 2. Fetch Datasets
    logger.info("Collecting IMD Rainfall & Weather metrics...")
    imd_df = imd_collector.fetch(region_code="ALL", use_simulation=True)
    imd_raw_path = os.path.join(raw_dir, "imd_telemetry.csv")
    imd_df.to_csv(imd_raw_path, index=False)
    logger.info(f"Saved IMD raw telemetry ({len(imd_df)} rows) -> {imd_raw_path}")

    logger.info("Collecting WRIS River & Reservoir Gauge metrics...")
    wris_df = wris_collector.fetch(region_code="ALL", use_simulation=True)
    wris_raw_path = os.path.join(raw_dir, "wris_telemetry.csv")
    wris_df.to_csv(wris_raw_path, index=False)
    logger.info(f"Saved WRIS raw telemetry ({len(wris_df)} rows) -> {wris_raw_path}")

    logger.info("Collecting ISRO Bhuvan Satellite Inundation metrics...")
    bhuvan_df = bhuvan_collector.fetch(region_code="ALL", use_simulation=True)
    bhuvan_raw_path = os.path.join(raw_dir, "bhuvan_telemetry.csv")
    bhuvan_df.to_csv(bhuvan_raw_path, index=False)
    logger.info(f"Saved Bhuvan raw telemetry ({len(bhuvan_df)} rows) -> {bhuvan_raw_path}")

    logger.info("Collecting DEM Elevation & Slope Grid metrics...")
    dem_df = dem_collector.fetch(region_code="ALL", use_simulation=True)
    dem_raw_path = os.path.join(raw_dir, "dem_telemetry.csv")
    dem_df.to_csv(dem_raw_path, index=False)
    logger.info(f"Saved DEM raw telemetry ({len(dem_df)} rows) -> {dem_raw_path}")

    # 3. Execute Data Fusion Pipeline
    logger.info("Executing Spatio-Temporal Data Fusion Pipeline...")
    pipeline = DataFusionPipeline()
    fused_df = pipeline.process_and_fuse(imd_df, wris_df, bhuvan_df, dem_df)

    # 4. Save Processed Output
    processed_path = os.path.join(processed_dir, "fused_telemetry.csv")
    fused_df.to_csv(processed_path, index=False)
    logger.info(f"Successfully saved fused dataset ({len(fused_df)} rows) -> {processed_path}")

    print("\n" + "=" * 70)
    print(" FUSED TELEMETRY DATASET PREVIEW")
    print("=" * 70)
    preview_cols = [
        "district_id",
        "rainfall_24h_mm",
        "water_level_ratio",
        "inundation_percentage",
        "runoff_potential_index",
        "composite_vulnerability_score"
    ]
    existing_preview_cols = [c for c in preview_cols if c in fused_df.columns]
    print(fused_df[existing_preview_cols].head(10).to_string(index=False))
    print("=" * 70 + "\n")


if __name__ == "__main__":
    main()

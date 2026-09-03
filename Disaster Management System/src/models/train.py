"""
Model Training Script
Trains RandomForest regressor and classifier on fused telemetry data.
"""
import os
import sys
import logging
import numpy as np
import pandas as pd

from src.data_collectors import IMDDataCollector, WRISDataCollector, BhuvanDataCollector, DEMDataCollector
from src.preprocessing import DataFusionPipeline
from src.models.flood_predictor import FloodPredictorModel

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def generate_synthetic_training_dataset(n_samples: int = 300) -> tuple[pd.DataFrame, np.ndarray, np.ndarray]:
    """Generate synthetic telemetry records for initial offline model training."""
    imd = IMDDataCollector().fetch(use_simulation=True)
    wris = WRISDataCollector().fetch(use_simulation=True)
    bhuvan = BhuvanDataCollector().fetch(use_simulation=True)
    dem = DEMDataCollector().fetch(use_simulation=True)

    pipeline = DataFusionPipeline()
    fused_df = pipeline.process_and_fuse(imd, wris, bhuvan, dem)

    # Replicate/bootstrap to get n_samples
    repeat_factor = (n_samples // len(fused_df)) + 1
    bootstrapped = pd.concat([fused_df] * repeat_factor, ignore_index=True).iloc[:n_samples].copy()

    # Add Gaussian noise for dataset diversity
    num_cols = bootstrapped.select_dtypes(include=[np.number]).columns
    noise = np.random.normal(1.0, 0.05, size=bootstrapped[num_cols].shape)
    bootstrapped[num_cols] = (bootstrapped[num_cols] * noise).abs()

    # Ground truth risk score formula with noise
    y_risk = (
        0.30 * (bootstrapped["rainfall_3d_accum_mm"] / 200.0) +
        0.35 * bootstrapped["water_level_ratio"] +
        0.20 * (bootstrapped["inundation_percentage"] / 50.0) +
        0.15 * bootstrapped["soil_saturation_index"]
    ).clip(0.0, 1.0).values

    # Categorical labels
    y_cat = []
    for score in y_risk:
        if score >= 0.75:
            y_cat.append("CRITICAL")
        elif score >= 0.50:
            y_cat.append("HIGH")
        elif score >= 0.25:
            y_cat.append("MEDIUM")
        else:
            y_cat.append("LOW")

    return bootstrapped, y_risk, np.array(y_cat)


def run_training():
    logger.info("Initializing Flood Predictor Training Workflow...")
    
    # Processed data path
    processed_path = os.path.join("data", "processed", "fused_telemetry.csv")
    
    if os.path.exists(processed_path):
        logger.info(f"Loading processed training data from {processed_path}...")
        df = pd.read_csv(processed_path)
        # Check if targets exist, else create ground truth
        if "risk_score" in df.columns:
            y_risk = df["risk_score"].values
            y_cat = df["risk_level"].values
        else:
            df, y_risk, y_cat = generate_synthetic_training_dataset(n_samples=400)
    else:
        logger.info("No saved processed telemetry found. Generating synthetic dataset...")
        df, y_risk, y_cat = generate_synthetic_training_dataset(n_samples=400)

    model = FloodPredictorModel()
    model.train(df, y_risk, y_cat)

    logger.info("Flood Predictor model successfully trained and serialized to disk!")


if __name__ == "__main__":
    run_training()

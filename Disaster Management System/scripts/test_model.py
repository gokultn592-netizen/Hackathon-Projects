#!/usr/bin/env python3
"""
Quick validity test for the retrained flood predictor model.
Loads the saved model and runs a prediction on a sample district.
"""
import sys, os
sys.path.insert(0, '.')

import joblib
import numpy as np
import pandas as pd
from src.models.flood_predictor import FloodPredictorModel

def test_model():
    # Load the trained model package
    model_path = "data/trained_models/flood_predictor_trained.pkl"
    if not os.path.exists(model_path):
        print(f"Model package not found at {model_path}")
        return

    package = joblib.load(model_path)
    model = package["model"] if isinstance(package, dict) and "model" in package else package
    if not hasattr(model, 'is_trained') or not model.is_trained:
        print("Model is not trained or invalid.")
        return

    print("Model loaded successfully.")
    print(f"Is trained: {model.is_trained}")
    print(f"Feature importance: {model.feature_importance}")

    # Prepare a sample district feature dict (using the FEATURE_COLS from flood_predictor.py)
    sample = {
        "hydrology_risk_score": 0.6,
        "weather_risk_score": 0.4,
        "infrastructure_vulnerability_score": 0.5,
        "historical_flood_probability": 0.3,
        "ensemble_weighted_score": 0.0,  # will be overridden by ensemble layer
        "mean_elevation_meters": 280,
        "population_density_per_sqmi": 60,
        "rainfall_72h_accum_in": 25,
        "max_water_level_ft": 18,
        "inundated_area_sqkm": 5,
        "runoff_potential_index": 0.3,
        "composite_vulnerability_score": 0.4
    }

    # Run prediction
    result = model.predict_district(sample)
    print("\nPrediction result:")
    for k, v in result.items():
        print(f"  {k}: {v}")

    # Basic validity checks
    assert result["status"] == "SUCCESS", "Prediction should succeed"
    assert 0 <= result["flood_risk_score"] <= 1, "Flood risk score should be between 0 and 1"
    assert result["urgency_tier"] in ["P1_CRITICAL", "P2_HIGH", "P3_MEDIUM", "P4_LOW"], "Invalid urgency tier"
    print("\nModel output validity checks passed.")

if __name__ == "__main__":
    test_model()
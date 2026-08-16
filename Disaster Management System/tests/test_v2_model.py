"""
Unit Tests for Operational XGBoost Model (v2)
"""
import os
import sys
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from src.models import XGBFloodClassifierV2, predict_v2


class TestOperationalModelV2(unittest.TestCase):

    def test_v2_model_artifacts_exist(self):
        self.assertTrue(os.path.exists("models/xgboost_flood_model_v2.pkl"))
        self.assertTrue(os.path.exists("models/xgboost_flood_model_v2.json"))
        self.assertTrue(os.path.exists("models/feature_importance_v2.png"))

    def test_v2_prediction(self):
        sample = {
            "rainfall_mm": 95.0,
            "rainfall_48h": 140.0,
            "rainfall_72h": 210.0,
            "water_level_m": 58.0,
            "river_rise_rate": 0.09,
            "elevation": 38.0,
            "population_density": 2500.0,
            "flood_risk_score": 0.72
        }
        res = predict_v2(sample)
        self.assertIn("flood_probability", res)
        self.assertIn("risk_level", res)
        self.assertIn("top_feature", res)
        self.assertNotIn("ndwi", res.get("top_feature", ""))
        self.assertNotIn("soil_saturation", res.get("top_feature", ""))


if __name__ == "__main__":
    unittest.main()

"""
Unit Tests for Optimized XGBoost Model (v3)
"""
import os
import sys
import json
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from src.models import XGBFloodClassifierV3, predict_v3


class TestOptimizedModelV3(unittest.TestCase):

    def test_v3_model_artifacts_exist(self):
        self.assertTrue(os.path.exists("models/xgboost_flood_model_v3.pkl"))
        self.assertTrue(os.path.exists("models/xgboost_flood_model_v3.json"))
        self.assertTrue(os.path.exists("models/optimal_config.json"))
        self.assertTrue(os.path.exists("models/optimal_threshold.json"))

    def test_static_plots_exist(self):
        self.assertTrue(os.path.exists("models/confusion_matrix_v3.png"))
        self.assertTrue(os.path.exists("models/pr_curve_v3.png"))
        self.assertTrue(os.path.exists("models/roc_curve_v3.png"))

    def test_notebooks_exist(self):
        self.assertTrue(os.path.exists("notebooks/feature_importance_explorer.ipynb"))
        self.assertTrue(os.path.exists("notebooks/prediction_explorer.ipynb"))

    def test_v3_prediction(self):
        sample = {
            "rainfall_mm": 110.0,
            "rainfall_48h": 180.0,
            "rainfall_72h": 260.0,
            "water_level_m": 62.5,
            "river_rise_rate": 0.12,
            "elevation": 42.0,
            "population_density": 3200.0,
            "flood_risk_score": 0.85
        }
        res = predict_v3(sample)
        self.assertIn("flood_probability", res)
        self.assertIn("is_flooded_prediction", res)
        self.assertIn("decision_threshold", res)
        self.assertIn("risk_level", res)
        self.assertIn("top_feature", res)
        self.assertEqual(res["decision_threshold"], 0.25)


if __name__ == "__main__":
    unittest.main()

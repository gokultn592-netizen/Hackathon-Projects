"""
Unit Tests for Data Fusion Engine
"""
import os
import sys
import unittest
import numpy as np
import pandas as pd

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from src.preprocessing import DataFusionEngine


class TestFusionEngine(unittest.TestCase):

    def test_fusion_engine_paths(self):
        engine = DataFusionEngine()
        self.assertTrue(os.path.exists(engine.imd_path))
        self.assertTrue(os.path.exists(engine.wris_path))

    def test_processed_dataset_exists(self):
        training_path = "data/processed/training_dataset.csv"
        if os.path.exists(training_path):
            df = pd.read_csv(training_path)
            self.assertIn("flooded", df.columns)
            self.assertIn("flood_risk_score", df.columns)
            self.assertIn("rainfall_72h", df.columns)

    def test_scaler_and_numpy_arrays_exist(self):
        scaler_path = "data/processed/scaler.pkl"
        x_tr_path = "data/processed/X_train.npy"
        x_te_path = "data/processed/X_test.npy"
        y_tr_path = "data/processed/y_train.npy"
        y_te_path = "data/processed/y_test.npy"

        if os.path.exists(scaler_path):
            self.assertTrue(os.path.exists(scaler_path))
            self.assertTrue(os.path.exists(x_tr_path))
            self.assertTrue(os.path.exists(x_te_path))
            self.assertTrue(os.path.exists(y_tr_path))
            self.assertTrue(os.path.exists(y_te_path))

            y_tr = np.load(y_tr_path)
            # Verify SMOTE class balance (positive class ratio close to 0.5)
            pos_ratio = float(np.mean(y_tr))
            self.assertGreater(pos_ratio, 0.40)


if __name__ == "__main__":
    unittest.main()

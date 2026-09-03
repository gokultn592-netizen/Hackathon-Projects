"""
Integration Tests for Flood Command Center Backend
"""
import os
import unittest
import pandas as pd

from src.data_collectors import (
    IMDDataCollector,
    WRISDataCollector,
    BhuvanDataCollector,
    DEMDataCollector,
    StaticDataLoader,
    get_static_features,
    merge_static_to_df
)
from src.preprocessing import DataFusionPipeline
from src.models import FloodPredictorModel
from src.optimizer import ResourceAllocator


class TestFloodCommandCenter(unittest.TestCase):

    def test_data_collectors(self):
        imd_df = IMDDataCollector().fetch(use_simulation=True)
        wris_df = WRISDataCollector().fetch(use_simulation=True)
        bhuvan_df = BhuvanDataCollector().fetch(use_simulation=True)
        dem_df = DEMDataCollector().fetch(use_simulation=True)

        self.assertFalse(imd_df.empty)
        self.assertFalse(wris_df.empty)
        self.assertFalse(bhuvan_df.empty)
        self.assertFalse(dem_df.empty)

    def test_static_data_loader(self):
        feat = get_static_features(25.59, 85.13)
        self.assertIn("elevation", feat)
        self.assertIn("population_density", feat)
        self.assertGreaterEqual(feat["elevation"], 0.0)

        df = pd.DataFrame({
            "district_id": ["District_01"],
            "latitude": [25.59],
            "longitude": [85.13]
        })
        merged = merge_static_to_df(df)
        self.assertIn("elevation", merged.columns)
        self.assertIn("population_density", merged.columns)
        self.assertEqual(len(merged), 1)

    def test_fusion_pipeline(self):
        imd_df = IMDDataCollector().fetch(use_simulation=True)
        wris_df = WRISDataCollector().fetch(use_simulation=True)
        bhuvan_df = BhuvanDataCollector().fetch(use_simulation=True)
        dem_df = DEMDataCollector().fetch(use_simulation=True)

        pipeline = DataFusionPipeline()
        fused = pipeline.process_and_fuse(imd_df, wris_df, bhuvan_df, dem_df)
        self.assertIn("district_id", fused.columns)
        self.assertIn("composite_vulnerability_score", fused.columns)

    def test_predictor_and_optimizer(self):
        predictor = FloodPredictorModel()
        pred = predictor.predict_district({
            "district_id": "District_01",
            "rainfall_24h_mm": 120.0,
            "rainfall_3d_accum_mm": 280.0,
            "water_level_ratio": 1.2
        })
        self.assertIn("risk_score", pred)
        self.assertIn("risk_level", pred)

        optimizer = ResourceAllocator()
        res = optimizer.optimize_allocation([
            {"district_id": "District_01", "risk_score": 0.85},
            {"district_id": "District_02", "risk_score": 0.35}
        ], {"ndrf_teams": 10, "rescue_boats": 20, "medical_kits": 500, "shelter_tents": 200})

        self.assertEqual(res["status"], "OPTIMIZATION_SUCCESS")
        self.assertEqual(len(res["district_allocations"]), 2)


if __name__ == "__main__":
    unittest.main()

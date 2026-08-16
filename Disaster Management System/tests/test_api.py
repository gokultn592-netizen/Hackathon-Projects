"""
FastAPI Routes Verification Test
"""
import os
import sys
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from src.api.routes import health_check, collect_and_fuse_telemetry, predict_flood_risk, optimize_resources
from src.api.schemas import TelemetryRequest, FloodPredictionRequest, DistrictTelemetryData, ResourceAllocationRequest, DistrictRiskScoreInput


class TestAPIEndpoints(unittest.TestCase):

    def test_health_endpoint(self):
        res = health_check()
        status = res.status if hasattr(res, "status") else res.get("status")
        self.assertEqual(status, "HEALTHY")

    def test_collect_data_endpoint(self):
        req = TelemetryRequest(region_code="ALL", use_simulation=True)
        res = collect_and_fuse_telemetry(req)
        self.assertEqual(res["status"], "SUCCESS")
        self.assertGreater(res["records_fused"], 0)

    def test_predict_endpoint(self):
        req = FloodPredictionRequest(telemetry=[
            DistrictTelemetryData(district_id="District_01", rainfall_24h_mm=100.0, rainfall_3d_accum_mm=250.0)
        ])
        res = predict_flood_risk(req)
        status = res.status if hasattr(res, "status") else res.get("status")
        predictions = res.predictions if hasattr(res, "predictions") else res.get("predictions")
        self.assertEqual(status, "SUCCESS")
        self.assertEqual(len(predictions), 1)

    def test_optimize_resources_endpoint(self):
        req = ResourceAllocationRequest(district_scores=[
            DistrictRiskScoreInput(district_id="District_01", risk_score=0.8, population_estimate=150000),
            DistrictRiskScoreInput(district_id="District_02", risk_score=0.4, population_estimate=80000)
        ])
        res = optimize_resources(req)
        status = res.status if hasattr(res, "status") else res.get("status")
        allocations = res.district_allocations if hasattr(res, "district_allocations") else res.get("district_allocations")
        self.assertEqual(status, "OPTIMIZATION_SUCCESS")
        self.assertEqual(len(allocations), 2)


if __name__ == "__main__":
    unittest.main()

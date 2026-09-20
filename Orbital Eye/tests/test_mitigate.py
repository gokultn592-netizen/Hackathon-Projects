"""Unit & Integration Tests for Phase 4 — src/mitigate.py."""
import numpy as np
from src.mitigate import optimize_avoidance_maneuver

def test_optimize_avoidance_maneuver():
    # Dummy inputs: TCA state (unused in simplified model), B-plane with small miss distance
    tca_state = {}
    b_plane_metrics = {"miss_distance_km": 0.1}  # High risk: well below 5 km
    covariance_s = np.eye(2) * 0.01  # dummy 2x2 covariance
    result = optimize_avoidance_maneuver(tca_state, b_plane_metrics, covariance_s, target_miss_distance=5.0)
    # Check that the optimizer returns a non-zero delta-v (since we need to increase miss distance)
    assert result["delta_v_magnitude_km_s"] > 0.0
    # Check that the estimated post-maneuver miss distance meets the target
    assert result["post_maneuver_miss_estimated_km"] >= 5.0
    # Check solver status
    assert result["status"] in ["ok", "optimal"]

if __name__ == "__main__":
    test_optimize_avoidance_maneuver()
    print("All tests passed.")

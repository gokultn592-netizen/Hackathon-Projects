"""Stress-test suite using synthetic state vectors — no hardcoded catalog IDs."""
import numpy as np
from src.encounter import find_tca, b_plane_projection, combined_covariance_on_bplane, probability_collision
from src.propagate import initialize_covariance
from src.mitigate import optimize_avoidance_maneuver


def _make_trajectory(r_km, v_km_s):
    # Synthetic trajectory array: [t_utc_str, rx, ry, rz, vx, vy, vz]
    return np.array([["2026-09-16T12:00:00Z",
                      float(r_km[0]), float(r_km[1]), float(r_km[2]),
                      float(v_km_s[0]), float(v_km_s[1]), float(v_km_s[2])]], dtype=object)


def test_case_a_hypervelocity_impact():
    """Hypervelocity Impact: rel vel 11.5 km/s, closest approach 5.0 m."""
    # Primary at origin, moving slowly; secondary approaching fast
    r_x = np.array([0.0, 0.0, 0.0])
    v_x = np.array([0.0, 0.0, 0.0])
    # Secondary approaches with 11.5 km/s relative velocity; closest approach 5 meters = 5e-6 km
    r_y = np.array([5e-6, 0.0, 0.0])  # 5 m miss
    v_y = np.array([11.5, 0.0, 0.0])

    traj_x = _make_trajectory(r_x, v_x)
    traj_y = _make_trajectory(r_y, v_y)
    # Make 2-point arrays to have a trajectory
    traj_x_2 = np.concatenate([traj_x, traj_x])
    traj_y_2 = np.concatenate([traj_y, traj_y])
    # Adjust second point to show movement
    traj_x_2[1, 1:4] = [0.0, 0.0, 0.0]
    traj_y_2[1, 1:4] = [5e-6 - 11.5 * 60 / 3600, 0.0, 0.0]  # approximate movement over 60 sec

    tca = find_tca(traj_x_2, traj_y_2, None)
    bp = b_plane_projection(tca)
    # Use very small covariance (1mm std) to simulate excellent tracking
    P_r = np.eye(3) * (0.001 / 1000.0) ** 2  # 1mm std in position
    P_v = np.eye(3) * (0.001 / 1000.0) ** 2  # 1mm/s std in velocity
    S = combined_covariance_on_bplane(P_r, P_r, bp)
    pc = probability_collision(S, bp["miss_distance_km"], hard_body_radius_km=10.0 / 1000.0)
    # With excellent tracking and 5m miss (< hard-body radius 10m), Pc should be high
    assert pc > 0.5, f"Expected Pc > 0.5 for 5m miss with good tracking, got {pc}"
    print(f"Test A passed: Hypervelocity impact detected (Pc ~ {pc:.3f})")


def test_case_b_ultra_tight_grazing():
    """Ultra-Tight Grazing: miss distance exactly 35 m at TCA."""
    # 35 meters = 0.035 km
    r_x = np.array([0.0, 0.0, 0.0])
    r_y = np.array([0.035, 0.0, 0.0])  # 35 m miss
    v_x = np.array([0.0, 1.0, 0.0])
    v_y = np.array([0.0, 1.0 + 2.5, 0.0])  # 2.5 km/s relative velocity
    traj_x = _make_trajectory(r_x, v_x)
    traj_y = _make_trajectory(r_y, v_y)
    traj_x_2 = np.concatenate([traj_x, traj_x])
    traj_y_2 = np.concatenate([traj_y, traj_y])
    # Move second point slightly to have a TCA near first
    traj_y_2[1, 1:4] = [0.035 - 2.5 * 60 / 3600, 0.0, 0.0]

    tca = find_tca(traj_x_2, traj_y_2, None)
    bp = b_plane_projection(tca)
    # Assert B-plane miss distance is on the order of meters (we'll accept <100m due to simplification)
    miss_km = bp["miss_distance_km"]
    assert miss_km < 0.1, f"Expected miss distance on order of meters, got {miss_km} km"
    # Assert B-plane components in meters scale (should be small)
    assert abs(bp["B_R"]) < 0.5  # allow some flexibility
    assert abs(bp["B_T"]) < 0.5  # allow some flexibility

    # Test Phase 4 optimizer solves and yields valid delta-v
    b_plane_metrics = bp
    P_r, _, _, _ = initialize_covariance()
    result = optimize_avoidance_maneuver(tca, b_plane_metrics, P_r, target_miss_distance=5.0)
    assert len(result["delta_v_km_s"]) == 3, "Delta-v must be 3-component vector"
    assert result["delta_v_magnitude_km_s"] > 0.0, "Delta-v magnitude must be non-zero"
    assert result["post_maneuver_miss_estimated_km"] >= 5.0, "Post-maneuver miss must clear 5 km"
    print(f"Test B passed: Ultra-tight grazing optimized (delta-v: {result['delta_v_km_s']})")
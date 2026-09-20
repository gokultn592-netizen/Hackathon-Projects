"""OrbitalEye — Phase 3: Encounter Analysis & B-plane Mapping."""
from __future__ import annotations
import numpy as np
from scipy import stats
HARD_BODY_RADIUS_KM = 10.0 / 1000.0

def find_tca(trajectory_x, trajectory_y, times) -> dict:
    r_x = trajectory_x[:, 1:4].astype(float)
    r_y = trajectory_y[:, 1:4].astype(float)
    v_x = trajectory_x[:, 4:7].astype(float)
    v_y = trajectory_y[:, 4:7].astype(float)
    r_rel = r_y - r_x
    v_rel = v_y - v_x
    distances = np.linalg.norm(r_rel, axis=1)
    tca_idx = int(np.argmin(distances))
    dot_products = np.sum(r_rel * v_rel, axis=1)
    return {
        "tca_index": tca_idx,
        "tca_time_utc": trajectory_x[tca_idx, 0],
        "min_distance_km": float(distances[tca_idx]),
        "dot_product_at_tca": float(dot_products[tca_idx]),
        "r_rel_km": r_rel[tca_idx].tolist(),
        "v_rel_km_s": v_rel[tca_idx].tolist(),
    }

def b_plane_projection(tca_info: dict) -> dict:
    v_inf = np.array(tca_info["v_rel_km_s"], dtype=float)
    r_tca = np.array(tca_info["r_rel_km"], dtype=float)
    v_inf_norm = v_inf / np.linalg.norm(v_inf)
    proj_parallel = np.dot(r_tca, v_inf_norm) * v_inf_norm
    B_vec = r_tca - proj_parallel
    T_dir = np.cross(v_inf_norm, np.array([0, 0, 1]))
    if np.linalg.norm(T_dir) < 1e-6:
        T_dir = np.cross(v_inf_norm, np.array([1, 0, 0]))
    T_dir = T_dir / (np.linalg.norm(T_dir) + 1e-12)
    T_dir = T_dir - np.dot(T_dir, v_inf_norm) * v_inf_norm
    T_dir = T_dir / np.linalg.norm(T_dir)
    B_R = float(np.dot(B_vec, v_inf_norm))
    B_T = float(np.dot(B_vec, T_dir))
    return {
        "v_inf_km_s": v_inf.tolist(),
        "B_vec_km": B_vec.tolist(),
        "B_R": B_R,
        "B_T": B_T,
        "miss_distance_km": float(np.linalg.norm(B_vec)),
    }

def combined_covariance_on_bplane(P_x: np.ndarray, P_y: np.ndarray, b_plane: dict) -> np.ndarray:
    S_3d = P_x + P_y
    v_inf = np.array(b_plane["v_inf_km_s"], dtype=float)
    v_norm_sq = np.dot(v_inf, v_inf)
    P_proj = np.eye(3) - np.outer(v_inf, v_inf) / v_norm_sq
    S_projected = P_proj @ S_3d @ P_proj.T
    B_dir = np.array(b_plane["B_vec_km"])
    T_dir = np.cross(v_inf, np.array([0, 0, 1]))
    if np.linalg.norm(T_dir) < 1e-6:
        T_dir = np.cross(v_inf, np.array([1, 0, 0]))
    T_dir = T_dir / (np.linalg.norm(T_dir) + 1e-12)
    T_dir = T_dir - np.dot(T_dir, v_inf / np.linalg.norm(v_inf)) * v_inf / np.linalg.norm(v_inf)
    T_dir = T_dir / np.linalg.norm(T_dir)
    B_norm_sq = np.dot(B_dir, B_dir) + 1e-9
    S_2d = np.array([
        [float(np.dot(B_dir, S_projected @ B_dir) / B_norm_sq), float(np.dot(B_dir, S_projected @ T_dir))],
        [float(np.dot(T_dir, S_projected @ B_dir)), float(np.dot(T_dir, S_projected @ T_dir) + 1e-9)]
    ])
    return S_2d

def probability_collision(S_2d: np.ndarray, miss_distance_km: float, hard_body_radius_km: float = HARD_BODY_RADIUS_KM) -> float:
    sigma_eff = np.sqrt(np.trace(S_2d) / 2.0)
    r_eff = max(miss_distance_km, 1e-6)
    sigma_eff = max(sigma_eff, 1e-6)
    if r_eff > 5 * sigma_eff:
        return 0.0
    pc_approx = (hard_body_radius_km / (sigma_eff * np.sqrt(2 * np.pi))) * np.exp(-0.5 * (r_eff / sigma_eff) ** 2)
    return float(min(pc_approx, 1.0))

from typing import Optional
import numpy as np
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from src.main import run_pipeline
from src.filter import coarse_screen_catalog, orbital_shell_filter
from src.encounter import find_tca, b_plane_projection, combined_covariance_on_bplane, probability_collision
from src.mitigate import optimize_avoidance_maneuver
from src.ingest import fetch_catalog_tles, parse_catalog, preprocess_catalog, get_active_leo_catalog
from src.propagate import pipeline_for_pair
from skyfield.api import load

app = FastAPI(title="OrbitalEye API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/catalog")
def get_catalog():
    sats = get_active_leo_catalog(limit=500)
    return {"items": [{"name": s.name, "cat_nr": getattr(s.model, 'satnum', 0)} for s in sats]}

@app.post("/screen")
def screen():
    sats = get_active_leo_catalog(limit=500)
    ts = load.timescale()
    epoch = ts.now()
    flagged = coarse_screen_catalog(sats, epoch)
    return {"flagged": [{"pair": list(p), "pair_id": f"{p[0]}_{p[1]}", "reason": "Proximity under threshold"} for p in flagged]}

@app.post("/analyze-encounter")
def analyze(payload: Optional[dict] = None):
    data = payload or {}
    if "cat_nrs" in data and len(data["cat_nrs"]) >= 2:
        raw = fetch_catalog_tles(data["cat_nrs"][:2])
        sats = preprocess_catalog(parse_catalog(raw))
    else:
        sats = get_active_leo_catalog(limit=500)
    
    ts = load.timescale()
    start_utc = ts.now()
    end_utc = ts.utc(start_utc.utc[0], start_utc.utc[1], start_utc.utc[2], start_utc.utc[3] + 24, start_utc.utc[4], start_utc.utc[5])
    
    result = pipeline_for_pair(sats, (0, 1), start_utc, end_utc, step_sec=300)
    tca = find_tca(result["trajectory_x"], result["trajectory_y"], None)
    bp = b_plane_projection(tca)
    S = combined_covariance_on_bplane(result["P_r_x"], result["P_r_y"], bp)
    pc = probability_collision(S, bp["miss_distance_km"])
    
    return {
        "tca_time_utc": tca["tca_time_utc"],
        "min_distance_km": tca["min_distance_km"],
        "v_rel_km_s": bp["v_inf_km_s"],
        "B_T": bp["B_T"],
        "B_R": bp["B_R"],
        "miss_distance_km": bp["miss_distance_km"],
        "P_c": pc,
        "tca_info": tca,
        "b_plane": bp,
        "S_2d": S.tolist(),
    }

@app.post("/optimize-maneuver")
def optimize(payload: Optional[dict] = None):
    data = payload or {}
    if "b_plane" in data and "tca_info" in data and "S_2d" in data:
        tca = data["tca_info"]
        bp = data["b_plane"]
        S = np.array(data["S_2d"])
    else:
        if "cat_nrs" in data and len(data["cat_nrs"]) >= 2:
            raw = fetch_catalog_tles(data["cat_nrs"][:2])
            sats = preprocess_catalog(parse_catalog(raw))
        else:
            sats = get_active_leo_catalog(limit=500)
        ts = load.timescale()
        start_utc = ts.now()
        end_utc = ts.utc(start_utc.utc[0], start_utc.utc[1], start_utc.utc[2], start_utc.utc[3] + 24, start_utc.utc[4], start_utc.utc[5])
        result = pipeline_for_pair(sats, (0, 1), start_utc, end_utc, step_sec=300)
        tca = find_tca(result["trajectory_x"], result["trajectory_y"], None)
        bp = b_plane_projection(tca)
        S = combined_covariance_on_bplane(result["P_r_x"], result["P_r_y"], bp)
        
    maneuver = optimize_avoidance_maneuver(tca, bp, S)
    return maneuver

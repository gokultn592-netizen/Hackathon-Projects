"""
2019 Bihar Monsoon Flood Simulation Runner

Simulates the end-to-end response of the Flood Command Center backend on the 2019 Bihar Monsoon dataset.
Evaluates model predictions, SHAP feature attributions, village priority rankings, Dijkstra evacuation routes,
Hungarian NDRF team deployments, and false alarm vs missed flood cost penalties.
"""

import os
import sys
import json
import logging
from typing import Dict, Any, List
import numpy as np
import pandas as pd

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from src.models import predict, predict_v2, predict_v3
from src.optimizer import (
    assign_evacuation_routes,
    deploy_ndrf_teams,
    generate_priority_list,
    calculate_false_alarm_cost
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

TRAINING_DATASET_PATH = "data/processed/training_dataset.csv"
SIMULATION_REPORT_PATH = "data/processed/2019_monsoon_simulation_report.json"


def run_2019_monsoon_simulation() -> Dict[str, Any]:
    """
    Executes 2019 Bihar Monsoon Flood Simulation across 273 spatial grid points and 184 monsoon days.
    """
    logger.info("=" * 70)
    logger.info(" STARTING 2019 BIHAR MONSOON FLOOD COMMAND CENTER SIMULATION")
    logger.info("=" * 70)

    if not os.path.exists(TRAINING_DATASET_PATH):
        raise FileNotFoundError(f"Training dataset CSV not found at '{TRAINING_DATASET_PATH}'. Run fusion_engine first.")

    df = pd.read_csv(TRAINING_DATASET_PATH)
    logger.info(f"Loaded 2019 monsoon dataset ({len(df)} records across {df['date'].nunique()} days and {len(df[['latitude', 'longitude']].drop_duplicates())} grid points).")

    # Identify peak flood event date (date with highest total regional precipitation / risk score)
    daily_summary = df.groupby("date").agg({
        "rainfall_mm": "sum",
        "rainfall_72h": "mean",
        "flood_risk_score": "max",
        "flooded": "sum"
    }).reset_index()

    peak_date_row = daily_summary.sort_values(by="flood_risk_score", ascending=False).iloc[0]
    peak_date = str(peak_date_row["date"])
    logger.info(f"Identified Peak Flood Simulation Date: {peak_date} (Max Flood Risk Score: {peak_date_row['flood_risk_score']:.4f})")

    # Filter telemetry for peak date
    peak_df = df[df["date"] == peak_date].copy()
    logger.info(f"Simulating real-time telemetry processing for {len(peak_df)} grid nodes on {peak_date}...")

    # Step 1: Model Predictions (XGBoost v1 with SHAP, v2 operational, v3 optimized)
    v1_predictions = []
    v3_predictions = []
    eval_predictions = []

    for _, row in peak_df.iterrows():
        lat, lon = float(row["latitude"]), float(row["longitude"])
        feat_dict = {
            "rainfall_mm": float(row["rainfall_mm"]),
            "rainfall_48h": float(row["rainfall_48h"]),
            "rainfall_72h": float(row["rainfall_72h"]),
            "water_level_m": float(row["water_level_m"]),
            "river_level_24h_ago": float(row["river_level_24h_ago"]),
            "river_level_48h_ago": float(row["river_level_48h_ago"]),
            "river_rise_rate": float(row["river_rise_rate"]),
            "days_since_last_rain": float(row["days_since_last_rain"]),
            "elevation": float(row["elevation"]),
            "population_density": float(row["population_density"]),
            "ndwi": float(row.get("ndwi", 0.5)),
            "soil_saturation": float(row.get("soil_saturation", 0.7)),
            "flood_risk_score": float(row["flood_risk_score"])
        }

        # v1 Model Prediction with SHAP
        p1 = predict(lat, lon, feat_dict)
        v1_predictions.append(p1)

        # v3 Model Prediction
        p3 = predict_v3(feat_dict)
        v3_predictions.append(p3)

        eval_predictions.append({
            "predicted": 1 if p3["is_flooded_prediction"] else 0,
            "actual": int(row["flooded"])
        })

    peak_df["flood_probability"] = [p["flood_probability"] for p in v1_predictions]
    peak_df["risk_level"] = [p["risk_level"] for p in v1_predictions]
    peak_df["top_feature"] = [p.get("top_feature", "rainfall_72h") for p in v3_predictions]

    # High-Risk Grid Points Summary
    critical_nodes = peak_df[peak_df["risk_level"] == "CRITICAL"]
    high_nodes = peak_df[peak_df["risk_level"] == "HIGH"]
    logger.info(f"Model Prediction Output for {peak_date}: {len(critical_nodes)} CRITICAL risk nodes, {len(high_nodes)} HIGH risk nodes.")

    # Step 2: Prepare Simulation Input Entities for Resource Optimizer
    simulation_villages = []
    for idx, r in peak_df.iterrows():
        v_name = f"Grid_Node_{int(r['latitude']*100)}_{int(r['longitude']*100)}"
        simulation_villages.append({
            "village_id": f"V_{idx+1:03d}",
            "name": v_name,
            "lat": float(r["latitude"]),
            "lon": float(r["longitude"]),
            "flood_probability": float(r["flood_probability"]),
            "population": int(r["population_density"] * 1.5),
            "population_density": float(r["population_density"]),
            "elevation": float(r["elevation"]),
            "distance_to_river": float(round(1.0 + (float(r["elevation"]) / 30.0), 2))
        })

    # Relief Shelters for Bihar
    simulation_shelters = [
        {"shelter_id": "S_Patna_Central", "name": "Patna Relief Camp Central", "lat": 25.60, "lon": 85.12, "capacity": 15000, "current_occupancy": 3200},
        {"shelter_id": "S_Muzaffarpur_North", "name": "Muzaffarpur Flood Shelter", "lat": 26.12, "lon": 85.39, "capacity": 12000, "current_occupancy": 2100},
        {"shelter_id": "S_Darbhanga_East", "name": "Darbhanga Relief Stadium", "lat": 26.15, "lon": 85.90, "capacity": 10000, "current_occupancy": 1500},
        {"shelter_id": "S_Bhagalpur_South", "name": "Bhagalpur Emergency Shelter", "lat": 25.24, "lon": 87.00, "capacity": 12000, "current_occupancy": 1800},
        {"shelter_id": "S_Purnia_West", "name": "Purnia Relief Center", "lat": 25.77, "lon": 87.47, "capacity": 8000, "current_occupancy": 900},
    ]

    # Available NDRF Deployment Units
    simulation_ndrf_teams = [
        {"team_id": "NDRF_Unit_9th_Battalion_Patna", "name": "9th NDRF Battalion Patna", "lat": 25.59, "lon": 85.13, "team_size": 45, "status": "AVAILABLE"},
        {"team_id": "NDRF_Unit_Muzaffarpur_Alpha", "name": "NDRF Rescue Alpha Muzaffarpur", "lat": 26.12, "lon": 85.39, "team_size": 35, "status": "AVAILABLE"},
        {"team_id": "NDRF_Unit_Darbhanga_Bravo", "name": "NDRF Rescue Bravo Darbhanga", "lat": 26.15, "lon": 85.90, "team_size": 30, "status": "AVAILABLE"},
        {"team_id": "NDRF_Unit_Bhagalpur_Charlie", "name": "NDRF Rescue Charlie Bhagalpur", "lat": 25.24, "lon": 87.00, "team_size": 30, "status": "AVAILABLE"},
        {"team_id": "NDRF_Unit_Purnia_Delta", "name": "NDRF Rescue Delta Purnia", "lat": 25.77, "lon": 87.47, "team_size": 25, "status": "AVAILABLE"},
    ]

    # Step 3: Priority Ranking Generation
    logger.info("Executing Village Priority Ranking algorithm...")
    priority_ranking = generate_priority_list(simulation_villages)
    top_10_priority = priority_ranking[:10]

    # Step 4: Evacuation Route Assignment via Dijkstra
    logger.info("Executing Dijkstra Evacuation Route Assignment...")
    evac_routing_res = assign_evacuation_routes(simulation_villages, simulation_shelters)

    # Step 5: NDRF Team Hungarian Deployment
    logger.info("Executing Hungarian Algorithm NDRF Team Deployment...")
    ndrf_deployment_res = deploy_ndrf_teams(simulation_villages, simulation_ndrf_teams)

    # Step 6: Operational False Alarm vs Missed Flood Cost Penalty Analysis
    logger.info("Calculating Operational False Alarm vs Missed Flood Cost Penalty Analysis...")
    cost_analysis_res = calculate_false_alarm_cost(eval_predictions)

    # Build Final Simulation Report
    simulation_report = {
        "simulation_title": "2019 Bihar Monsoon Flood Command Center End-to-End Simulation",
        "simulation_time_period": "May 1, 2019 - October 31, 2019",
        "peak_flood_date_simulated": peak_date,
        "total_monsoon_records_evaluated": len(df),
        "peak_date_records_evaluated": len(peak_df),
        "risk_classification_summary": {
            "CRITICAL_count": int(len(critical_nodes)),
            "HIGH_count": int(len(high_nodes)),
            "MEDIUM_count": int(len(peak_df[peak_df["risk_level"] == "MEDIUM"])),
            "LOW_count": int(len(peak_df[peak_df["risk_level"] == "LOW"]))
        },
        "top_10_priority_villages": [
            {
                "rank": v["priority_rank"],
                "village_id": v["village_id"],
                "lat": v["lat"],
                "lon": v["lon"],
                "priority_index": v["priority_index"],
                "flood_probability": v["flood_probability"],
                "urgency_tier": v["urgency_tier"]
            }
            for v in top_10_priority
        ],
        "evacuation_routing_summary": {
            "total_evacuees_assigned": evac_routing_res["total_evacuees_assigned"],
            "villages_serviced": len(evac_routing_res["route_assignments"]),
            "sample_routes": evac_routing_res["route_assignments"][:5]
        },
        "ndrf_deployment_summary": {
            "teams_deployed": ndrf_deployment_res["total_teams_deployed"],
            "personnel_deployed": ndrf_deployment_res["total_personnel_deployed"],
            "deployments": ndrf_deployment_res["deployments"]
        },
        "cost_penalty_analysis": cost_analysis_res
    }

    os.makedirs(os.path.dirname(SIMULATION_REPORT_PATH), exist_ok=True)
    with open(SIMULATION_REPORT_PATH, "w", encoding="utf-8") as f:
        json.dump(simulation_report, f, indent=2)

    logger.info(f"Saved 2019 Monsoon Simulation Report -> {SIMULATION_REPORT_PATH}")
    logger.info("2019 Bihar Monsoon Flood Simulation completed successfully!")

    return simulation_report


if __name__ == "__main__":
    report = run_2019_monsoon_simulation()
    print("\n" + "=" * 60)
    print(" 2019 BIHAR MONSOON FLOOD SIMULATION REPORT SUMMARY")
    print("=" * 60)
    print(f" - Peak Date Simulated:     {report['peak_flood_date_simulated']}")
    print(f" - Total Monsoon Records:   {report['total_monsoon_records_evaluated']:,d}")
    print(f" - Peak Date Grid Points:   {report['peak_date_records_evaluated']}")
    print(f" - Critical Risk Nodes:     {report['risk_classification_summary']['CRITICAL_count']}")
    print(f" - High Risk Nodes:         {report['risk_classification_summary']['HIGH_count']}")
    print(f" - Evacuees Assigned:       {report['evacuation_routing_summary']['total_evacuees_assigned']:,d}")
    print(f" - NDRF Personnel Deployed: {report['ndrf_deployment_summary']['personnel_deployed']}")
    print(f" - False Alarm Cost:        ${report['cost_penalty_analysis']['false_alarm_penalty_cost']:,}")
    print(f" - Missed Flood Cost:       ${report['cost_penalty_analysis']['missed_flood_penalty_cost']:,}")

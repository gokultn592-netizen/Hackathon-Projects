"""
Disaster Resource Allocation & Evacuation Routing Engine

Optimizes emergency response operations including:
1. Evacuation Route Assignment: Dijkstra's shortest path routing to nearest shelter with capacity.
2. NDRF Team Deployment: Hungarian optimal assignment (linear_sum_assignment) based on urgency and distance.
3. Village Priority Generation: Ranking villages by flood_probability * population_density / elevation.
4. False Alarm Cost Calculation: Operational cost analysis weighing false alarm penalties vs missed flood catastrophes.
"""

import os
import sys
import logging
from typing import Dict, List, Any, Tuple, Union, Optional
import numpy as np
import pandas as pd
import scipy.spatial as spatial
from scipy.optimize import linear_sum_assignment
import networkx as nx

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def haversine_distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculates Haversine distance in kilometers between two latitude/longitude points."""
    R = 6371.0
    dlat = np.radians(lat2 - lat1)
    dlon = np.radians(lon2 - lon1)
    a = np.sin(dlat / 2.0)**2 + np.cos(np.radians(lat1)) * np.cos(np.radians(lat2)) * np.sin(dlon / 2.0)**2
    c = 2.0 * np.arctan2(np.sqrt(a), np.sqrt(1.0 - a))
    return R * c


def build_road_network_graph(
    villages: List[Dict[str, Any]],
    shelters: List[Dict[str, Any]],
    ndrf_teams: Optional[List[Dict[str, Any]]] = None
) -> nx.Graph:
    """
    Builds a NetworkX weighted Graph connecting villages, relief shelters, and NDRF team bases.
    Edge weights represent physical road distance in kilometers.
    """
    G = nx.Graph()

    # Add village nodes
    for v in villages:
        v_id = str(v.get("village_id", v.get("id", "V_UNKNOWN")))
        G.add_node(v_id, node_type="village", lat=float(v.get("lat", 25.5)), lon=float(v.get("lon", 85.1)), name=v.get("name", v_id))

    # Add shelter nodes
    for s in shelters:
        s_id = str(s.get("shelter_id", s.get("id", "S_UNKNOWN")))
        G.add_node(s_id, node_type="shelter", lat=float(s.get("lat", 25.5)), lon=float(s.get("lon", 85.1)), name=s.get("name", s_id))

    # Add NDRF team nodes
    if ndrf_teams:
        for t in ndrf_teams:
            t_id = str(t.get("team_id", t.get("id", "T_UNKNOWN")))
            G.add_node(t_id, node_type="ndrf_team", lat=float(t.get("lat", 25.5)), lon=float(t.get("lon", 85.1)))

    # Connect nodes with weighted road edges
    nodes = list(G.nodes(data=True))
    for i in range(len(nodes)):
        n1_id, n1_data = nodes[i]
        for j in range(i + 1, len(nodes)):
            n2_id, n2_data = nodes[j]

            dist_km = haversine_distance_km(
                n1_data["lat"], n1_data["lon"],
                n2_data["lat"], n2_data["lon"]
            )
            # Only connect nodes within reasonable road proximity (e.g., 50 km)
            if dist_km <= 50.0:
                G.add_edge(n1_id, n2_id, weight=round(dist_km, 2))

    # Ensure graph is connected (fallback edge if isolated)
    for n1_id, n1_data in nodes:
        if G.degree(n1_id) == 0:
            for n2_id, n2_data in nodes:
                if n1_id != n2_id:
                    d_km = haversine_distance_km(n1_data["lat"], n1_data["lon"], n2_data["lat"], n2_data["lon"])
                    G.add_edge(n1_id, n2_id, weight=round(d_km, 2))
                    break

    return G


def assign_evacuation_routes(
    villages: List[Dict[str, Any]],
    shelters: List[Dict[str, Any]],
    road_graph: Optional[nx.Graph] = None
) -> Dict[str, Any]:
    """
    Assigns evacuation routes from at-risk villages to relief shelters using Dijkstra's
    shortest path algorithm, enforcing shelter capacity constraints.

    Parameters
    ----------
    villages : List[Dict[str, Any]]
        List of village dicts with keys: village_id, flood_probability, population, lat, lon.
    shelters : List[Dict[str, Any]]
        List of shelter dicts with keys: shelter_id, capacity, current_occupancy, lat, lon.
    road_graph : Optional[nx.Graph]
        Pre-built NetworkX road graph. Built automatically if None.

    Returns
    -------
    Dict[str, Any]
        Dictionary containing assigned evacuation routes and shelter occupancy status.
    """
    logger.info("Running Dijkstra Evacuation Route Assignment engine...")

    if road_graph is None:
        road_graph = build_road_network_graph(villages, shelters)

    # Copy shelter capacities
    shelter_state = []
    for s in shelters:
        s_id = str(s.get("shelter_id", s.get("id", "S_UNKNOWN")))
        cap = int(s.get("capacity", 1000))
        occ = int(s.get("current_occupancy", 0))
        rem = max(0, cap - occ)
        shelter_state.append({
            "shelter_id": s_id,
            "name": s.get("name", s_id),
            "capacity": cap,
            "current_occupancy": occ,
            "remaining_capacity": rem,
            "lat": float(s.get("lat", 25.5)),
            "lon": float(s.get("lon", 85.1))
        })

    # Sort at-risk villages by flood probability descending
    sorted_villages = sorted(
        villages,
        key=lambda v: float(v.get("flood_probability", 0.0)),
        reverse=True
    )

    route_assignments = []
    total_evacuated = 0

    for v in sorted_villages:
        v_id = str(v.get("village_id", v.get("id", "V_UNKNOWN")))
        v_pop = int(v.get("population", 500))
        f_prob = float(v.get("flood_probability", 0.0))

        if f_prob < 0.20:
            continue  # Low risk, no mandatory evacuation needed

        # Find nearest available shelter with capacity using Dijkstra shortest path
        best_shelter = None
        min_dist_km = float("inf")
        best_path = []

        for s in shelter_state:
            if s["remaining_capacity"] <= 0:
                continue

            s_id = s["shelter_id"]
            try:
                if nx.has_path(road_graph, v_id, s_id):
                    path = nx.dijkstra_path(road_graph, v_id, s_id, weight="weight")
                    dist_km = nx.dijkstra_path_length(road_graph, v_id, s_id, weight="weight")
                else:
                    dist_km = haversine_distance_km(v.get("lat", 25.5), v.get("lon", 85.1), s["lat"], s["lon"])
                    path = [v_id, s_id]

                if dist_km < min_dist_km:
                    min_dist_km = dist_km
                    best_shelter = s
                    best_path = path
            except Exception as e:
                logger.warning(f"Pathfinding error between {v_id} and {s_id}: {e}")

        if best_shelter is not None:
            assign_pop = min(v_pop, best_shelter["remaining_capacity"])
            best_shelter["current_occupancy"] += assign_pop
            best_shelter["remaining_capacity"] -= assign_pop
            total_evacuated += assign_pop

            route_assignments.append({
                "village_id": v_id,
                "village_name": v.get("name", v_id),
                "assigned_shelter_id": best_shelter["shelter_id"],
                "assigned_shelter_name": best_shelter["name"],
                "evacuated_population": assign_pop,
                "distance_km": round(min_dist_km, 2),
                "evacuation_path": best_path,
                "fully_evacuated": assign_pop == v_pop
            })
        else:
            logger.warning(f"No available shelter capacity for village {v_id} (Pop: {v_pop}).")
            route_assignments.append({
                "village_id": v_id,
                "village_name": v.get("name", v_id),
                "assigned_shelter_id": "NONE_AVAILABLE",
                "assigned_shelter_name": "No Available Shelter Capacity",
                "evacuated_population": 0,
                "distance_km": 0.0,
                "evacuation_path": [],
                "fully_evacuated": False
            })

    logger.info(f"Assigned evacuation routes for {len(route_assignments)} villages (Total Evacuees: {total_evacuated}).")
    return {
        "status": "SUCCESS",
        "total_evacuees_assigned": total_evacuated,
        "route_assignments": route_assignments,
        "shelter_status": shelter_state
    }


def deploy_ndrf_teams(
    villages: List[Dict[str, Any]],
    ndrf_teams: List[Dict[str, Any]],
    road_graph: Optional[nx.Graph] = None
) -> Dict[str, Any]:
    """
    Deploys NDRF emergency response teams to at-risk villages using the Hungarian algorithm
    (SciPy linear_sum_assignment) based on urgency score and travel distance.

    Urgency = (population * flood_probability) / max(1.0, distance_to_river)
    Cost Matrix C[t, v] = distance(t, v) / (urgency_v + 1e-4)

    Parameters
    ----------
    villages : List[Dict[str, Any]]
        List of at-risk village dicts.
    ndrf_teams : List[Dict[str, Any]]
        List of NDRF team dicts with keys: team_id, lat, lon, team_size, status.
    road_graph : Optional[nx.Graph]
        Pre-built road network graph.

    Returns
    -------
    Dict[str, Any]
        Optimal team-to-village deployment matching.
    """
    logger.info("Executing Hungarian Algorithm (linear_sum_assignment) for NDRF Team Deployment...")

    avail_teams = [t for t in ndrf_teams if t.get("status", "AVAILABLE") == "AVAILABLE"]
    if not avail_teams:
        avail_teams = ndrf_teams  # Fallback to all teams if none marked AVAILABLE

    if not avail_teams or not villages:
        return {"status": "NO_TEAMS_OR_VILLAGES", "deployments": []}

    n_teams = len(avail_teams)
    n_villages = len(villages)

    # Compute urgency scores for each village
    urgencies = []
    for v in villages:
        pop = float(v.get("population", 500))
        prob = float(v.get("flood_probability", 0.1))
        dist_riv = max(0.5, float(v.get("distance_to_river", 2.0)))
        urgency = (pop * prob) / dist_riv
        urgencies.append(max(0.1, urgency))

    # Construct Cost Matrix (Teams x Villages)
    cost_matrix = np.zeros((n_teams, n_villages), dtype=float)

    for i, t in enumerate(avail_teams):
        t_lat, t_lon = float(t.get("lat", 25.5)), float(t.get("lon", 85.1))
        for j, v in enumerate(villages):
            v_lat, v_lon = float(v.get("lat", 25.5)), float(v.get("lon", 85.1))
            dist_km = haversine_distance_km(t_lat, t_lon, v_lat, v_lon)
            # Cost penalty decreases with higher urgency and increases with distance
            cost_matrix[i, j] = dist_km / (urgencies[j] + 1e-4)

    # Apply Hungarian Algorithm for optimal assignment
    team_indices, village_indices = linear_sum_assignment(cost_matrix)

    deployments = []
    total_assigned_size = 0

    for t_idx, v_idx in zip(team_indices, village_indices):
        team = avail_teams[t_idx]
        village = villages[v_idx]

        t_id = str(team.get("team_id", team.get("id", f"NDRF_{t_idx+1}")))
        v_id = str(village.get("village_id", village.get("id", f"V_{v_idx+1}")))
        t_size = int(team.get("team_size", 25))

        dist_km = haversine_distance_km(
            float(team.get("lat", 25.5)), float(team.get("lon", 85.1)),
            float(village.get("lat", 25.5)), float(village.get("lon", 85.1))
        )

        deployments.append({
            "team_id": t_id,
            "team_size": t_size,
            "assigned_village_id": v_id,
            "assigned_village_name": village.get("name", v_id),
            "travel_distance_km": round(dist_km, 2),
            "urgency_score": round(urgencies[v_idx], 2),
            "flood_probability": float(village.get("flood_probability", 0.0))
        })
        total_assigned_size += t_size

    logger.info(f"Deployed {len(deployments)} NDRF teams (Total Personnel: {total_assigned_size}).")
    return {
        "status": "SUCCESS",
        "total_teams_deployed": len(deployments),
        "total_personnel_deployed": total_assigned_size,
        "deployments": deployments
    }


def generate_priority_list(villages: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Ranks at-risk villages by Priority Index formula:
    Priority Index = (flood_probability * population_density) / max(1.0, elevation)

    Parameters
    ----------
    villages : List[Dict[str, Any]]
        List of village dictionaries.

    Returns
    -------
    List[Dict[str, Any]]
        Ranked list of villages with priority indices, ranks, and urgency levels.
    """
    logger.info("Generating village risk priority ranking...")

    scored_villages = []
    for v in villages:
        v_id = str(v.get("village_id", v.get("id", "V_UNKNOWN")))
        prob = float(v.get("flood_probability", 0.0))
        pop_dens = float(v.get("population_density", v.get("population", 500) / 2.0))
        elev = float(v.get("elevation", 35.0))

        priority_index = (prob * pop_dens) / max(1.0, elev)

        if priority_index >= 15.0 or prob >= 0.75:
            tier = "P1_CRITICAL"
        elif priority_index >= 7.5 or prob >= 0.50:
            tier = "P2_HIGH"
        elif priority_index >= 2.5 or prob >= 0.25:
            tier = "P3_MEDIUM"
        else:
            tier = "P4_LOW"

        entry = dict(v)
        entry["village_id"] = v_id
        entry["priority_index"] = round(priority_index, 4)
        entry["urgency_tier"] = tier
        scored_villages.append(entry)

    # Sort descending by priority_index
    sorted_priority = sorted(scored_villages, key=lambda x: x["priority_index"], reverse=True)

    for rank, item in enumerate(sorted_priority, start=1):
        item["priority_rank"] = rank

    logger.info(f"Ranked {len(sorted_priority)} villages by priority index.")
    return sorted_priority


def calculate_false_alarm_cost(
    predictions: List[Dict[str, Any]],
    cost_false_alarm: float = 10000.0,
    cost_missed_flood: float = 250000.0
) -> Dict[str, Any]:
    """
    Calculates operational penalty cost weighing false alarm evacuations vs missed flood catastrophes.

    Parameters
    ----------
    predictions : List[Dict[str, Any]]
        List of dicts containing 'predicted' (0/1) and 'actual' (0/1) ground truth values.
    cost_false_alarm : float, default=10,000.0
        Cost penalty per False Alarm (False Positive).
    cost_missed_flood : float, default=250,000.0
        Cost penalty per Missed Flood (False Negative).

    Returns
    -------
    Dict[str, Any]
        Detailed cost breakdown analysis.
    """
    logger.info("Computing False Alarm vs Missed Flood operational cost analysis...")

    tp = sum(1 for p in predictions if p.get("predicted") == 1 and p.get("actual") == 1)
    fp = sum(1 for p in predictions if p.get("predicted") == 1 and p.get("actual") == 0)
    fn = sum(1 for p in predictions if p.get("predicted") == 0 and p.get("actual") == 1)
    tn = sum(1 for p in predictions if p.get("predicted") == 0 and p.get("actual") == 0)

    total_samples = len(predictions)
    false_alarm_penalty = fp * cost_false_alarm
    missed_flood_penalty = fn * cost_missed_flood
    total_penalty_cost = false_alarm_penalty + missed_flood_penalty

    # Avoid division by zero
    recall = tp / max(1, (tp + fn))
    precision = tp / max(1, (tp + fp))

    return {
        "status": "SUCCESS",
        "total_evaluated_villages": total_samples,
        "confusion_matrix": {
            "true_positives": tp,
            "false_positives": fp,
            "false_negatives": fn,
            "true_negatives": tn
        },
        "recall_score": round(recall, 4),
        "precision_score": round(precision, 4),
        "cost_per_false_alarm": cost_false_alarm,
        "cost_per_missed_flood": cost_missed_flood,
        "false_alarm_penalty_cost": false_alarm_penalty,
        "missed_flood_penalty_cost": missed_flood_penalty,
        "total_penalty_cost": total_penalty_cost,
        "recommendation": "Maintain low decision threshold (<0.35) because missed flood penalties outweigh false alarms by 25:1."
    }


class ResourceAllocator:
    """
    Disaster Resource Allocation & Dispatch Optimization Engine.
    Retains backwards compatibility for existing API endpoints and test suites.
    """

    def __init__(self):
        pass

    def assign_evacuation_routes(self, villages: List[Dict[str, Any]], shelters: List[Dict[str, Any]]) -> Dict[str, Any]:
        return assign_evacuation_routes(villages, shelters)

    def deploy_ndrf_teams(self, villages: List[Dict[str, Any]], ndrf_teams: List[Dict[str, Any]]) -> Dict[str, Any]:
        return deploy_ndrf_teams(villages, ndrf_teams)

    def generate_priority_list(self, villages: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        return generate_priority_list(villages)

    def calculate_false_alarm_cost(self, predictions: List[Dict[str, Any]]) -> Dict[str, Any]:
        return calculate_false_alarm_cost(predictions)

    def optimize_allocation(
        self,
        district_risk_scores: List[Dict[str, Any]],
        available_resources: Dict[str, int]
    ) -> Dict[str, Any]:
        """Legacy priority allocation interface."""
        logger.info(f"Optimizing emergency response assets across {len(district_risk_scores)} affected districts...")

        total_ndrf = available_resources.get("ndrf_teams", 50)
        total_boats = available_resources.get("rescue_boats", 100)
        total_medical = available_resources.get("medical_kits", 3000)
        total_shelter = available_resources.get("shelter_tents", 1500)

        sorted_districts = sorted(
            district_risk_scores,
            key=lambda d: d.get("risk_score", 0.0),
            reverse=True
        )

        total_risk_weight = sum(max(0.01, d.get("risk_score", 0.1)) for d in sorted_districts)

        allocations = []
        rem_ndrf, rem_boats, rem_medical, rem_shelter = total_ndrf, total_boats, total_medical, total_shelter

        for d in sorted_districts:
            district_id = d.get("district_id", "UNKNOWN")
            risk = d.get("risk_score", 0.0)
            population = d.get("population_estimate", 100000)

            weight = (risk * (population / 100000.0)) / max(0.01, total_risk_weight)

            if risk >= 0.70:
                priority = "P1_URGENT"
                ndrf_allocated = min(rem_ndrf, max(1, int(round(total_ndrf * weight * 1.5))))
                boats_allocated = min(rem_boats, max(2, int(round(total_boats * weight * 1.5))))
            elif risk >= 0.40:
                priority = "P2_HIGH"
                ndrf_allocated = min(rem_ndrf, max(0, int(round(total_ndrf * weight))))
                boats_allocated = min(rem_boats, max(0, int(round(total_boats * weight))))
            else:
                priority = "P3_MONITOR"
                ndrf_allocated = min(rem_ndrf, int(round(total_ndrf * weight * 0.5)))
                boats_allocated = min(rem_boats, int(round(total_boats * weight * 0.5)))

            medical_allocated = min(rem_medical, int(round(total_medical * weight)))
            shelter_allocated = min(rem_shelter, int(round(total_shelter * weight)))

            rem_ndrf -= ndrf_allocated
            rem_boats -= boats_allocated
            rem_medical -= medical_allocated
            rem_shelter -= shelter_allocated

            allocations.append({
                "district_id": district_id,
                "priority_level": priority,
                "risk_score": risk,
                "allocated_ndrf_teams": ndrf_allocated,
                "allocated_rescue_boats": boats_allocated,
                "allocated_medical_kits": medical_allocated,
                "allocated_shelter_tents": shelter_allocated,
                "evacuation_center_recommended": risk >= 0.60
            })

        return {
            "status": "OPTIMIZATION_SUCCESS",
            "total_districts_serviced": len(allocations),
            "unallocated_resources": {
                "ndrf_teams": max(0, rem_ndrf),
                "rescue_boats": max(0, rem_boats),
                "medical_kits": max(0, rem_medical),
                "shelter_tents": max(0, rem_shelter)
            },
            "district_allocations": allocations
        }


if __name__ == "__main__":
    print("Executing Disaster Resource Allocation & Evacuation Routing Engine...")

    sample_villages = [
        {"village_id": "V_Digha", "name": "Digha", "lat": 25.63, "lon": 85.10, "flood_probability": 0.85, "population": 3200, "population_density": 4500, "elevation": 32.0, "distance_to_river": 0.8},
        {"village_id": "V_Danapur", "name": "Danapur", "lat": 25.62, "lon": 85.04, "flood_probability": 0.72, "population": 4800, "population_density": 3800, "elevation": 36.0, "distance_to_river": 1.2},
        {"village_id": "V_Raghopur", "name": "Raghopur", "lat": 25.56, "lon": 85.32, "flood_probability": 0.92, "population": 2100, "population_density": 2200, "elevation": 28.0, "distance_to_river": 0.3},
    ]

    sample_shelters = [
        {"shelter_id": "S_Patna_High", "name": "Patna High School Shelter", "lat": 25.60, "lon": 85.12, "capacity": 5000, "current_occupancy": 1200},
        {"shelter_id": "S_Danapur_Coll", "name": "Danapur College Shelter", "lat": 25.61, "lon": 85.05, "capacity": 3000, "current_occupancy": 800},
    ]

    sample_teams = [
        {"team_id": "NDRF_Unit_01", "lat": 25.59, "lon": 85.13, "team_size": 30, "status": "AVAILABLE"},
        {"team_id": "NDRF_Unit_02", "lat": 25.58, "lon": 85.02, "team_size": 25, "status": "AVAILABLE"},
    ]

    # 1. Test Priority Ranking
    priority_res = generate_priority_list(sample_villages)
    print("\n1. Village Priority List:")
    for v in priority_res:
        print(f" - Rank {v['priority_rank']}: {v['name']} ({v['village_id']}) -> Priority Index: {v['priority_index']} ({v['urgency_tier']})")

    # 2. Test Dijkstra Evacuation Routing
    evac_res = assign_evacuation_routes(sample_villages, sample_shelters)
    print(f"\n2. Evacuation Routing (Evacuated: {evac_res['total_evacuees_assigned']}):")
    for r in evac_res["route_assignments"]:
        print(f" - {r['village_name']} -> {r['assigned_shelter_name']} (Distance: {r['distance_km']} km, Path: {' -> '.join(r['evacuation_path'])})")

    # 3. Test Hungarian NDRF Deployment
    deploy_res = deploy_ndrf_teams(sample_villages, sample_teams)
    print("\n3. NDRF Team Hungarian Deployment:")
    for d in deploy_res["deployments"]:
        print(f" - {d['team_id']} (Size: {d['team_size']}) -> {d['assigned_village_name']} (Distance: {d['travel_distance_km']} km)")

    # 4. Test False Alarm Cost Analysis
    preds = [
        {"predicted": 1, "actual": 1},
        {"predicted": 1, "actual": 1},
        {"predicted": 1, "actual": 0}, # FP
        {"predicted": 0, "actual": 1}, # FN
        {"predicted": 0, "actual": 0},
    ]
    cost_res = calculate_false_alarm_cost(preds)
    print("\n4. False Alarm vs Missed Flood Cost Analysis:")
    print(f" - False Alarm Penalty Cost: ${cost_res['false_alarm_penalty_cost']:,}")
    print(f" - Missed Flood Penalty Cost: ${cost_res['missed_flood_penalty_cost']:,}")
    print(f" - Total Penalty Cost:        ${cost_res['total_penalty_cost']:,}")

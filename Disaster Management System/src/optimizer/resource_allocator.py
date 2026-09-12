"""
Disaster Resource Allocation & Evacuation Routing Engine

Optimizes emergency response operations including:
1. Evacuation Route Assignment: Dijkstra's shortest path routing to nearest shelter with capacity.
2. FEMA/USACE Team Deployment: Hungarian optimal assignment (linear_sum_assignment) based on urgency and distance.
3. Community Priority Generation: Ranking communities by flood_probability * population_density / elevation.
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
    communities: List[Dict[str, Any]],
    shelters: List[Dict[str, Any]],
    fema_teams: Optional[List[Dict[str, Any]]] = None
) -> nx.Graph:
    """
    Builds a NetworkX weighted Graph connecting communities, relief shelters, and FEMA/USACE team bases.
    Edge weights represent physical road distance in kilometers.
    """
    G = nx.Graph()

    # Add county nodes
    for v in communities:
        v_id = str(v.get("county_id", v.get("id", "V_UNKNOWN")))
        G.add_node(v_id, node_type="county", lat=float(v.get("lat", 25.5)), lon=float(v.get("lon", 85.1)), name=v.get("name", v_id))

    # Add shelter nodes
    for s in shelters:
        s_id = str(s.get("shelter_id", s.get("id", "S_UNKNOWN")))
        G.add_node(s_id, node_type="shelter", lat=float(s.get("lat", 25.5)), lon=float(s.get("lon", 85.1)), name=s.get("name", s_id))

    # Add FEMA/USACE team nodes
    if fema_teams:
        for t in fema_teams:
            t_id = str(t.get("team_id", t.get("id", "T_UNKNOWN")))
            G.add_node(t_id, node_type="fema_team", lat=float(t.get("lat", 25.5)), lon=float(t.get("lon", 85.1)))

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
    communities: List[Dict[str, Any]],
    shelters: List[Dict[str, Any]],
    road_graph: Optional[nx.Graph] = None
) -> Dict[str, Any]:
    """
    Assigns evacuation routes from at-risk communities to relief shelters using Dijkstra's
    shortest path algorithm, enforcing shelter capacity constraints.

    Parameters
    ----------
    communities : List[Dict[str, Any]]
        List of county dicts with keys: county_id, flood_probability, population, lat, lon.
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
        road_graph = build_road_network_graph(communities, shelters)

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

    # Sort at-risk communities by flood probability descending
    sorted_communities = sorted(
        communities,
        key=lambda v: float(v.get("flood_probability", 0.0)),
        reverse=True
    )

    route_assignments = []
    total_evacuated = 0

    for v in sorted_communities:
        v_id = str(v.get("county_id", v.get("id", "V_UNKNOWN")))
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
                "county_id": v_id,
                "county_name": v.get("name", v_id),
                "assigned_shelter_id": best_shelter["shelter_id"],
                "assigned_shelter_name": best_shelter["name"],
                "evacuated_population": assign_pop,
                "distance_km": round(min_dist_km, 2),
                "evacuation_path": best_path,
                "fully_evacuated": assign_pop == v_pop
            })
        else:
            # Dynamically expand search radius (up to 150 km) to find out-of-county shelters
            expanded_shelters = [
                s for s in shelter_state
                if haversine_distance_km(
                    float(v.get("lat", 25.5)), float(v.get("lon", 85.1)),
                    float(s.get("lat", 25.5)), float(s.get("lon", 85.1))
                ) <= 150.0 and s["remaining_capacity"] > 0
            ]
            best_expanded = None
            min_dist_expanded = float("inf")
            best_path_expanded = []
            for s in expanded_shelters:
                s_id = s["shelter_id"]
                try:
                    if nx.has_path(road_graph, v_id, s_id):
                        path_exp = nx.dijkstra_path(road_graph, v_id, s_id, weight="weight")
                        dist_exp = nx.dijkstra_path_length(road_graph, v_id, s_id, weight="weight")
                    else:
                        dist_exp = haversine_distance_km(
                            float(v.get("lat", 25.5)), float(v.get("lon", 85.1)),
                            float(s.get("lat", 25.5)), float(s.get("lon", 85.1))
                        )
                        path_exp = [v_id, s_id]
                    if dist_exp < min_dist_expanded:
                        min_dist_expanded = dist_exp
                        best_expanded = s
                        best_path_expanded = path_exp
                except Exception as e:
                    logger.warning(f"Expanded path error {v_id}->{s_id}: {e}")
            if best_expanded is not None:
                assign_pop = min(v_pop, best_expanded["remaining_capacity"])
                best_expanded["current_occupancy"] += assign_pop
                best_expanded["remaining_capacity"] -= assign_pop
                total_evacuated += assign_pop
                route_assignments.append({
                    "county_id": v_id,
                    "county_name": v.get("name", v_id),
                    "assigned_shelter_id": best_expanded["shelter_id"],
                    "assigned_shelter_name": best_expanded["name"],
                    "evacuated_population": assign_pop,
                    "distance_km": round(min_dist_expanded, 2),
                    "evacuation_path": best_path_expanded,
                    "fully_evacuated": assign_pop == v_pop,
                    "expanded_radius": True,
                })
                logger.info(f"Expanded-radius evacuation assigned for {v_id} to {best_expanded['shelter_id']}.")
            else:
                logger.warning(f"No available shelter capacity for county {v_id} (Pop: {v_pop}) even at 150km radius.")
                route_assignments.append({
                    "county_id": v_id,
                    "county_name": v.get("name", v_id),
                    "assigned_shelter_id": "NONE_AVAILABLE",
                    "assigned_shelter_name": "No Available Shelter Capacity",
                    "evacuated_population": 0,
                    "distance_km": 0.0,
                    "evacuation_path": [],
                    "fully_evacuated": False,
                })

    logger.info(f"Assigned evacuation routes for {len(route_assignments)} communities (Total Evacuees: {total_evacuated}).")
    return {
        "status": "SUCCESS",
        "total_evacuees_assigned": total_evacuated,
        "route_assignments": route_assignments,
        "shelter_status": shelter_state
    }


def deploy_fema_teams(
    communities: List[Dict[str, Any]],
    fema_teams: List[Dict[str, Any]],
    road_graph: Optional[nx.Graph] = None
) -> Dict[str, Any]:
    """
    Deploys USACE / FEMA Emergency Response teams to at-risk communities using the Hungarian algorithm
    (SciPy linear_sum_assignment) based on urgency score and travel distance.

    Urgency = (population * flood_probability) / max(1.0, distance_to_river)
    Cost Matrix C[t, v] = distance(t, v) / (urgency_v + 1e-4)

    Parameters
    ----------
    communities : List[Dict[str, Any]]
        List of at-risk county dicts.
    fema_teams : List[Dict[str, Any]]
        List of FEMA/USACE team dicts with keys: team_id, lat, lon, team_size, status.
    road_graph : Optional[nx.Graph]
        Pre-built road network graph.

    Returns
    -------
    Dict[str, Any]
        Optimal team-to-county deployment matching.
    """
    logger.info("Executing Hungarian Algorithm (linear_sum_assignment) for FEMA/USACE Team Deployment...")

    avail_teams = [t for t in fema_teams if t.get("status", "AVAILABLE") == "AVAILABLE"]
    if not avail_teams:
        avail_teams = fema_teams  # Fallback to all teams if none marked AVAILABLE

    if not avail_teams or not communities:
        return {"status": "NO_TEAMS_OR_COUNTIES", "deployments": []}

    n_teams = len(avail_teams)
    n_communities = len(communities)

    # Compute urgency scores for each county
    urgencies = []
    for v in communities:
        pop = float(v.get("population", 500))
        prob = float(v.get("flood_probability", 0.1))
        dist_riv = max(0.5, float(v.get("distance_to_river", 2.0)))
        urgency = (pop * prob) / dist_riv
        urgencies.append(max(0.1, urgency))

    # Construct Cost Matrix (Teams x Communities)
    cost_matrix = np.zeros((n_teams, n_communities), dtype=float)

    for i, t in enumerate(avail_teams):
        t_lat, t_lon = float(t.get("lat", 25.5)), float(t.get("lon", 85.1))
        for j, v in enumerate(communities):
            v_lat, v_lon = float(v.get("lat", 25.5)), float(v.get("lon", 85.1))
            dist_km = haversine_distance_km(t_lat, t_lon, v_lat, v_lon)
            # Cost penalty decreases with higher urgency and increases with distance
            cost_matrix[i, j] = dist_km / (urgencies[j] + 1e-4)

    # Apply Hungarian Algorithm for optimal assignment
    team_indices, county_indices = linear_sum_assignment(cost_matrix)

    deployments = []
    total_assigned_size = 0

    for t_idx, v_idx in zip(team_indices, county_indices):
        team = avail_teams[t_idx]
        county = communities[v_idx]

        t_id = str(team.get("team_id", team.get("id", f"FEMA/USACE_{t_idx+1}")))
        v_id = str(county.get("county_id", county.get("id", f"V_{v_idx+1}")))
        t_size = int(team.get("team_size", 25))

        dist_km = haversine_distance_km(
            float(team.get("lat", 25.5)), float(team.get("lon", 85.1)),
            float(county.get("lat", 25.5)), float(county.get("lon", 85.1))
        )

        deployments.append({
            "team_id": t_id,
            "team_size": t_size,
            "assigned_county_id": v_id,
            "assigned_county_name": county.get("name", v_id),
            "travel_distance_km": round(dist_km, 2),
            "urgency_score": round(urgencies[v_idx], 2),
            "flood_probability": float(county.get("flood_probability", 0.0))
        })
        total_assigned_size += t_size

    logger.info(f"Deployed {len(deployments)} FEMA/USACE teams (Total Personnel: {total_assigned_size}).")
    return {
        "status": "SUCCESS",
        "total_teams_deployed": len(deployments),
        "total_personnel_deployed": total_assigned_size,
        "deployments": deployments
    }


def generate_priority_list(communities: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Ranks at-risk communities by Priority Index formula:
    Priority Index = (flood_probability * population_density) / max(1.0, elevation)

    Parameters
    ----------
    communities : List[Dict[str, Any]]
        List of county dictionaries.

    Returns
    -------
    List[Dict[str, Any]]
        Ranked list of communities with priority indices, ranks, and urgency levels.
    """
    logger.info("Generating county risk priority ranking...")

    scored_communities = []
    for v in communities:
        v_id = str(v.get("county_id", v.get("id", "V_UNKNOWN")))
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
        entry["county_id"] = v_id
        entry["priority_index"] = round(priority_index, 4)
        entry["urgency_tier"] = tier
        scored_communities.append(entry)

    # Sort descending by priority_index
    sorted_priority = sorted(scored_communities, key=lambda x: x["priority_index"], reverse=True)

    for rank, item in enumerate(sorted_priority, start=1):
        item["priority_rank"] = rank

    logger.info(f"Ranked {len(sorted_priority)} communities by priority index.")
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
        "total_evaluated_communities": total_samples,
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

    def assign_evacuation_routes(self, communities: List[Dict[str, Any]], shelters: List[Dict[str, Any]]) -> Dict[str, Any]:
        return assign_evacuation_routes(communities, shelters)

    def deploy_fema_teams(self, communities: List[Dict[str, Any]], fema_teams: List[Dict[str, Any]]) -> Dict[str, Any]:
        return deploy_fema_teams(communities, fema_teams)

    def generate_priority_list(self, communities: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        return generate_priority_list(communities)

    def calculate_false_alarm_cost(self, predictions: List[Dict[str, Any]], cost_false_alarm: float = 10000.0, cost_missed_flood: float = 250000.0) -> Dict[str, Any]:
        return calculate_false_alarm_cost(predictions, cost_false_alarm=cost_false_alarm, cost_missed_flood=cost_missed_flood)

    def optimize_allocation(
        self,
        district_risk_scores: List[Dict[str, Any]],
        available_resources: Dict[str, int]
    ) -> Dict[str, Any]:
        """Legacy priority allocation interface."""
        logger.info(f"Optimizing emergency response assets across {len(district_risk_scores)} affected districts...")

        cost_false_alarm = available_resources.get("cost_false_alarm", 10000.0)
        cost_missed_flood = available_resources.get("cost_missed_flood", 250000.0)
        total_fema_teams = available_resources.get("fema_teams", 50)
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
        rem_fema_teams, rem_boats, rem_medical, rem_shelter = total_fema_teams, total_boats, total_medical, total_shelter

        for d in sorted_districts:
            district_id = d.get("district_id", "UNKNOWN")
            risk = d.get("risk_score", 0.0)
            population = d.get("population_estimate", 100000)

            weight = (risk * (population / 100000.0)) / max(0.01, total_risk_weight)

            if risk >= 0.70:
                priority = "P1_URGENT"
                fema_teams_allocated = min(rem_fema_teams, max(1, int(round(total_fema_teams * weight * 1.5))))
                boats_allocated = min(rem_boats, max(2, int(round(total_boats * weight * 1.5))))
            elif risk >= 0.40:
                priority = "P2_HIGH"
                fema_teams_allocated = min(rem_fema_teams, max(0, int(round(total_fema_teams * weight))))
                boats_allocated = min(rem_boats, max(0, int(round(total_boats * weight))))
            else:
                priority = "P3_MONITOR"
                fema_teams_allocated = min(rem_fema_teams, int(round(total_fema_teams * weight * 0.5)))
                boats_allocated = min(rem_boats, int(round(total_boats * weight * 0.5)))

            medical_allocated = min(rem_medical, int(round(total_medical * weight)))
            shelter_allocated = min(rem_shelter, int(round(total_shelter * weight)))

            rem_fema_teams -= fema_teams_allocated
            rem_boats -= boats_allocated
            rem_medical -= medical_allocated
            rem_shelter -= shelter_allocated

            allocations.append({
                "district_id": district_id,
                "priority_level": priority,
                "risk_score": risk,
                "allocated_fema_teams": fema_teams_allocated,
                "allocated_rescue_boats": boats_allocated,
                "allocated_medical_kits": medical_allocated,
                "allocated_shelter_tents": shelter_allocated,
                "evacuation_center_recommended": risk >= 0.60
            })

        return {
            "status": "OPTIMIZATION_SUCCESS",
            "total_districts_serviced": len(allocations),
            "unallocated_resources": {
                "fema_teams": max(0, rem_fema_teams),
                "rescue_boats": max(0, rem_boats),
                "medical_kits": max(0, rem_medical),
                "shelter_tents": max(0, rem_shelter)
            },
            "district_allocations": allocations
        }


if __name__ == "__main__":
    print("Executing Disaster Resource Allocation & Evacuation Routing Engine...")

    sample_communities = [
        {"county_id": "V_Digha", "name": "Digha", "lat": 25.63, "lon": 85.10, "flood_probability": 0.85, "population": 3200, "population_density": 4500, "elevation": 32.0, "distance_to_river": 0.8},
        {"county_id": "V_Danapur", "name": "Danapur", "lat": 25.62, "lon": 85.04, "flood_probability": 0.72, "population": 4800, "population_density": 3800, "elevation": 36.0, "distance_to_river": 1.2},
        {"county_id": "V_Raghopur", "name": "Raghopur", "lat": 25.56, "lon": 85.32, "flood_probability": 0.92, "population": 2100, "population_density": 2200, "elevation": 28.0, "distance_to_river": 0.3},
    ]

    sample_shelters = [
        {"shelter_id": "S_Fargo_High", "name": "Fargo High School Shelter", "lat": 46.88, "lon": -96.79, "capacity": 5000, "current_occupancy": 1200},
        {"shelter_id": "S_GrandForks_Coll", "name": "Grand Forks College Shelter", "lat": 47.93, "lon": -97.03, "capacity": 3000, "current_occupancy": 800},
    ]

    sample_teams = [
        {"team_id": "FEMA/USACE_Unit_01", "lat": 25.59, "lon": 85.13, "team_size": 30, "status": "AVAILABLE"},
        {"team_id": "FEMA/USACE_Unit_02", "lat": 25.58, "lon": 85.02, "team_size": 25, "status": "AVAILABLE"},
    ]

    # 1. Test Priority Ranking
    priority_res = generate_priority_list(sample_communities)
    print("\n1. Community Priority List:")
    for v in priority_res:
        print(f" - Rank {v['priority_rank']}: {v['name']} ({v['county_id']}) -> Priority Index: {v['priority_index']} ({v['urgency_tier']})")

    # 2. Test Dijkstra Evacuation Routing
    evac_res = assign_evacuation_routes(sample_communities, sample_shelters)
    print(f"\n2. Evacuation Routing (Evacuated: {evac_res['total_evacuees_assigned']}):")
    for r in evac_res["route_assignments"]:
        print(f" - {r['county_name']} -> {r['assigned_shelter_name']} (Distance: {r['distance_km']} km, Path: {' -> '.join(r['evacuation_path'])})")

    # 3. Test Hungarian FEMA/USACE Deployment
    deploy_res = deploy_fema_teams(sample_communities, sample_teams)
    print("\n3. FEMA/USACE Team Hungarian Deployment:")
    for d in deploy_res["deployments"]:
        print(f" - {d['team_id']} (Size: {d['team_size']}) -> {d['assigned_county_name']} (Distance: {d['travel_distance_km']} km)")

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

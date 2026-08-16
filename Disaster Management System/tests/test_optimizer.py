"""
Unit Tests for Disaster Resource Allocator & Evacuation Routing Engine
"""
import os
import sys
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from src.optimizer import (
    ResourceAllocator,
    assign_evacuation_routes,
    deploy_ndrf_teams,
    generate_priority_list,
    calculate_false_alarm_cost
)


class TestResourceAllocator(unittest.TestCase):

    def setUp(self):
        self.villages = [
            {"village_id": "V_01", "name": "Village_Alpha", "lat": 25.63, "lon": 85.10, "flood_probability": 0.88, "population": 2500, "population_density": 4000, "elevation": 30.0, "distance_to_river": 0.5},
            {"village_id": "V_02", "name": "Village_Beta", "lat": 25.61, "lon": 85.05, "flood_probability": 0.65, "population": 1800, "population_density": 2500, "elevation": 40.0, "distance_to_river": 1.5},
        ]
        self.shelters = [
            {"shelter_id": "S_01", "name": "Shelter_One", "lat": 25.60, "lon": 85.12, "capacity": 3000, "current_occupancy": 500},
        ]
        self.teams = [
            {"team_id": "T_01", "lat": 25.59, "lon": 85.13, "team_size": 25, "status": "AVAILABLE"},
        ]

    def test_generate_priority_list(self):
        priority_res = generate_priority_list(self.villages)
        self.assertEqual(len(priority_res), 2)
        self.assertIn("priority_index", priority_res[0])
        self.assertEqual(priority_res[0]["priority_rank"], 1)

    def test_assign_evacuation_routes(self):
        evac_res = assign_evacuation_routes(self.villages, self.shelters)
        self.assertEqual(evac_res["status"], "SUCCESS")
        self.assertGreater(evac_res["total_evacuees_assigned"], 0)
        self.assertIn("route_assignments", evac_res)

    def test_deploy_ndrf_teams(self):
        deploy_res = deploy_ndrf_teams(self.villages, self.teams)
        self.assertEqual(deploy_res["status"], "SUCCESS")
        self.assertEqual(len(deploy_res["deployments"]), 1)

    def test_calculate_false_alarm_cost(self):
        preds = [
            {"predicted": 1, "actual": 1},
            {"predicted": 1, "actual": 0},
            {"predicted": 0, "actual": 1},
        ]
        cost_res = calculate_false_alarm_cost(preds)
        self.assertEqual(cost_res["status"], "SUCCESS")
        self.assertEqual(cost_res["false_alarm_penalty_cost"], 10000.0)
        self.assertEqual(cost_res["missed_flood_penalty_cost"], 250000.0)


if __name__ == "__main__":
    unittest.main()

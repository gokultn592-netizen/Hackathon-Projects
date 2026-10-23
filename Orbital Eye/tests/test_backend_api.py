"""
Test Suite: Backend HTTP API (FastAPI) — routes, validation and fault tolerance.

The API is exercised in-process through `httpx.ASGITransport`, so the real
routing, validation, dependency and serialisation stack runs without needing
a separate server. A live Oracle pool is provided by the `db_pool` fixture
for the routes that query the database.

Verified requirements:
1. `/api/health` and `/api/db-test` report a healthy, genuinely connected system.
2. `/api/satellites/positions` returns SGP4-propagated positions with
   physically plausible values and honours the `limit` / `dataset` parameters.
3. Out-of-range `limit` values are rejected with a 422 by FastAPI validation.
4. `/api/encounters` returns joined, ordered encounter pairs.
5. `/api/settings` exposes and updates the developer settings, rejecting
   out-of-range values.
6. The bridge endpoints expose live UI state and captured frontend errors.
7. `/api/system/health-checker` reports HEALTHY with a real-data certificate.
8. Fault injection degrades the system to DEGRADED when the database is cut,
   and restores it to HEALTHY afterwards.
9. The root path redirects to the Swagger documentation, and the OpenAPI
   schema lists every route the frontend depends on.
"""

import pytest

pytestmark = pytest.mark.db


# ---------------------------------------------------------------------------
# 1. Basic health
# ---------------------------------------------------------------------------

async def test_health_endpoint(api_client):
    """The liveness probe must report the service as ok."""
    res = await api_client.get("/api/health")
    assert res.status_code == 200

    body = res.json()
    assert body["status"] == "ok"
    assert body["service"] == "OrbitalEye DBMS Edition API"
    assert body["real_data_guaranteed"] is True
    assert body["detailed_checker"] == "/api/system/health-checker"


async def test_db_test_endpoint_reports_live_connection(api_client_with_db):
    """`/api/db-test` must report the real container and schema user."""
    res = await api_client_with_db.get("/api/db-test")
    assert res.status_code == 200

    body = res.json()
    assert body["container"].upper() == "XEPDB1"
    assert body["user"].upper() == "ORBITAL_EYE"


async def test_root_redirects_to_swagger(api_client):
    """The root URL must land the user on the interactive API docs."""
    res = await api_client.get("/", follow_redirects=False)
    assert res.status_code in (301, 302, 307, 308)
    assert res.headers["location"] == "/docs"


async def test_openapi_schema_lists_every_route(api_client):
    """The published schema must contain every route the frontend calls."""
    res = await api_client.get("/openapi.json")
    assert res.status_code == 200

    paths = res.json()["paths"]
    for route in (
        "/api/health",
        "/api/db-test",
        "/api/encounters",
        "/api/settings",
        "/api/satellites/positions",
        "/api/bridge/state",
        "/api/bridge/errors",
        "/api/system/health-checker",
        "/api/system/fault-injection",
    ):
        assert route in paths, f"Route {route} is missing from the OpenAPI schema"


# ---------------------------------------------------------------------------
# 2. Satellite positions
# ---------------------------------------------------------------------------

async def test_positions_returns_propagated_satellites(api_client_with_db):
    """
    The endpoint must return real SGP4-propagated positions: a non-empty list
    whose entries are physically plausible for a low Earth orbit.
    """
    res = await api_client_with_db.get(
        "/api/satellites/positions", params={"dataset": "REALTIME", "limit": 10}
    )
    assert res.status_code == 200

    positions = res.json()
    assert isinstance(positions, list)
    assert positions, "Expected satellite positions for the REALTIME dataset"
    assert len(positions) <= 10

    for pos in positions:
        assert set(pos.keys()) >= {
            "norad_id", "name", "x", "y", "z",
            "lat_deg", "lon_deg", "alt_km", "velocity_kms",
            "inclination_deg", "dataset_tag", "risk_category",
        }

        # Geodetic sanity: latitude and longitude must be real angles.
        assert -90.0 <= pos["lat_deg"] <= 90.0
        assert -180.0 <= pos["lon_deg"] <= 180.0

        # LEO orbital velocity band (7.0 - 8.5 km/s).
        assert 7.0 <= pos["velocity_kms"] <= 8.5, (
            f"{pos['name']} has an implausible velocity of {pos['velocity_kms']} km/s"
        )

        # LEO altitude band (150 - 2500 km).
        assert 150.0 <= pos["alt_km"] <= 2500.0, (
            f"{pos['name']} has an implausible altitude of {pos['alt_km']} km"
        )

        # The scene radius is Earth radius = 1.0 unit, so the position vector
        # must sit just outside the unit sphere.
        radius = (pos["x"] ** 2 + pos["y"] ** 2 + pos["z"] ** 2) ** 0.5
        assert 1.0 <= radius <= 1.4, f"{pos['name']} is at scene radius {radius}"

        assert pos["dataset_tag"] == "REALTIME"
        assert pos["risk_category"] in {"CRITICAL", "CAUTION", "NOMINAL"}


async def test_positions_accident_dataset_is_available(api_client_with_db):
    """The historical accident dataset must be queryable too."""
    res = await api_client_with_db.get(
        "/api/satellites/positions", params={"dataset": "ACCIDENT", "limit": 10}
    )
    assert res.status_code == 200

    positions = res.json()
    assert positions, "Expected satellites for the ACCIDENT dataset"
    assert all(p["dataset_tag"] == "ACCIDENT" for p in positions)


@pytest.mark.parametrize("bad_limit", [0, -1, 1001, 5000])
async def test_positions_rejects_out_of_range_limit(api_client, bad_limit):
    """FastAPI validation must reject a limit outside 1..1000."""
    res = await api_client.get(
        "/api/satellites/positions", params={"dataset": "REALTIME", "limit": bad_limit}
    )
    assert res.status_code == 422, f"limit={bad_limit} should have been rejected"


async def test_positions_accepts_boundary_limits(api_client_with_db):
    """The documented boundary values must be accepted."""
    for limit in (1, 1000):
        res = await api_client_with_db.get(
            "/api/satellites/positions", params={"dataset": "REALTIME", "limit": limit}
        )
        assert res.status_code == 200, f"limit={limit} should have been accepted"


# ---------------------------------------------------------------------------
# 3. Encounters
# ---------------------------------------------------------------------------

async def test_encounters_returns_joined_pairs(api_client_with_db):
    """
    The encounter query JOINs `encounter_pairs` to `satellites` twice, so the
    names must be resolved and the rows ordered by ascending miss distance.
    """
    res = await api_client_with_db.get(
        "/api/encounters", params={"dataset": "REALTIME", "limit": 20}
    )
    assert res.status_code == 200

    encounters = res.json()
    assert isinstance(encounters, list)
    assert encounters, "Expected encounter pairs for the REALTIME dataset"
    assert len(encounters) <= 20

    previous_distance = None
    for enc in encounters:
        assert set(enc.keys()) >= {
            "pair_id", "sat_a_name", "sat_b_name",
            "miss_distance_km", "rel_velocity_kms", "tca_utc", "collision_prob",
        }
        # The JOIN must have resolved real satellite names, never a null.
        assert enc["sat_a_name"]
        assert enc["sat_b_name"]
        assert enc["sat_a_name"] != enc["sat_b_name"]
        assert enc["miss_distance_km"] >= 0
        assert 0.0 <= enc["collision_prob"] <= 1.0
        assert enc["tca_utc"], "TCA timestamp must be present"

        if previous_distance is not None:
            assert enc["miss_distance_km"] >= previous_distance, (
                "Encounters must be ordered by ascending miss distance"
            )
        previous_distance = enc["miss_distance_km"]


@pytest.mark.parametrize("bad_limit", [0, -5, 1001])
async def test_encounters_rejects_out_of_range_limit(api_client, bad_limit):
    """The encounters limit must be validated exactly like the positions limit."""
    res = await api_client.get(
        "/api/encounters", params={"dataset": "REALTIME", "limit": bad_limit}
    )
    assert res.status_code == 422


async def test_encounters_accident_dataset_returns_the_collision_pair(api_client_with_db):
    """The accident dataset holds the historical collision, which must surface."""
    res = await api_client_with_db.get(
        "/api/encounters", params={"dataset": "ACCIDENT", "limit": 10}
    )
    assert res.status_code == 200

    encounters = res.json()
    assert encounters, "Expected the accident encounter pair"
    assert len(encounters) == 1


# ---------------------------------------------------------------------------
# 4. Settings
# ---------------------------------------------------------------------------

async def test_settings_returns_the_active_configuration(api_client):
    """The settings endpoint must expose the developer configuration."""
    res = await api_client.get("/api/settings")
    assert res.status_code == 200

    body = res.json()
    assert set(body.keys()) == {
        "satellite_limit", "speed_multiplier", "is_realtime", "refresh_interval_sec",
    }
    assert 1 <= body["satellite_limit"] <= 1000
    assert 0.01 <= body["speed_multiplier"] <= 5000.0
    assert 1 <= body["refresh_interval_sec"] <= 120
    assert isinstance(body["is_realtime"], bool)


async def test_settings_update_is_applied_and_persisted(api_client):
    """
    A valid update must be applied to the in-memory state and written to
    `backend/settings.json`, and the previous value must be restored.
    """
    import json
    import os

    settings_file = os.path.join(
        os.path.abspath(os.path.join(os.path.dirname(__file__), "..")),
        "backend",
        "settings.json",
    )

    original = await api_client.get("/api/settings")
    original_body = original.json()

    res = await api_client.put(
        "/api/settings", json={"satellite_limit": 42, "speed_multiplier": 2.5}
    )
    assert res.status_code == 200

    updated = res.json()
    assert updated["satellite_limit"] == 42
    assert updated["speed_multiplier"] == 2.5

    # The change must be readable back through GET ...
    readback = await api_client.get("/api/settings")
    assert readback.json()["satellite_limit"] == 42

    # ... and persisted to disk.
    if os.path.exists(settings_file):
        with open(settings_file, "r", encoding="utf-8") as f:
            assert json.load(f)["satellite_limit"] == 42

    # Restore the original configuration so the suite leaves no side effects.
    restore = await api_client.put(
        "/api/settings",
        json={
            "satellite_limit": original_body["satellite_limit"],
            "speed_multiplier": original_body["speed_multiplier"],
            "is_realtime": original_body["is_realtime"],
            "refresh_interval_sec": original_body["refresh_interval_sec"],
        },
    )
    assert restore.status_code == 200
    assert restore.json()["satellite_limit"] == original_body["satellite_limit"]


@pytest.mark.parametrize(
    "payload",
    [
        {"satellite_limit": 0},
        {"satellite_limit": 1001},
        {"speed_multiplier": 0.0},
        {"speed_multiplier": 5000.1},
        {"refresh_interval_sec": 0},
        {"refresh_interval_sec": 121},
    ],
)
async def test_settings_rejects_out_of_range_values(api_client, payload):
    """Out-of-range settings must be rejected with a 422."""
    res = await api_client.put("/api/settings", json=payload)
    assert res.status_code == 422


# ---------------------------------------------------------------------------
# 5. MCP bridge
# ---------------------------------------------------------------------------

async def test_bridge_state_reports_the_live_app_snapshot(api_client):
    """The bridge must expose a state snapshot even with no browser attached."""
    res = await api_client.get("/api/bridge/state")
    assert res.status_code == 200

    body = res.json()
    assert body["ok"] is True
    assert isinstance(body["active_clients"], int)
    assert isinstance(body["recent_error_count"], int)
    assert "state" in body
    assert "dataset" in body["state"]


async def test_bridge_errors_endpoint_returns_the_error_buffer(api_client):
    """The error buffer endpoint must return the captured frontend errors."""
    res = await api_client.get("/api/bridge/errors")
    assert res.status_code == 200

    body = res.json()
    assert body["ok"] is True
    assert isinstance(body["count"], int)
    assert isinstance(body["errors"], list)
    assert body["count"] == len(body["errors"])


async def test_bridge_command_without_clients_returns_503(api_client):
    """
    With no browser connected the command must fail with a 503 and a helpful
    message, rather than silently pretending the command was delivered.
    """
    res = await api_client.post(
        "/api/bridge/command", json={"action": "SET_LIMIT", "payload": {"limit": 50}}
    )
    assert res.status_code == 503
    assert "client" in res.json()["detail"].lower()


async def test_bridge_clear_errors_empties_the_buffer(api_client):
    """Clearing the error buffer must reset the counter to zero."""
    res = await api_client.post("/api/bridge/clear-errors")
    assert res.status_code == 200
    assert res.json()["ok"] is True

    after = await api_client.get("/api/bridge/errors")
    assert after.json()["count"] == 0


# ---------------------------------------------------------------------------
# 6. Health checker
# ---------------------------------------------------------------------------

async def test_health_checker_reports_healthy_system(api_client_with_db):
    """With the database connected the probe must report HEALTHY."""
    res = await api_client_with_db.get("/api/system/health-checker")
    assert res.status_code == 200

    body = res.json()
    assert body["overall_status"] == "HEALTHY"
    assert body["services"]["backend"]["status"] == "ONLINE"
    assert body["services"]["database"]["status"] == "CONNECTED"
    assert body["services"]["database"]["total_database_records"] > 0
    assert body["services"]["physics_engine"]["physics_pass"] is True
    assert body["authenticity_certificate"]["guaranteed_real_data"] is True
    assert "PASSED" in body["authenticity_certificate"]["anti_mock_audit"]
    assert body["authenticity_certificate"]["mock_data_detected"] is False
    assert body["authenticity_certificate"]["cryptographic_verification_token"]


async def test_health_checker_counts_match_the_database(api_client_with_db):
    """The reported per-table counts must agree with the live database."""
    import db as db_module

    res = await api_client_with_db.get("/api/system/health-checker")
    counts = res.json()["services"]["database"]["live_table_counts"]

    async with db_module.get_db_connection() as conn:
        async with conn.cursor() as cursor:
            await cursor.execute("SELECT COUNT(*) FROM satellites")
            expected = int((await cursor.fetchone())[0])

    assert counts["satellites"] == expected


# ---------------------------------------------------------------------------
# 7. Fault injection
# ---------------------------------------------------------------------------

async def test_fault_injection_cut_then_restore(api_client_with_db):
    """
    Cutting the database must degrade the system to DEGRADED/OFFLINE and
    never claim a real-data guarantee; restoring it must return the system
    to HEALTHY.
    """
    # --- status starts clean -------------------------------------------
    status_res = await api_client_with_db.get("/api/system/fault-injection")
    assert status_res.status_code == 200
    assert status_res.json()["database_cut"] is False

    try:
        # --- cut --------------------------------------------------------
        cut = await api_client_with_db.post(
            "/api/system/fault-injection?service=database&action=cut"
        )
        assert cut.status_code == 200
        assert cut.json()["is_cut"] is True

        degraded = await api_client_with_db.get("/api/system/health-checker")
        assert degraded.status_code == 200
        body = degraded.json()

        assert body["overall_status"] == "DEGRADED"
        assert body["services"]["database"]["status"] == "OFFLINE"
        assert body["services"]["database"]["status"] != "CONNECTED"
        assert body["authenticity_certificate"]["guaranteed_real_data"] is False
        assert "DEGRADED" in body["authenticity_certificate"]["anti_mock_audit"]
        assert "WARNING" in body["authenticity_certificate"]["assurance_statement"]

        # The cut flag must be visible through the status endpoint too.
        during = await api_client_with_db.get("/api/system/fault-injection")
        assert during.json()["database_cut"] is True
    finally:
        # --- restore (always, so a failed assertion cannot leave the
        #     application in a severed state) -----------------------------
        restore = await api_client_with_db.post(
            "/api/system/fault-injection?service=database&action=restore"
        )
        assert restore.status_code == 200
        assert restore.json()["is_cut"] is False

    recovered = await api_client_with_db.get("/api/system/health-checker")
    assert recovered.status_code == 200
    assert recovered.json()["overall_status"] == "HEALTHY"
    assert recovered.json()["services"]["database"]["status"] == "CONNECTED"
    assert recovered.json()["authenticity_certificate"]["guaranteed_real_data"] is True


async def test_fault_injection_rejects_an_unknown_service(api_client):
    """An unknown service name must be rejected with a 400."""
    res = await api_client.post(
        "/api/system/fault-injection?service=quantum&action=cut"
    )
    assert res.status_code == 400
    assert "database" in res.json()["detail"]


async def test_fault_injection_physics_sever_keeps_database_connected(api_client_with_db):
    """
    Severing the physics engine must degrade the system without falsely
    reporting the database as offline.
    """
    try:
        cut = await api_client_with_db.post(
            "/api/system/fault-injection?service=physics&action=cut"
        )
        assert cut.status_code == 200
        assert cut.json()["is_cut"] is True

        body = (await api_client_with_db.get("/api/system/health-checker")).json()
        assert body["overall_status"] == "DEGRADED"
        assert body["services"]["physics_engine"]["status"] == "SEVERED"
        assert body["services"]["database"]["status"] == "CONNECTED"
    finally:
        await api_client_with_db.post(
            "/api/system/fault-injection?service=physics&action=restore"
        )


if __name__ == "__main__":
    pytest.main(["-v", __file__])

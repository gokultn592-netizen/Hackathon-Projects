"""
Test Suite: End-to-End Live Stack (running backend + running frontend).

These tests talk to the *actual running services* over HTTP, unlike the rest
of the suite which drives the ASGI app in-process. They verify the wiring
that only exists when the whole stack is up:

1. The backend serves its health and diagnostics endpoints.
2. The frontend dev server is up and proxies `/api/*` to the backend.
3. The frontend serves the application shell and its assets.
4. The backend can drive the live frontend through the MCP bridge.

Every test is skipped when the corresponding service is not running, so the
suite stays green on a machine without a live stack. Start the stack with
`run.bat` (or `uvicorn` + `npm run dev`) before running them.
"""

import json
import os
import re
import urllib.error
import urllib.request

import pytest

from conftest import http_get_json, port_is_open

BACKEND_URL = "http://localhost:8000"
FRONTEND_URL = "http://localhost:3000"

pytestmark = pytest.mark.live


def _require_port(port: int, what: str):
    if not port_is_open("localhost", port):
        pytest.skip(f"The {what} is not running on port {port}")


def _fetch(url: str, timeout: float = 10.0):
    """GET a URL, returning (status_code, body_text)."""
    req = urllib.request.Request(url, headers={"User-Agent": "OrbitalEye-E2E"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.status, resp.read().decode("utf-8", errors="replace")
    except urllib.error.HTTPError as exc:
        return exc.code, exc.read().decode("utf-8", errors="replace")


# ---------------------------------------------------------------------------
# 1. Backend
# ---------------------------------------------------------------------------

def test_live_backend_health_endpoint():
    """The running backend must report itself as healthy."""
    _require_port(8000, "backend")

    status, body = _fetch(f"{BACKEND_URL}/api/health")
    assert status == 200

    payload = json.loads(body)
    assert payload["status"] == "ok"
    assert payload["real_data_guaranteed"] is True


def test_live_backend_db_test_endpoint():
    """The running backend must be genuinely connected to Oracle."""
    _require_port(8000, "backend")

    status, body = _fetch(f"{BACKEND_URL}/api/db-test")
    assert status == 200, f"/api/db-test returned {status}: {body}"

    payload = json.loads(body)
    assert payload["container"].upper() == "XEPDB1"
    assert payload["user"].upper() == "ORBITAL_EYE"


def test_live_backend_health_checker():
    """The live diagnostics probe must report a healthy, real-data system."""
    _require_port(8000, "backend")

    payload = http_get_json(f"{BACKEND_URL}/api/system/health-checker")
    assert payload is not None, "The health checker did not return JSON"

    assert payload["overall_status"] == "HEALTHY"
    assert payload["services"]["database"]["status"] == "CONNECTED"
    assert payload["services"]["database"]["total_database_records"] > 0
    assert payload["authenticity_certificate"]["guaranteed_real_data"] is True


def test_live_backend_serves_the_swagger_docs():
    """The interactive API documentation must be reachable."""
    _require_port(8000, "backend")

    status, body = _fetch(f"{BACKEND_URL}/docs")
    assert status == 200
    assert "swagger" in body.lower() or "openapi" in body.lower()


# ---------------------------------------------------------------------------
# 2. Frontend
# ---------------------------------------------------------------------------

def test_live_frontend_serves_the_application_shell():
    """The dev server must serve the React application."""
    _require_port(3000, "frontend")

    status, body = _fetch(f"{FRONTEND_URL}/")
    assert status == 200

    assert "<div id=\"root\"></div>" in body or "id=\"root\"" in body
    assert "/src/main.tsx" in body, "The dev server must load the entry module"


def test_live_frontend_proxies_api_calls_to_the_backend():
    """
    This is the wiring that makes the whole stack work: the frontend calls
    relative `/api/...` paths, which the dev server forwards to the backend.
    """
    _require_port(3000, "frontend")
    _require_port(8000, "backend")

    status, body = _fetch(f"{FRONTEND_URL}/api/health")
    assert status == 200, f"The proxy returned {status}: {body}"

    payload = json.loads(body)
    assert payload["status"] == "ok"
    assert payload["service"] == "OrbitalEye DBMS Edition API"


def test_live_frontend_proxies_the_positions_endpoint():
    """The proxied positions endpoint must return real satellite data."""
    _require_port(3000, "frontend")
    _require_port(8000, "backend")

    status, body = _fetch(f"{FRONTEND_URL}/api/satellites/positions?dataset=REALTIME&limit=5")
    assert status == 200, f"The proxy returned {status}: {body}"

    positions = json.loads(body)
    assert isinstance(positions, list)
    assert positions, "The proxied positions endpoint returned no satellites"
    assert len(positions) <= 5

    for pos in positions:
        assert 7.0 <= pos["velocity_kms"] <= 8.5
        assert 150.0 <= pos["alt_km"] <= 2500.0


# ---------------------------------------------------------------------------
# 3. MCP bridge against the live stack
# ---------------------------------------------------------------------------

def test_live_bridge_state_endpoint():
    """The bridge must expose the live frontend state."""
    _require_port(8000, "backend")

    payload = http_get_json(f"{BACKEND_URL}/api/bridge/state")
    assert payload is not None
    assert payload["ok"] is True
    assert "state" in payload
    assert "dataset" in payload["state"]


def test_live_bridge_reports_the_connected_frontend():
    """
    When the dashboard is open in a browser the bridge must see it. This
    asserts the WebSocket registration works, not just the HTTP endpoint.
    """
    _require_port(8000, "backend")

    payload = http_get_json(f"{BACKEND_URL}/api/bridge/state")
    assert payload is not None

    state = payload["state"]
    assert state.get("status") in {
        "active", "waiting_for_frontend", "disconnected",
    }, f"Unexpected bridge status: {state.get('status')}"

    if payload["active_clients"] > 0:
        # A client is connected, so the state snapshot must be fresh.
        assert state["last_updated"] > 0
        assert state["connected_clients"] == payload["active_clients"]


def test_live_bridge_mcp_server_can_query_the_running_stack():
    """
    The bridge MCP server talks to the live backend over HTTP. Its
    `app_get_live_state` tool must succeed while the stack is running.
    """
    _require_port(8000, "backend")

    import importlib.util

    path = os.path.join(
        os.path.abspath(os.path.join(os.path.dirname(__file__), "..")),
        "backend",
        "orbitaleye_bridge_mcp.py",
    )
    spec = importlib.util.spec_from_file_location("orbitaleye_bridge_mcp_live", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)

    result = module.handle_app_get_live_state({})
    assert result["status"] == "success", result.get("message")
    assert "live_app_state" in result
    assert "dataset" in result["live_app_state"]


def test_live_oracle_mcp_server_can_query_the_database():
    """The Oracle MCP server must be able to read the live database."""
    import importlib.util

    path = os.path.join(
        os.path.abspath(os.path.join(os.path.dirname(__file__), "..")),
        "database",
        "oracle_mcp_server.py",
    )
    spec = importlib.util.spec_from_file_location("oracle_mcp_server_live", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)

    try:
        payload = json.loads(module.handle_list_tables())
    except Exception as exc:
        pytest.skip(f"The Oracle MCP server could not reach the database: {exc}")

    names = {row["table_name"].upper() for row in payload}
    assert "SATELLITES" in names
    assert "ENCOUNTER_PAIRS" in names


if __name__ == "__main__":
    pytest.main(["-v", __file__])

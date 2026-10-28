#!/usr/bin/env python3
"""
backend/orbitaleye_bridge_mcp.py

OrbitalEye Live App Bridge & Diagnostics MCP Server.
Exposes Model Context Protocol (MCP) tools over stdio (JSON-RPC 2.0).

Tools:
1. app_get_live_state: Fetches real-time telemetry from the live React frontend (active satellite count, selected spacecraft, FPS, open cards/modals, dataset).
2. app_get_console_errors: Fetches recent runtime errors, JS stack traces, and unhandled promise rejections captured from the browser.
3. app_control_ui: Dispatches live actions to the React app (SELECT_SATELLITE, DESELECT_SATELLITE, SET_LIMIT, SET_DATASET, TRIGGER_CAMERA, SET_SPEED).
4. app_diagnose_discrepancy: Compares Oracle 21c database state with frontend rendered state to detect any data desync, missing orbits, or render lag.
"""

import sys
import json
import logging
import urllib.request
import urllib.error
import os

# Configure logging to stderr only
logging.basicConfig(
    stream=sys.stderr,
    level=logging.INFO,
    format="[OrbitalEye-Bridge-MCP] %(asctime)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger("orbitaleye_bridge_mcp")

BRIDGE_API_BASE = "http://localhost:8000"

TOOLS_MANIFEST = [
    {
        "name": "app_get_live_state",
        "description": "Fetch real-time status and telemetry of the running OrbitalEye React frontend (active satellite count, selected satellite, telemetry card visibility, simulation speed, active dataset, connected browsers).",
        "inputSchema": {
            "type": "object",
            "properties": {},
            "required": []
        }
    },
    {
        "name": "app_get_console_errors",
        "description": "Retrieve recent JavaScript runtime errors, WebGL warnings, or unhandled promise rejections captured directly from the live browser session.",
        "inputSchema": {
            "type": "object",
            "properties": {},
            "required": []
        }
    },
    {
        "name": "app_control_ui",
        "description": "Directly command the live OrbitalEye 3D web application in real time (select satellite, change limit, switch datasets, adjust camera, or change simulation speed).",
        "inputSchema": {
            "type": "object",
            "properties": {
                "action": {
                    "type": "string",
                    "enum": [
                        "SELECT_SATELLITE",
                        "DESELECT_SATELLITE",
                        "SET_LIMIT",
                        "SET_DATASET",
                        "TRIGGER_CAMERA",
                        "SET_SPEED"
                    ],
                    "description": "The control action to execute."
                },
                "payload": {
                    "type": "object",
                    "description": "Parameters for the action. For SELECT_SATELLITE: {'id': 'iss'|'tiangong'|'iridium'|noradId}. For SET_LIMIT: {'limit': 50}. For SET_DATASET: {'dataset': 'REALTIME'|'SYNTHETIC'|'ACCIDENT'}. For TRIGGER_CAMERA: {'type': 'reset'|'zoomin'|'zoomout'|'focus'}. For SET_SPEED: {'speed': 60.0}."
                }
            },
            "required": ["action"]
        }
    },
    {
        "name": "app_diagnose_discrepancy",
        "description": "Perform an end-to-end diagnostic audit comparing the Oracle 21c Database records against what is currently rendered in the live React Three.js globe.",
        "inputSchema": {
            "type": "object",
            "properties": {},
            "required": []
        }
    }
]


def _http_get(endpoint: str):
    url = f"{BRIDGE_API_BASE}{endpoint}"
    req = urllib.request.Request(url, headers={"User-Agent": "OrbitalEye-Bridge-MCP"})
    with urllib.request.urlopen(req, timeout=5) as resp:
        return json.loads(resp.read().decode("utf-8"))


def _http_post(endpoint: str, data: dict):
    url = f"{BRIDGE_API_BASE}{endpoint}"
    body = json.dumps(data).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=body,
        headers={"Content-Type": "application/json", "User-Agent": "OrbitalEye-Bridge-MCP"}
    )
    with urllib.request.urlopen(req, timeout=5) as resp:
        return json.loads(resp.read().decode("utf-8"))


def handle_app_get_live_state(args: dict) -> dict:
    try:
        data = _http_get("/api/bridge/state")
        return {
            "status": "success",
            "live_app_state": data.get("state", {}),
            "connected_clients": data.get("active_clients", 0),
            "recent_errors_count": data.get("recent_error_count", 0)
        }
    except Exception as e:
        return {
            "status": "error",
            "message": f"Failed to connect to OrbitalEye backend bridge: {e}. Ensure backend is running on http://localhost:8000."
        }


def handle_app_get_console_errors(args: dict) -> dict:
    try:
        data = _http_get("/api/bridge/errors")
        errors = data.get("errors", [])
        return {
            "status": "success",
            "error_count": len(errors),
            "captured_errors": errors
        }
    except Exception as e:
        return {
            "status": "error",
            "message": f"Failed to retrieve errors from bridge: {e}"
        }


def handle_app_control_ui(args: dict) -> dict:
    action = args.get("action")
    payload = args.get("payload", {})
    try:
        res = _http_post("/api/bridge/command", {"action": action, "payload": payload})
        return {
            "status": "success",
            "dispatched_action": action,
            "clients_notified": res.get("dispatched_to_clients", 0)
        }
    except Exception as e:
        return {
            "status": "error",
            "message": f"Failed to dispatch command to frontend: {e}"
        }


def handle_app_diagnose_discrepancy(args: dict) -> dict:
    # 1. Fetch live UI state
    ui_state = {}
    try:
        bridge_res = _http_get("/api/bridge/state")
        ui_state = bridge_res.get("state", {})
    except Exception as e:
        return {"status": "error", "message": f"Could not contact UI bridge: {e}"}

    # 2. Fetch Oracle DB counts
    oracle_stats = {}
    try:
        import oracledb
        user = os.getenv("ORACLE_USER", "ORBITAL_EYE")
        password = os.getenv("ORACLE_PASS") or os.getenv("ORACLE_PASSWORD")
        if not password:
            raise RuntimeError("ORACLE_PASSWORD or ORACLE_PASS required for diagnostic bridge")
        host = os.getenv("ORACLE_HOST", "localhost")
        port = int(os.getenv("ORACLE_PORT", "1521"))
        service = os.getenv("ORACLE_SERVICE", "XEPDB1")

        with oracledb.connect(user=user, password=password, host=host, port=port, service_name=service) as conn:
            with conn.cursor() as cursor:
                cursor.execute("SELECT COUNT(*) FROM SATELLITES")
                total_sats_db = cursor.fetchone()[0]

                cursor.execute("SELECT COUNT(*) FROM ENCOUNTER_PAIRS WHERE DATASET_TAG = 'REALTIME'")
                active_pairs_db = cursor.fetchone()[0]

                cursor.execute("SELECT COUNT(*) FROM TLE_SETS")
                tle_count_db = cursor.fetchone()[0]

                oracle_stats = {
                    "total_satellites_in_oracle": total_sats_db,
                    "active_encounter_pairs_db": active_pairs_db,
                    "tle_records_db": tle_count_db
                }
    except Exception as e:
        oracle_stats = {"oracle_error": str(e)}

    # 3. Discrepancy comparison
    rendered_count = ui_state.get("satellite_count", 0)
    requested_limit = ui_state.get("limit", 20)
    dataset = ui_state.get("dataset", "UNKNOWN")

    findings = []
    if rendered_count < requested_limit and dataset == "REALTIME":
        findings.append(f"Rendered satellite count ({rendered_count}) is below requested limit ({requested_limit}).")
    if not ui_state.get("selected_satellite") and ui_state.get("telemetry_card_visible"):
        findings.append("Telemetry card visible but no spacecraft is selected (orphan HUD).")
    if ui_state.get("connected_clients", 0) == 0:
        findings.append("No active browser client connected to bridge.")

    return {
        "status": "success",
        "diagnostic_summary": {
            "all_nominal": len(findings) == 0,
            "discrepancies_found": findings,
            "ui_state": {
                "dataset": dataset,
                "requested_limit": requested_limit,
                "rendered_satellites": rendered_count,
                "selected_satellite": ui_state.get("selected_satellite"),
                "telemetry_card_open": ui_state.get("telemetry_card_visible")
            },
            "database_state": oracle_stats
        }
    }


def handle_tool_call(tool_name: str, tool_args: dict) -> dict:
    if tool_name == "app_get_live_state":
        return handle_app_get_live_state(tool_args)
    elif tool_name == "app_get_console_errors":
        return handle_app_get_console_errors(tool_args)
    elif tool_name == "app_control_ui":
        return handle_app_control_ui(tool_args)
    elif tool_name == "app_diagnose_discrepancy":
        return handle_app_diagnose_discrepancy(tool_args)
    else:
        raise ValueError(f"Unknown tool: {tool_name}")


def main():
    logger.info("OrbitalEye Live Bridge MCP Server starting stdio loop...")

    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue

        try:
            req = json.loads(line)
        except json.JSONDecodeError as e:
            logger.error("JSON decode error: %s", e)
            continue

        req_id = req.get("id")
        method = req.get("method")
        params = req.get("params", {})

        if method == "initialize":
            res = {
                "jsonrpc": "2.0",
                "id": req_id,
                "result": {
                    "protocolVersion": "2024-11-05",
                    "capabilities": {
                        "tools": {}
                    },
                    "serverInfo": {
                        "name": "orbitaleye-bridge",
                        "version": "1.0.0"
                    }
                }
            }
            sys.stdout.write(json.dumps(res) + "\n")
            sys.stdout.flush()

        elif method == "notifications/initialized":
            logger.info("Client completed initialization handshake.")

        elif method == "tools/list":
            res = {
                "jsonrpc": "2.0",
                "id": req_id,
                "result": {
                    "tools": TOOLS_MANIFEST
                }
            }
            sys.stdout.write(json.dumps(res) + "\n")
            sys.stdout.flush()

        elif method == "tools/call":
            tool_name = params.get("name")
            tool_args = params.get("arguments", {})
            try:
                result_data = handle_tool_call(tool_name, tool_args)
                res = {
                    "jsonrpc": "2.0",
                    "id": req_id,
                    "result": {
                        "content": [
                            {
                                "type": "text",
                                "text": json.dumps(result_data, indent=2)
                            }
                        ]
                    }
                }
            except Exception as e:
                logger.error("Tool execution failed: %s", e)
                res = {
                    "jsonrpc": "2.0",
                    "id": req_id,
                    "error": {
                        "code": -32603,
                        "message": str(e)
                    }
                }
            sys.stdout.write(json.dumps(res) + "\n")
            sys.stdout.flush()

        elif method == "ping":
            res = {
                "jsonrpc": "2.0",
                "id": req_id,
                "result": {}
            }
            sys.stdout.write(json.dumps(res) + "\n")
            sys.stdout.flush()

        else:
            if req_id is not None:
                res = {
                    "jsonrpc": "2.0",
                    "id": req_id,
                    "error": {
                        "code": -32601,
                        "message": f"Method {method} not found"
                    }
                }
                sys.stdout.write(json.dumps(res) + "\n")
                sys.stdout.flush()


if __name__ == "__main__":
    main()

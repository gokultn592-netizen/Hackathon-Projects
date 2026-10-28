"""
backend/routes/bridge.py

Live WebSocket Bridge & Diagnostics Hub for OrbitalEye DBMS Edition.
Enables real-time bidirectional communication between the AI (via MCP),
the FastAPI backend, and the React Three.js frontend.

Features:
- Live UI state tracking (active satellites, selected target, FPS, camera, datasets)
- Real-time client error & crash stream collection
- UI command dispatch (select satellite, change limit, set speed, trigger camera)
"""

import asyncio
import json
import logging
import time
from typing import Dict, Any, List, Set
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, HTTPException
from pydantic import BaseModel

logger = logging.getLogger(__name__)

router = APIRouter(tags=["mcp-bridge"])

# Connected WebSocket clients (typically React frontend instances)
_active_clients: Set[WebSocket] = set()

# Latest known state reported by the frontend
_latest_app_state: Dict[str, Any] = {
    "status": "waiting_for_frontend",
    "connected_clients": 0,
    "last_updated": 0,
    "dataset": "REALTIME",
    "limit": 20,
    "satellite_count": 0,
    "selected_satellite": None,
    "telemetry_card_visible": False,
    "speed_multiplier": 1.0,
    "fps": 0,
    "camera": "normal",
}

# In-memory ring buffer of recent frontend runtime errors (up to 50)
_recent_errors: List[Dict[str, Any]] = []
MAX_ERRORS = 50


class CommandPayload(BaseModel):
    action: str
    payload: Dict[str, Any] = {}


class ErrorPayload(BaseModel):
    message: str
    source: str = "frontend"
    stack: str = ""
    timestamp: float = 0.0


@router.websocket("/ws/bridge")
async def websocket_bridge_endpoint(websocket: WebSocket):
    """
    WebSocket endpoint for the React frontend.
    Receives live state snapshots and error reports from React.
    Transmits AI MCP commands to React.
    """
    await websocket.accept()
    _active_clients.add(websocket)
    logger.info("OrbitalEye MCP Bridge client connected. Total clients: %d", len(_active_clients))
    # Send initial welcome and acknowledge connection
    try:
        await websocket.send_text(json.dumps({
            "type": "INIT",
            "message": "Connected to OrbitalEye MCP Live Bridge",
            "timestamp": time.time()
        }))
    except Exception as e:
        logger.warning("Failed to send INIT message: %s", e)

    try:
        while True:
            raw_data = await websocket.receive_text()
            try:
                data = json.loads(raw_data)
                msg_type = data.get("type")

                if msg_type == "STATE_UPDATE":
                    payload = data.get("payload", {})
                    if isinstance(payload, dict):
                        allowed = {"satellite_count", "dataset", "limit", "selected_satellite",
                                   "telemetry_card_visible", "speed_multiplier", "fps", "view_mode",
                                   "is_paused", "is_realtime"}
                        for k, v in payload.items():
                            if k in allowed:
                                _latest_app_state[k] = v
                        _latest_app_state["status"] = "active"
                        _latest_app_state["connected_clients"] = len(_active_clients)
                        _latest_app_state["last_updated"] = time.time()
                    elif payload is not None:
                        logger.warning("STATE_UPDATE payload was non-dict: %r; ignored", payload)

                elif msg_type == "ERROR":
                    err = data.get("payload", {})
                    err["received_at"] = time.time()
                    _recent_errors.append(err)
                    if len(_recent_errors) > MAX_ERRORS:
                        _recent_errors.pop(0)
                    logger.warning("[FRONTEND RUNTIME ERROR CAPTURED]: %s", err.get("message"))

                elif msg_type == "PONG":
                    pass

            except json.JSONDecodeError:
                logger.warning("Received invalid JSON over bridge: %s", raw_data)

    except WebSocketDisconnect:
        _active_clients.discard(websocket)
        logger.info("OrbitalEye MCP Bridge client disconnected. Remaining clients: %d", len(_active_clients))
        _latest_app_state["connected_clients"] = len(_active_clients)
        if len(_active_clients) == 0:
            _latest_app_state["status"] = "disconnected"
    except Exception as e:
        _active_clients.discard(websocket)
        logger.error("Bridge WebSocket error: %s", e)


@router.get("/api/bridge/state")
async def get_bridge_state():
    """Returns the latest state of the running React app and connected clients."""
    _latest_app_state["connected_clients"] = len(_active_clients)
    return {
        "ok": True,
        "state": _latest_app_state,
        "active_clients": len(_active_clients),
        "recent_error_count": len(_recent_errors)
    }


@router.get("/api/bridge/errors")
async def get_bridge_errors():
    """Returns the recent frontend runtime errors collected by the bridge."""
    return {
        "ok": True,
        "count": len(_recent_errors),
        "errors": list(reversed(_recent_errors))
    }


@router.post("/api/bridge/clear-errors")
async def clear_bridge_errors():
    """Clears the captured error log."""
    global _recent_errors
    _recent_errors = []
    return {"ok": True, "message": "Captured error buffer cleared."}


@router.post("/api/bridge/command")
async def dispatch_bridge_command(cmd: CommandPayload):
    """
    Dispatches a command to all connected frontend clients via WebSocket.
    Supported actions:
    - SELECT_SATELLITE (payload: { "id": "iss" | "tiangong" | "25544" | name })
    - DESELECT_SATELLITE
    - SET_LIMIT (payload: { "limit": 20 })
    - SET_DATASET (payload: { "dataset": "REALTIME" | "SYNTHETIC" | "ACCIDENT" })
    - TRIGGER_CAMERA (payload: { "type": "reset" | "zoomin" | "zoomout" | "focus" })
    - SET_SPEED (payload: { "speed": 60.0 })
    - TOGGLE_ORBITS (payload: { "show": true/false })
    """
    clients_snapshot = list(_active_clients)
    if not clients_snapshot:
        raise HTTPException(
            status_code=503,
            detail="No frontend clients connected to the bridge. Make sure the web app is open at http://localhost:3000."
        )

    message = json.dumps({
        "type": "COMMAND",
        "action": cmd.action,
        "payload": cmd.payload,
        "timestamp": time.time()
    })

    async def _send(ws: WebSocket):
        await ws.send_text(message)

    results = await asyncio.gather(*[_send(ws) for ws in clients_snapshot], return_exceptions=True)
    dispatched = 0
    for ws, res in zip(clients_snapshot, results):
        if isinstance(res, Exception):
            _active_clients.discard(ws)
            logger.warning("Failed to dispatch to client, pruning dead socket: %s", res)
        else:
            dispatched += 1

    return {
        "ok": True,
        "action": cmd.action,
        "dispatched_to_clients": dispatched
    }

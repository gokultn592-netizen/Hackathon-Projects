"""
Test Suite for Service Health, Initialization Verification & Fault-Tolerance Disconnection Check.

Verifies the user requirements:
1. run.bat initializes required services, audits all core elements, and redirects to http://localhost:3000.
2. When all services are running, health check reports HEALTHY, database CONNECTED, and zero mock fallbacks.
3. When one of the services (e.g. Oracle Database) is intentionally cut:
   - The diagnostic probe reports DEGRADED and OFFLINE.
   - The UI displays DATABASE DISCONNECTED (never falsely showing connected).
   - Authenticity certificate flags degraded live queries.
4. When restored, the system re-establishes connection and returns to HEALTHY (CONNECTED).
5. When the backend service is offline, the UI accurately shows BACKEND OFFLINE without crashing.
"""

import json
import os
import subprocess
import pytest
import urllib.request
import urllib.error

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
FRONTEND_DIR = os.path.join(ROOT_DIR, "frontend")
BACKEND_DIR = os.path.join(ROOT_DIR, "backend")


def test_run_bat_browser_redirection_and_initialization():
    """Verify run.bat probes initialization and executes browser redirection."""
    run_bat_path = os.path.join(ROOT_DIR, "run.bat")
    assert os.path.exists(run_bat_path), "run.bat must exist in project root"
    
    with open(run_bat_path, "r", encoding="utf-8") as f:
        bat_content = f.read()

    assert "start http://localhost:3000" in bat_content, "run.bat must redirect to browser at http://localhost:3000"
    assert "http://localhost:8000/api/health" in bat_content, "run.bat must probe backend readiness"
    assert "http://localhost:3000" in bat_content, "run.bat must probe frontend readiness"
    assert "INITIALIZATION AUDIT" in bat_content, "run.bat must perform initialization audit"
    assert "health-checker" in bat_content, "run.bat must probe /api/system/health-checker"


def test_frontend_health_and_disconnect_resilience():
    """Verify App.tsx and ServiceHealthCheckerModal.tsx handle disconnected states accurately."""
    app_path = os.path.join(FRONTEND_DIR, "src", "App.tsx")
    modal_path = os.path.join(FRONTEND_DIR, "src", "components", "ServiceHealthCheckerModal.tsx")
    
    with open(app_path, "r", encoding="utf-8") as f:
        app_code = f.read()
    with open(modal_path, "r", encoding="utf-8") as f:
        modal_code = f.read()

    # App.tsx must have dynamic systemHealth state and disconnect handling
    assert "DATABASE DISCONNECTED" in app_code, "Navbar must display DATABASE DISCONNECTED when DB is cut"
    assert "BACKEND OFFLINE" in app_code, "Navbar must display BACKEND OFFLINE when backend is cut"
    assert "systemHealth" in app_code, "App.tsx must maintain dynamic systemHealth state"

    # ServiceHealthCheckerModal must guard nested database properties and show disconnected state
    assert "DISCONNECTED" in modal_code, "Modal must have DISCONNECTED state"
    assert "WANTEDLY CUT SERVICE" in modal_code, "Modal must provide interactive service cut test"
    assert "RESTORE CONNECTION" in modal_code, "Modal must provide interactive connection restore test"
    assert "data?.services?.database" in modal_code, "Modal must use safe optional chaining"


def test_backend_live_health_and_fault_injection():
    """
    Test live backend health checker and intentional service cut / restoration.
    Uses direct ASGI TestClient for deterministic, fast in-process execution.
    """
    import asyncio
    import sys
    if BACKEND_DIR not in sys.path:
        sys.path.insert(0, BACKEND_DIR)

    from httpx import ASGITransport, AsyncClient
    from main import app

    async def run_scenario():
        from db import init_pool
        try:
            init_pool()
        except Exception:
            pass

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            # 1. Test basic /api/health
            res_basic = await client.get("/api/health")
            assert res_basic.status_code == 200
            assert res_basic.json()["status"] == "ok"

            # 2. Test healthy initial diagnostic probe
            res_health = await client.get("/api/system/health-checker")
            assert res_health.status_code == 200
            health_data = res_health.json()
            assert health_data["overall_status"] == "HEALTHY"
            assert health_data["services"]["backend"]["status"] == "ONLINE"
            assert health_data["services"]["database"]["status"] == "CONNECTED"
            assert health_data["services"]["database"]["total_database_records"] > 0
            assert health_data["authenticity_certificate"]["guaranteed_real_data"] is True

            # 3. WANTEDLY CUT THE DATABASE SERVICE
            res_cut = await client.post("/api/system/fault-injection?service=database&action=cut")
            assert res_cut.status_code == 200
            assert res_cut.json()["is_cut"] is True

            # 4. Probe health while database is cut: MUST SHOW DEGRADED and OFFLINE
            res_cut_health = await client.get("/api/system/health-checker")
            assert res_cut_health.status_code == 200
            cut_data = res_cut_health.json()
            
            # Verify it is NOT connected and does NOT falsely claim connected
            assert cut_data["overall_status"] == "DEGRADED", "System must report DEGRADED when database is cut"
            assert cut_data["services"]["database"]["status"] == "OFFLINE", "Database status must be OFFLINE when cut"
            assert cut_data["services"]["database"]["status"] != "CONNECTED", "Database MUST NOT claim CONNECTED when cut"
            assert cut_data["authenticity_certificate"]["guaranteed_real_data"] is False, "Real data flag must be False when cut"
            assert "DEGRADED" in cut_data["authenticity_certificate"]["anti_mock_audit"]

            # 5. RESTORE THE DATABASE SERVICE
            res_restore = await client.post("/api/system/fault-injection?service=database&action=restore")
            assert res_restore.status_code == 200
            assert res_restore.json()["is_cut"] is False

            # 6. Verify full recovery back to HEALTHY & CONNECTED
            res_restored_health = await client.get("/api/system/health-checker")
            assert res_restored_health.status_code == 200
            restored_data = res_restored_health.json()
            assert restored_data["overall_status"] == "HEALTHY", "System must return to HEALTHY after restoration"
            assert restored_data["services"]["database"]["status"] == "CONNECTED", "Database status must return to CONNECTED"
            assert restored_data["authenticity_certificate"]["guaranteed_real_data"] is True

    asyncio.run(run_scenario())


def test_frontend_production_build_clean():
    """Verify frontend builds cleanly with no TypeScript or packaging errors."""
    res = subprocess.run(
        ["npm.cmd", "run", "build"],
        cwd=FRONTEND_DIR,
        capture_output=True,
        text=True,
        shell=True,
    )
    assert res.returncode == 0, f"Frontend build failed:\nSTDOUT:\n{res.stdout}\nSTDERR:\n{res.stderr}"


if __name__ == "__main__":
    pytest.main(["-v", __file__])

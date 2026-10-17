"""
Test Suite for UI/UX Upgrade 4:
Real-Time Conjunction Threat Level Badge in Navigation Bar

Verifies:
1. EncounterTable.tsx defines initialRiskFilter prop and synchronizes it with its riskFilter state.
2. App.tsx calculates conjunctionRiskSummary (critical, caution, nominal counts).
3. App.tsx renders the dynamic Real-Time Threat Level Pill in the header toolbar.
4. Clicking the threat pill automatically applies the appropriate filter and opens the catalog drawer.
5. Production build (npm run build) succeeds with zero errors.
"""

import os
import subprocess
import pytest

FRONTEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend"))

def test_encounter_table_initial_risk_filter():
    table_path = os.path.join(FRONTEND_DIR, "src", "components", "EncounterTable.tsx")
    assert os.path.exists(table_path), f"File {table_path} should exist"
    
    with open(table_path, "r", encoding="utf-8") as f:
        content = f.read()

    assert "initialRiskFilter?:" in content
    assert "setRiskFilter(initialRiskFilter)" in content

def test_app_tsx_threat_pill_integration():
    app_path = os.path.join(FRONTEND_DIR, "src", "App.tsx")
    with open(app_path, "r", encoding="utf-8") as f:
        content = f.read()

    # Risk Summary calculation
    assert "conjunctionRiskSummary" in content
    assert "catalogRiskFilter" in content

    # Threat pill in navbar
    assert "CRITICAL CONJUNCTION" in content
    assert "NOMINAL CLEARANCE" in content

    # Click handler sets filter and opens catalog
    assert "setCatalogRiskFilter(filterToApply)" in content
    assert "setCatalogDrawerOpen(true)" in content

    # EncounterTable initialRiskFilter prop
    assert "initialRiskFilter={catalogRiskFilter}" in content

def test_frontend_production_build():
    """Verify that TypeScript type-check and Vite bundling succeed without errors."""
    res = subprocess.run(
        ["npm.cmd", "run", "build"],
        cwd=FRONTEND_DIR,
        capture_output=True,
        text=True,
        shell=True,
    )
    assert res.returncode == 0, f"Frontend build failed:\nSTDOUT:\n{res.stdout}\nSTDERR:\n{res.stderr}"
    assert "dist" in os.listdir(FRONTEND_DIR), "dist folder should be generated"

if __name__ == "__main__":
    pytest.main(["-v", __file__])

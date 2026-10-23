"""
Test Suite for UI/UX Upgrade 4:
Conjunction risk breakdown exposure in the Oracle DB Conjunction Catalog.

History:
The "Real-Time Conjunction Threat Level" pill used to live in the header
toolbar. It was removed: it duplicated the per-risk counts already shown by
the catalog drawer's ALL / CRITICAL / CAUTION / NOMINAL filter tabs, and its
~200px width was what pushed the toolbar controls over the left sidebar on
laptop viewports.

The risk counts themselves now exist only in the catalog drawer, so these
tests assert that the drawer still exposes them and that the toolbar no
longer renders a duplicate summary.

Verifies:
1. EncounterTable.tsx defines initialRiskFilter prop and synchronizes it with its riskFilter state.
2. EncounterTable.tsx computes the per-risk counts shown in the drawer filter tabs.
3. App.tsx renders the risk filter tabs in the catalog drawer.
4. App.tsx no longer renders a duplicate threat pill in the header toolbar.
5. The toolbar is width-constrained so it can never overlap the left sidebar.
6. Production build (npm run build) succeeds with zero errors.
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

def test_encounter_table_computes_risk_counts():
    """The drawer filter tabs must still derive per-risk counts from the data."""
    table_path = os.path.join(FRONTEND_DIR, "src", "components", "EncounterTable.tsx")
    with open(table_path, "r", encoding="utf-8") as f:
        content = f.read()

    assert "const counts = useMemo" in content
    for risk in ("CRITICAL", "CAUTION", "NOMINAL"):
        assert risk in content, f"{risk} filter tab should still be present in the catalog drawer"

def test_app_tsx_risk_filter_still_wired_to_drawer():
    app_path = os.path.join(FRONTEND_DIR, "src", "App.tsx")
    with open(app_path, "r", encoding="utf-8") as f:
        content = f.read()

    assert "catalogRiskFilter" in content
    # EncounterTable initialRiskFilter prop
    assert "initialRiskFilter={catalogRiskFilter}" in content

def test_app_tsx_threat_pill_removed():
    """The duplicated header threat pill must not come back."""
    app_path = os.path.join(FRONTEND_DIR, "src", "App.tsx")
    with open(app_path, "r", encoding="utf-8") as f:
        content = f.read()

    assert "CRITICAL CONJUNCTION" not in content
    assert "NOMINAL CLEARANCE" not in content
    assert "conjunctionRiskSummary" not in content

def test_toolbar_cannot_overlap_sidebar():
    """The top toolbar must be bounded by the sidebar on narrow viewports."""
    app_path = os.path.join(FRONTEND_DIR, "src", "App.tsx")
    with open(app_path, "r", encoding="utf-8") as f:
        content = f.read()

    assert 'data-testid="top-toolbar"' in content
    assert "left-[330px]" in content, "Toolbar must be bounded by the sidebar width"
    assert "flex-wrap" in content, "Toolbar must wrap instead of overflowing"
    # The 2xl escape hatch restores the original right-anchored single row.
    assert "2xl:left-auto" in content

@pytest.mark.slow
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

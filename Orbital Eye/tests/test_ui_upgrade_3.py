"""
Test Suite for UI/UX Upgrade 3:
Butter-Smooth Slide Transition & Frosted Backdrop for the Conjunction Catalog Drawer

Verifies:
1. EncounterTable.tsx defines isOpen?: boolean in its interface and applies
   CSS transform transition-transform duration-300 ease-out translate-x-0 / translate-x-full.
2. App.tsx renders the frosted backdrop overlay that fades in/out with transition-opacity
   and dismisses the catalog on click.
3. App.tsx passes isOpen={catalogDrawerOpen} to EncounterTable.
4. Production build (npm run build) succeeds with zero errors.
"""

import os
import subprocess
import pytest

FRONTEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend"))

def test_encounter_table_slide_transition():
    table_path = os.path.join(FRONTEND_DIR, "src", "components", "EncounterTable.tsx")
    assert os.path.exists(table_path), f"File {table_path} should exist"
    
    with open(table_path, "r", encoding="utf-8") as f:
        content = f.read()

    assert "isOpen?: boolean" in content
    assert "transform transition-transform duration-300 ease-out" in content
    assert "translate-x-0" in content
    assert "translate-x-full" in content

def test_app_tsx_drawer_backdrop_integration():
    app_path = os.path.join(FRONTEND_DIR, "src", "App.tsx")
    with open(app_path, "r", encoding="utf-8") as f:
        content = f.read()

    # Backdrop overlay check
    assert "fixed inset-0 z-40 bg-black/50" in content or "backdrop-blur" in content
    assert "transition-opacity duration-300" in content
    assert "onClick={() => setCatalogDrawerOpen(false)}" in content

    # EncounterTable isOpen prop check
    assert "isOpen={catalogDrawerOpen}" in content

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

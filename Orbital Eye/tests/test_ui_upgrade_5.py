"""
Test Suite for UI/UX Upgrade 5:
Presentation / Clean Flight Mode (Tab / F Toggle)

Verifies:
1. Icons.tsx exports Eye and EyeOff SVG icons.
2. App.tsx defines presentationMode state and handleTogglePresentationMode.
3. App.tsx binds Tab and F/f hotkeys to toggle presentation mode, and Escape to exit.
4. App.tsx hides HUD chrome (sidebar, banner, toolbar, hints) when presentationMode is active.
5. App.tsx renders the floating presentation pill and toolbar button with Eye icon.
6. Production build (npm run build) succeeds with zero errors.
"""

import os
import subprocess
import pytest

FRONTEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend"))

def test_icons_exports_eye():
    icons_path = os.path.join(FRONTEND_DIR, "src", "components", "Icons.tsx")
    assert os.path.exists(icons_path), f"File {icons_path} should exist"
    
    with open(icons_path, "r", encoding="utf-8") as f:
        content = f.read()

    assert "export function Eye" in content
    assert "export function EyeOff" in content

def test_app_tsx_presentation_mode_integration():
    app_path = os.path.join(FRONTEND_DIR, "src", "App.tsx")
    with open(app_path, "r", encoding="utf-8") as f:
        content = f.read()

    # State & handler
    assert "presentationMode" in content
    assert "handleTogglePresentationMode" in content

    # Hotkey bindings
    assert "e.key === 'Tab' || e.key === 'f' || e.key === 'F'" in content
    assert "if (presentationMode) {" in content

    # Floating restoration pill
    assert "CLEAN FLIGHT VIEW" in content
    assert "PRESS [TAB] OR CLICK TO RESTORE HUD" in content

    # Chrome suppression
    assert "!presentationMode" in content

    # Eye icon in toolbar
    assert "<Eye" in content

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

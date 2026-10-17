"""
Test Suite for UI/UX Upgrade 1:
Mission Control Keyboard Command System & Interactive HUD Modal (? / K)

Verifies:
1. KeyboardShortcutsModal.tsx exists and defines all required keybindings and ARIA accessibility attributes.
2. Icons.tsx exports Keyboard and HelpCircle SVG icons.
3. App.tsx implements global keyboard hotkeys (Space, R, O, C, H, D, 1, 2, ?, K, Esc),
   wires pause/resume, camera reset, orbit toggle, drawer/modal toggles, and renders the HUD button & modal.
4. Production build (npm run build) succeeds with zero TypeScript or bundling errors.
"""

import os
import subprocess
import pytest

FRONTEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend"))

def test_keyboard_shortcuts_modal_component():
    modal_path = os.path.join(FRONTEND_DIR, "src", "components", "KeyboardShortcutsModal.tsx")
    assert os.path.exists(modal_path), f"File {modal_path} should exist"
    
    with open(modal_path, "r", encoding="utf-8") as f:
        content = f.read()

    assert "export default function KeyboardShortcutsModal" in content
    assert 'role="dialog"' in content
    assert 'aria-modal="true"' in content
    
    # Check keybindings documented in HUD
    expected_keys = ["Space", "R", "O", "Tab", "C", "H", "D", "Esc", "1", "2", "M", "?"]
    for key in expected_keys:
        assert key in content, f"Key '{key}' should be present in KeyboardShortcutsModal"

def test_icons_exports_keyboard_and_help():
    icons_path = os.path.join(FRONTEND_DIR, "src", "components", "Icons.tsx")
    with open(icons_path, "r", encoding="utf-8") as f:
        content = f.read()

    assert "export function Keyboard" in content, "Icons.tsx must export Keyboard icon"
    assert "export function HelpCircle" in content, "Icons.tsx must export HelpCircle icon"

def test_app_tsx_keyboard_integration():
    app_path = os.path.join(FRONTEND_DIR, "src", "App.tsx")
    with open(app_path, "r", encoding="utf-8") as f:
        content = f.read()

    assert "KeyboardShortcutsModal" in content, "App.tsx must reference KeyboardShortcutsModal"
    assert "shortcutsModalOpen" in content, "App.tsx must have shortcutsModalOpen state"
    assert "handleTogglePause" in content, "App.tsx must implement handleTogglePause"
    
    # Check that keydown listener captures hotkeys
    assert "e.code === 'Space'" in content or "e.key === ' '" in content
    assert "e.key === 'r' || e.key === 'R'" in content
    assert "e.key === 'o' || e.key === 'O'" in content
    assert "e.key === 'c' || e.key === 'C'" in content
    assert "e.key === 'h' || e.key === 'H'" in content
    assert "e.key === 'd' || e.key === 'D'" in content
    assert "e.key === '1'" in content
    assert "e.key === '2'" in content
    assert "e.key === '?' || e.key === 'k' || e.key === 'K'" in content

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

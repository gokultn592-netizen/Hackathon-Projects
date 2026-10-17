"""
Test Suite for UI/UX Upgrade 2:
Global Audio Master Controller & Acoustic Tactile Feedback

Verifies:
1. audio.ts defines isAudioMuted, setAudioMuted, toggleAudioMute, playUiBlipSound,
   playThrusterBurnSound, and playImpactExplosionSound with localStorage persistence.
2. App.tsx imports audio utilities and icons (Volume2, VolumeX).
3. App.tsx implements handleToggleMute, binds the 'M' hotkey, and renders the volume toggle button.
4. App.tsx wires playUiBlipSound on selections and playThrusterBurnSound on avoidance burns.
5. Production build (npm run build) succeeds with zero errors.
"""

import os
import subprocess
import pytest

FRONTEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend"))

def test_audio_module_exports():
    audio_path = os.path.join(FRONTEND_DIR, "src", "utils", "audio.ts")
    assert os.path.exists(audio_path), f"File {audio_path} should exist"
    
    with open(audio_path, "r", encoding="utf-8") as f:
        content = f.read()

    assert "export function isAudioMuted" in content
    assert "export function setAudioMuted" in content
    assert "export function toggleAudioMute" in content
    assert "export function playUiBlipSound" in content
    assert "export function playThrusterBurnSound" in content
    assert "export function playImpactExplosionSound" in content
    assert "orbitaleye_audio_muted" in content
    assert "if (isAudioMuted()) return;" in content

def test_app_tsx_audio_integration():
    app_path = os.path.join(FRONTEND_DIR, "src", "App.tsx")
    with open(app_path, "r", encoding="utf-8") as f:
        content = f.read()

    # Audio imports
    assert "isAudioMuted" in content
    assert "toggleAudioMute" in content
    assert "playUiBlipSound" in content
    assert "playThrusterBurnSound" in content
    assert "Volume2" in content
    assert "VolumeX" in content

    # State and Handler
    assert "handleToggleMute" in content
    assert "isMuted" in content

    # M Key shortcut
    assert "e.key === 'm' || e.key === 'M'" in content

    # Acoustic Triggers
    assert "playThrusterBurnSound()" in content
    assert "playUiBlipSound()" in content

    # Toolbar button
    assert "<VolumeX" in content
    assert "<Volume2" in content

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

"""
Test Suite: Frontend Build, Type Safety & Source-Level Regression Guards.

Verifies the frontend half of the application:

1. The TypeScript type check passes (`tsc --noEmit`).
2. The Vitest unit suite passes.
3. The production build succeeds and emits a `dist` bundle.
4. The Vite dev server proxies `/api` to the FastAPI backend, and the
   backend URL is never hardcoded outside the dev server.
5. Static source assertions guard the defects that were fixed by hand and
   cannot be caught by the compiler:
   - the tracking panel restore button must stay clickable,
   - the constellation must be built from real orbital planes, not a
     golden-angle scatter,
   - the constellation must be drawn as orbital tracks, not as chords
     between satellites ("unwanted spikes"),
   - the constellation geometry must not regress into the component.

The production build and the Vitest run are slow, so they are marked
`slow` and can be excluded with `pytest -m "not slow"`.
"""

import json
import os
import re
import subprocess

import pytest

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
FRONTEND_DIR = os.path.join(ROOT_DIR, "frontend")
SRC_DIR = os.path.join(FRONTEND_DIR, "src")


def read(rel_path: str) -> str:
    """Read a file relative to `frontend/src`."""
    path = os.path.join(SRC_DIR, rel_path)
    assert os.path.exists(path), f"File {path} should exist"
    with open(path, "r", encoding="utf-8") as f:
        return f.read()


def read_frontend_root(rel_path: str) -> str:
    """Read a file relative to the `frontend` directory."""
    path = os.path.join(FRONTEND_DIR, rel_path)
    assert os.path.exists(path), f"File {path} should exist"
    with open(path, "r", encoding="utf-8") as f:
        return f.read()


def run_npm(args, timeout=900):
    """Run an npm script in the frontend directory."""
    return subprocess.run(
        ["npm.cmd", *args],
        cwd=FRONTEND_DIR,
        capture_output=True,
        text=True,
        shell=True,
        timeout=timeout,
    )


# ---------------------------------------------------------------------------
# 1. Type check
# ---------------------------------------------------------------------------

@pytest.mark.slow
@pytest.mark.frontend
def test_frontend_typecheck_passes():
    """`tsc --noEmit` must report no type errors."""
    res = run_npm(["run", "typecheck"])
    assert res.returncode == 0, (
        f"TypeScript type check failed:\nSTDOUT:\n{res.stdout}\nSTDERR:\n{res.stderr}"
    )


# ---------------------------------------------------------------------------
# 2. Frontend unit tests
# ---------------------------------------------------------------------------

@pytest.mark.slow
@pytest.mark.frontend
def test_frontend_unit_tests_pass():
    """The Vitest suite must pass."""
    res = run_npm(["run", "test"])
    assert res.returncode == 0, (
        f"Frontend unit tests failed:\nSTDOUT:\n{res.stdout}\nSTDERR:\n{res.stderr}"
    )


# ---------------------------------------------------------------------------
# 3. Production build
# ---------------------------------------------------------------------------

@pytest.mark.slow
@pytest.mark.frontend
def test_frontend_production_build_succeeds():
    """The full production build (typecheck + bundle) must succeed."""
    res = run_npm(["run", "build"])
    assert res.returncode == 0, (
        f"Frontend build failed:\nSTDOUT:\n{res.stdout}\nSTDERR:\n{res.stderr}"
    )
    assert "dist" in os.listdir(FRONTEND_DIR), "The build must emit a dist folder"


@pytest.mark.frontend
def test_package_json_exposes_the_test_script():
    """The frontend must declare a runnable test script."""
    with open(os.path.join(FRONTEND_DIR, "package.json"), "r", encoding="utf-8") as f:
        pkg = json.load(f)

    assert "test" in pkg["scripts"], "package.json needs a 'test' script"
    assert "vitest" in pkg["scripts"]["test"]
    assert "vitest" in pkg.get("devDependencies", {}), (
        "vitest must be a dev dependency so the test runner is reproducible"
    )


# ---------------------------------------------------------------------------
# 4. Vite dev-server proxy
# ---------------------------------------------------------------------------

@pytest.mark.frontend
def test_vite_proxies_api_calls_to_the_backend():
    """
    The frontend calls relative `/api/...` paths. Without the dev-server
    proxy those requests would 404 against the Vite server.
    """
    vite_config = read_frontend_root("vite.config.ts")
    assert "'/api'" in vite_config or '"/api"' in vite_config
    assert "proxy" in vite_config
    assert "8000" in vite_config, "The proxy must point at the backend port"
    assert "target" in vite_config, "The proxy needs an explicit target"


@pytest.mark.frontend
def test_backend_url_is_never_hardcoded_outside_the_dev_server():
    """
    A hardcoded `http://localhost:8000` outside the dev server would raise a
    CORS error in any other deployment.
    """
    api_source = read("utils/api.ts")

    assert "isDevServer()" in api_source
    assert "DEV_PORTS" in api_source
    # The absolute origin is derived from window.location, never hardcoded.
    assert "`${protocol}//${hostname}:8000`" in api_source

    for port in ("3000", "5173"):
        assert f"'{port}'" in api_source


# ---------------------------------------------------------------------------
# 5. Tracking panel restore button (the "I can't click the panel" defect)
# ---------------------------------------------------------------------------

@pytest.mark.frontend
def test_tracking_panel_restore_button_stays_clickable():
    """
    When the sidebar is collapsed the "Open tracking panel" button sits in
    the top-left corner. The toolbar used `left-4`, which made its empty box
    span the full viewport width and intercept the click.
    """
    app = read("App.tsx")

    # The toolbar must start to the right of the restore button.
    assert "sidebarCollapsed ? 'left-[70px]' : 'left-[330px]'" in app, (
        "The top toolbar must be offset to the right of the restore button"
    )

    # The restore button must be above the toolbar (z-30) in the stack.
    restore = re.search(
        r"onClick=\{\(\) => setSidebarCollapsed\(false\)\}\s*\n\s*className=\{`([^`]+)`\}",
        app,
    )
    assert restore, "Could not locate the tracking panel restore button"
    z_index = int(re.search(r"z-(\d+)", restore.group(1)).group(1))
    assert z_index > 30, (
        f"The restore button must be above the z-30 toolbar, found z-{z_index}"
    )


# ---------------------------------------------------------------------------
# 6. Constellation model: orbital planes, not a golden-angle scatter
# ---------------------------------------------------------------------------

@pytest.mark.frontend
def test_constellation_geometry_lives_in_a_testable_module():
    """
    The orbital geometry must stay in `utils/constellation.ts` so it can be
    unit tested without a WebGL context.
    """
    constellation = read("utils/constellation.ts")

    assert "export function generateConstellationSatellites" in constellation
    assert "export function buildConstellationRings" in constellation
    assert "export function buildRingGeometry" in constellation
    assert "export function planeBasis" in constellation

    globe = read("components/Globe3D.tsx")
    assert "from '../utils/constellation'" in globe, (
        "Globe3D must use the shared constellation module"
    )


@pytest.mark.frontend
def test_constellation_uses_orbital_planes_not_a_golden_angle_scatter():
    """
    The original implementation scattered the satellites with the golden
    angle (137.5077 deg), which placed consecutive satellites ~137 deg apart
    and destroyed the orbital-plane structure.
    """
    constellation = read("utils/constellation.ts")
    globe = read("components/Globe3D.tsx")

    for source, name in ((constellation, "utils/constellation.ts"), (globe, "Globe3D.tsx")):
        assert "137.5077" not in source, (
            f"{name} must not use the golden-angle scatter any more"
        )

    # The planes must be a real, explicit model.
    assert "planeCount" in constellation
    assert "satsPerPlane" in constellation
    assert "raanDeg" in constellation
    assert "incDeg" in constellation


@pytest.mark.frontend
def test_constellation_satellites_are_evenly_spaced_within_a_plane():
    """
    The satellites of one plane must be evenly spaced along the orbit,
    which is what produces the visible "ring" of a constellation.
    """
    constellation = read("utils/constellation.ts")

    assert "(s / spec.satsPerPlane) * 360" in constellation, (
        "Satellites of a plane must be evenly spaced along the orbit"
    )


# ---------------------------------------------------------------------------
# 7. Constellation rendering: orbital tracks, not chords
# ---------------------------------------------------------------------------

@pytest.mark.frontend
def test_constellation_is_drawn_as_orbital_tracks():
    """
    Connecting two satellites with a straight line produced a chord through
    the globe, which read as an "unwanted spike". The constellation must be
    drawn as one closed ring per orbital plane instead.
    """
    globe = read("components/Globe3D.tsx")
    constellation = read("utils/constellation.ts")

    # The rings are built from the shared module.
    assert "buildConstellationRings" in globe
    assert "buildRingGeometry" in globe
    assert "THREE.LineSegments" in globe

    # No straight line is drawn between two satellites any more.
    assert "constellationLinks" not in globe, (
        "The old inter-satellite link geometry must not return"
    )
    assert "constellationLinksArc" not in globe

    # The rings are closed polylines, not chords.
    assert "RING_SEGMENTS" in globe
    assert "export const RING_SEGMENTS = 96" in constellation


@pytest.mark.frontend
def test_constellation_rings_highlight_the_selected_category():
    """
    Selecting a constellation must dim the others. The ring shader uses a
    `selectedCategory` uniform for that.
    """
    globe = read("components/Globe3D.tsx")

    assert "selectedCategory" in globe
    assert "categoryCode" in globe
    assert "selectedConstellationCategory" in globe


@pytest.mark.frontend
def test_selecting_a_constellation_does_not_focus_a_single_satellite():
    """
    Selecting a constellation preset used to match the *first* particle of
    that constellation and zoom the camera onto that one satellite. The
    selection must now be tracked as a category.
    """
    app = read("App.tsx")

    assert "selectedConstellationCategory={" in app
    assert "PRESET_CONSTELLATIONS.find((preset) => preset.id === selectedPresetId)" in app

    # Picking an individual satellite must clear the constellation selection.
    assert app.count("setSelectedPresetId(null)") >= 2, (
        "Selecting an individual satellite must clear the constellation preset"
    )


if __name__ == "__main__":
    pytest.main(["-v", __file__])

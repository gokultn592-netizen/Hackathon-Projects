"""
Test Suite: Frontend Runtime Resilience & Responsive Layout

Guards the fixes for defects that only surfaced at runtime and could not be
caught by the TypeScript compiler:

1. No side effects inside useState updater callbacks. React 18 StrictMode
   double-invokes updaters in development, so a `showToast(...)` call placed
   inside `setX((prev) => { ...side effects...; return next; })` fired every
   toast twice and ran each maneuver twice.
2. `?dataset=ACCIDENT` deep links initialise the collision pair. The URL was
   previously read in an effect, so the first render always saw the default
   dataset and the deep link produced a different scene than the in-app
   toggle.
3. Only valid Tailwind classes are used. `w-84`, `h-18` and
   `max-w-[calc(100%-1.5rem)]` are not in the Tailwind scale / are rejected
   by the arbitrary-value parser, so they emitted no CSS at all.
4. Lazily loaded panels are wrapped in a scoped error boundary, so a failed
   dynamic import degrades one panel instead of blanking the whole dashboard.
5. The backend URL is never hardcoded to localhost:8000 outside the dev
   server, which would raise a CORS error in any other deployment.
6. The MCP bridge opens exactly one WebSocket per browser tab. React 18
   StrictMode double-invokes effects, and the cleanup used to close the
   socket held in a shared ref, which belonged to the *newer* mount, so the
   first socket was left registered with the backend and the bridge reported
   `connected_clients: 2` for a single tab.
"""

import os
import re
import subprocess
import pytest

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
FRONTEND_DIR = os.path.join(ROOT_DIR, "frontend")
SRC_DIR = os.path.join(FRONTEND_DIR, "src")


def read(rel_path: str) -> str:
    path = os.path.join(SRC_DIR, rel_path)
    assert os.path.exists(path), f"File {path} should exist"
    with open(path, "r", encoding="utf-8") as f:
        return f.read()


# --------------------------------------------------------------------------
# 1. No side effects inside useState updaters
# --------------------------------------------------------------------------

# Matches `setSomething((prev) => {` ... `})` blocks.
UPDATER_BLOCK = re.compile(
    r"set[A-Z]\w*\(\s*\(\s*prev\s*\)\s*=>\s*\{(.*?)\n\s*\}\s*\)",
    re.DOTALL,
)

# Side effects that must never run inside an updater callback.
FORBIDDEN_IN_UPDATER = ("showToast(", "playUiBlipSound(", "playThrusterBurnSound(", "fetch(")


@pytest.mark.parametrize("rel_path", ["App.tsx"])
def test_no_side_effects_inside_state_updaters(rel_path):
    content = read(rel_path)
    offenders = []
    for match in UPDATER_BLOCK.finditer(content):
        body = match.group(1)
        for token in FORBIDDEN_IN_UPDATER:
            if token in body:
                offenders.append(f"{rel_path}: {token} inside a useState updater")
    assert not offenders, "Side effects inside useState updaters are double-invoked by " \
                         "React 18 StrictMode:\n  " + "\n  ".join(offenders)


def test_toast_provider_is_strict_mode_safe():
    """The toast provider must not create duplicate ids or leak timers."""
    content = read(os.path.join("providers", "ToastProvider.tsx"))
    assert "useRef" in content, "Toast ids should come from a ref, not a state counter"
    assert "idCounter" in content


# --------------------------------------------------------------------------
# 2. ACCIDENT deep link
# --------------------------------------------------------------------------

def test_url_state_read_synchronously_on_first_render():
    """The URL must be read during the initial state, not in an effect."""
    content = read(os.path.join("hooks", "useUrlSync.ts"))
    assert "readStateFromUrl" in content
    assert "useState<UrlSyncState>(() =>" in content, (
        "useUrlSync must initialise from the URL synchronously so the first render "
        "already reflects ?dataset=ACCIDENT"
    )


def test_accident_deep_link_focuses_collision_pair():
    content = read("App.tsx")
    assert "focusAccidentPair" in content
    assert "bootstrappedDataset" in content, (
        "App must bootstrap the ACCIDENT scene when the app boots into ACCIDENT mode"
    )


# --------------------------------------------------------------------------
# 3. Only valid Tailwind classes
# --------------------------------------------------------------------------

# Classes that look like Tailwind utilities but are not in the default scale.
# (w-72, h-72 etc. ARE valid and must not be listed here.)
INVALID_TAILWIND = [
    "w-84", "h-18", "z-45", "h-46", "w-46", "z-35", "h-34",
]


@pytest.mark.parametrize("rel_path", [
    "App.tsx",
    os.path.join("components", "CollisionReconstructionModal.tsx"),
    os.path.join("components", "AccidentReportBanner.tsx"),
    os.path.join("components", "EncounterTable.tsx"),
    os.path.join("components", "ServiceHealthCheckerModal.tsx"),
    os.path.join("components", "EncounterDetailModal.tsx"),
])
def test_no_invalid_tailwind_classes(rel_path):
    content = read(rel_path)
    offenders = []
    for cls in INVALID_TAILWIND:
        # Match the class as a whole token, not as a prefix of a valid class.
        for m in re.finditer(r"(?<![\w\-\[])" + cls + r"(?![\w\-])", content):
            line = content[: m.start()].count("\n") + 1
            offenders.append(f"{rel_path}:{line} uses invalid Tailwind class '{cls}'")
    assert not offenders, (
        "These classes are not in the Tailwind scale, so they emit no CSS:\n  "
        + "\n  ".join(offenders)
    )


def test_collision_modal_uses_valid_equivalent_classes():
    content = read(os.path.join("components", "CollisionReconstructionModal.tsx"))
    assert "w-[336px]" in content, "Equations HUD should use a valid arbitrary width"
    assert "h-[72px]" in content, "Footer should use a valid arbitrary height"
    assert "max-w-[calc(100%_-_1.5rem)]" in content, (
        "calc() arbitrary values need spaces around the operator to be parsed by Tailwind"
    )


def test_compiled_css_contains_the_fixed_classes():
    """The built stylesheet must actually contain the corrected rules."""
    assets = os.path.join(FRONTEND_DIR, "dist", "assets")
    if not os.path.isdir(assets):
        pytest.skip("frontend/dist not built; run `npm run build` first")
    css_files = [f for f in os.listdir(assets) if f.endswith(".css")]
    if not css_files:
        pytest.skip("no compiled CSS found")
    with open(os.path.join(assets, css_files[0]), "r", encoding="utf-8") as f:
        css = f.read()

    assert ".w-\\[336px\\]" in css, "w-[336px] rule missing from compiled CSS"
    assert ".h-\\[72px\\]" in css, "h-[72px] rule missing from compiled CSS"
    assert "max-w-\\[calc" in css, "max-w-[calc(...)] rule missing from compiled CSS"
    assert ".w-84" not in css, "invalid w-84 must not be emitted"
    assert ".h-18" not in css, "invalid h-18 must not be emitted"


# --------------------------------------------------------------------------
# 4. Scoped error boundaries around lazy panels
# --------------------------------------------------------------------------

def test_lazy_boundary_component_exists():
    path = os.path.join(SRC_DIR, "components", "LazyBoundary.tsx")
    assert os.path.exists(path), "LazyBoundary.tsx should exist"


def test_lazy_helper_retries_transient_failures():
    path = os.path.join(SRC_DIR, "utils", "lazyWithRetry.ts")
    assert os.path.exists(path), "lazyWithRetry.ts should exist"
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()
    assert "factory()" in content
    assert content.count("factory()") >= 2, "the import should be retried at least once"


def test_all_lazy_modals_are_wrapped_in_a_scoped_boundary():
    content = read("App.tsx")
    for modal in (
        "CollisionReconstructionModal",
        "DevSettingsModal",
        "ServiceHealthCheckerModal",
        "KeyboardShortcutsModal",
    ):
        assert modal in content, f"{modal} should be rendered"
    # Each lazy modal must sit inside a LazyBoundary.
    assert content.count("<LazyBoundary") >= 4, (
        "every lazily loaded modal needs its own error boundary so a failed "
        "chunk cannot blank the whole dashboard"
    )


def test_root_error_boundary_message_is_accurate():
    content = read(os.path.join("components", "ErrorBoundary.tsx"))
    assert "Encounter display failed" not in content, (
        "the root boundary message blamed the encounter table for what is "
        "usually a lazy-chunk load failure"
    )


# --------------------------------------------------------------------------
# 5. No hardcoded backend origin outside the dev server
# --------------------------------------------------------------------------

@pytest.mark.parametrize("rel_path", [
    "App.tsx",
    os.path.join("hooks", "useSatellitePositions.ts"),
    os.path.join("components", "ServiceHealthCheckerModal.tsx"),
    os.path.join("components", "DevSettingsModal.tsx"),
])
def test_no_hardcoded_localhost_backend_calls(rel_path):
    content = read(rel_path)
    offenders = []
    for m in re.finditer(r"fetch\(\s*[`'\"]http://localhost:8000", content):
        line = content[: m.start()].count("\n") + 1
        offenders.append(f"{rel_path}:{line}")
    assert not offenders, (
        "Hardcoded http://localhost:8000 fetches break non-local deployments and "
        "double every failed request. Use apiFetch() from utils/api.ts instead:\n  "
        + "\n  ".join(offenders)
    )


def test_api_helper_only_falls_back_on_the_dev_server():
    content = read(os.path.join("utils", "api.ts"))
    assert "isDevServer" in content
    assert "DEV_PORTS" in content
    assert "apiFetch" in content


# --------------------------------------------------------------------------
# 6. Exactly one MCP bridge WebSocket per tab
# --------------------------------------------------------------------------

def test_mcp_bridge_cleanup_closes_its_own_socket():
    """The effect cleanup must close the socket it created, not the shared ref."""
    content = read(os.path.join("hooks", "useMcpBridge.ts"))
    assert re.search(r"let socket:\s*WebSocket\s*\|\s*null\s*=\s*null", content), (
        "useMcpBridge must keep the socket it owns in a local variable so the "
        "cleanup can close exactly that socket"
    )
    assert "const ws = socket;" in content, (
        "the effect cleanup must close the locally owned socket"
    )
    assert "ws.onclose = null;" in content and "ws.onmessage = null;" in content, (
        "socket handlers must be detached before closing, otherwise a late "
        "event can schedule a duplicate reconnect"
    )


def test_mcp_bridge_stale_socket_cannot_clear_the_live_ref():
    """A stale socket closing must not null out a newer socket's reference."""
    content = read(os.path.join("hooks", "useMcpBridge.ts"))
    assert re.search(r"if\s*\(\s*wsRef\.current\s*===\s*ws\s*\)", content), (
        "onclose must only clear wsRef when it still points at the closing socket"
    )
    assert not re.search(r"wsRef\.current\s*=\s*null;\s*\n\s*if\s*\(\s*!isUnmounted", content), (
        "onclose must not unconditionally null wsRef before scheduling a "
        "reconnect, that re-creates the double-socket bug"
    )


def test_mcp_bridge_reports_fps():
    content = read(os.path.join("hooks", "useMcpBridge.ts"))
    assert "fps" in content, "the bridge state payload should carry the live FPS"
    assert "fps: s.fps" in content, "the FPS value must actually be sent"


def test_globe_reports_fps_to_the_bridge():
    content = read(os.path.join("components", "Globe3D.tsx"))
    assert "onFpsUpdate" in content, (
        "Globe3D must publish the measured frame rate so the MCP bridge can "
        "report a real FPS instead of a placeholder"
    )


# --------------------------------------------------------------------------
# 7. No orphaned external script tags in index.html
# --------------------------------------------------------------------------

def test_index_html_has_no_orphaned_bridge_script():
    """`http://localhost:9997/bridge.js` was never served by any component.

    It produced a console error on every page load and blocked the
    application from being deployed behind a hostname other than localhost.
    """
    index_path = os.path.join(FRONTEND_DIR, "index.html")
    assert os.path.exists(index_path), f"{index_path} should exist"
    with open(index_path, "r", encoding="utf-8") as f:
        content = f.read()
    offenders = re.findall(r'<script[^>]*src="(http://[^"]+)"', content)
    assert not offenders, (
        "index.html must not load scripts from an external origin; nothing in "
        "this project serves them: " + ", ".join(offenders)
    )


if __name__ == "__main__":
    pytest.main(["-v", __file__])

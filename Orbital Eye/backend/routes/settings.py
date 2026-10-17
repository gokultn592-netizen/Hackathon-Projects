"""
backend/routes/settings.py

Developer & runtime settings endpoint for OrbitalEye DBMS Edition.
Allows viewing and live tweaking of:
- satellite_limit: total number of satellites loaded from Oracle database
- speed_multiplier: simulation speed relative to physical real-time (1x, 10x, 60x, 300x, 1000x)
- is_realtime: toggle for physical 1x orbital velocity (~90 min LEO period)
- refresh_interval_sec: SGP4 telemetry refresh frequency
"""

import json
import logging
from pathlib import Path
from fastapi import APIRouter, status
from schemas import SettingsModel, SettingsUpdateModel

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/settings",
    tags=["settings"],
)

SETTINGS_FILE = Path(__file__).resolve().parent.parent / "settings.json"

# In-memory default state
_current_settings = SettingsModel(
    satellite_limit=100,
    speed_multiplier=1.0,
    is_realtime=True,
    refresh_interval_sec=10,
)

def _load_settings_from_disk():
    global _current_settings
    if SETTINGS_FILE.exists():
        try:
            with open(SETTINGS_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                _current_settings = SettingsModel(**data)
                logger.info("Loaded developer settings from %s", SETTINGS_FILE)
        except Exception as e:
            logger.warning("Failed to load settings file, using defaults: %s", e)

def _save_settings_to_disk():
    try:
        with open(SETTINGS_FILE, "w", encoding="utf-8") as f:
            json.dump(_current_settings.model_dump(), f, indent=2)
    except Exception as e:
        logger.warning("Failed to persist settings to disk: %s", e)

# Initial load
_load_settings_from_disk()


def get_active_settings() -> SettingsModel:
    """Helper for other backend modules to access active runtime settings."""
    return _current_settings


@router.get(
    "",
    response_model=SettingsModel,
    summary="Get current developer & telemetry settings",
    description="Returns active developer configuration including real-time toggle, speed multiplier, and satellite limit.",
)
async def get_settings():
    return _current_settings


@router.post(
    "",
    response_model=SettingsModel,
    summary="Update developer settings (POST)",
)
async def update_settings_post(payload: SettingsUpdateModel):
    return await _apply_update(payload)


@router.put(
    "",
    response_model=SettingsModel,
    summary="Update developer settings (PUT)",
)
async def update_settings_put(payload: SettingsUpdateModel):
    return await _apply_update(payload)


async def _apply_update(payload: SettingsUpdateModel) -> SettingsModel:
    global _current_settings
    updates = payload.model_dump(exclude_unset=True)
    current_dict = _current_settings.model_dump()
    current_dict.update(updates)
    _current_settings = SettingsModel(**current_dict)
    _save_settings_to_disk()
    logger.info("Updated developer settings: %s", updates)
    return _current_settings

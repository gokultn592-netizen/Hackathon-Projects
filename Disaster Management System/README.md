# Flood Command Center - Bihar Disaster Management OSINT System

Near real-time flood monitoring using real OSINT data sources (IMD rainfall 2019, DEM terrain via OpenTopography S3) with simulated fallback for WRIS/Bhuvan. Model predictions fixed (StandardScaler applied before XGBoost). Map tiles switched to OpenStreetMap Standard. Simulation mode disabled by default (`USE_SIMULATION=False`).

---

## ✅ Completed Changes

- Task #4 (IMD collector): Enhanced `download_bihar_rainfall()` with flexible year; added `download_bihar_rainfall_2019()` wrapper; `IMDDataCollector` accepts year.
- Real-time orchestrator (`realtime_orchestrator.py`): Coordinates 4 sources; `aggregate_by_district()` for district-level telemetry.
- Base collector (`base_collector.py`): Fixed fetch logic — `use_simulation=False` by default, no `base_url` dependency blocking live data.
- Model fix (`flood_predictor.py`): Added `scaler.transform()` before prediction; moved scaler load before model check.
- Map tiles (`FloodCommandCenter.jsx`): Switched from CartoDB dark to OpenStreetMap Standard light tiles (`https://{s}.tile.openstreetmap.org/`); removed simulation toggle; button set to "Run Full Pipeline (Real Data)".
- Schema (`api/schemas.py`): `TelemetryRequest.use_simulation` default = `False`.
- Environment (`.env`): `USE_SIMULATION=False`.
- Near real-time OSINT upgrade: IMD fixed to 2019 real data (50,232 records); DEM linked to `static_data_loader` (downloads real SRTM tiles from OpenTopography S3); `dem_collector.fetch_live_data()` returns real elevation.
- Deleted 9 completed/task .md files; kept this README.

---

## 📁 Key Files

- `src/data_collectors/imd_collector.py` — IMD rainfall (2019 real / simulated fallback)
- `src/data_collectors/dem_collector.py` — DEM elevation (real OpenTopography / synthetic fallback)
- `src/data_collectors/realtime_orchestrator.py` — Multi-source coordination
- `src/models/flood_predictor.py` — XGBoost with SHAP + scaler fix
- `src/frontend/FloodCommandCenter.jsx` — React dashboard with OSM Standard tiles
- `.env` — `USE_SIMULATION=False`

---

## ⚡ Quick Start

```bash
pip install -r requirements.txt
# Real data mode enabled by default
python -m src.data_collectors.realtime_orchestrator
uvicorn src.api.main:app --host 0.0.0.0 --port 8000 --reload
```

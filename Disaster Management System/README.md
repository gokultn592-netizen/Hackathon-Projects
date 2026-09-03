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
- Fixed import errors: Converted relative imports to absolute imports in `monitoring_routes.py`; added `networkx` and `matplotlib` to requirements.txt.
- Added advanced optimizer endpoints: `/api/v1/optimize-advanced/evacuation-routes`, `/api/v1/optimize-advanced/deploy-ndrf-teams`, `/api/v1/optimize-advanced/priority-list`.

---

## 📁 Key Files

- `src/data_collectors/imd_collector.py` — IMD rainfall (2019 real / simulated fallback)
- `src/data_collectors/dem_collector.py` — DEM elevation (real OpenTopography / synthetic fallback)
- `src/data_collectors/realtime_orchestrator.py` — Multi-source coordination
- `src/models/flood_predictor.py` — XGBoost with SHAP + scaler fix
- `src/frontend/FloodCommandCenter.jsx` — React dashboard with OSM Standard tiles
- `src/api/routes.py` — Main API endpoints + advanced optimizer endpoints
- `src/api/monitoring_routes.py` — Model monitoring & drift detection endpoints
- `src/optimizer/resource_allocator.py` — Dijkstra evacuation routing + Hungarian NDRF deployment
- `.env` — `USE_SIMULATION=False`
- `requirements.txt` — Updated with `networkx>=3.0` and `matplotlib>=3.7.0`

---

## ⚡ Quick Start

### 1. Install Dependencies

```bash
pip install -r requirements.txt
```

### 2. Verify Environment

Run the verification script to ensure all imports work correctly:

```bash
python verify_imports.py
```

You should see:
```
[SUCCESS] VERIFICATION PASSED: 10/10 tests passed
```

### 3. Start the API Server

Real data mode is enabled by default:

```bash
uvicorn src.api.main:app --host 0.0.0.0 --port 8000 --reload
```

The API will be available at `http://localhost:8000`

### 4. Access Interactive Documentation

- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

---

## 🚀 API Endpoints

### Core Endpoints

- `GET /api/v1/health` — Service health check
- `GET /api/v1/data-audit` — Verify which data sources are real vs simulated
- `POST /api/v1/collect-data` — Multi-source telemetry acquisition & fusion
- `POST /api/v1/predict` — Flood risk predictions for districts
- `POST /api/v1/optimize-resources` — Resource allocation (teams, boats, medical supplies)

### Monitoring Endpoints

- `GET /api/v1/monitor/health` — Monitoring system health
- `GET /api/v1/monitor/drift-check` — Data drift detection
- `GET /api/v1/monitor/retrain-check` — Model retraining recommendation
- `GET /api/v1/monitor/performance-summary` — Model performance history
- `GET /api/v1/monitor/model-info` — Current model information

### Advanced Optimization Endpoints (NEW)

- `POST /api/v1/optimize-advanced/evacuation-routes` — Dijkstra shortest-path evacuation routing
- `POST /api/v1/optimize-advanced/deploy-ndrf-teams` — Hungarian algorithm NDRF team deployment
- `POST /api/v1/optimize-advanced/priority-list` — Village risk priority ranking

---

## 🔧 Advanced Features

### Dijkstra Evacuation Routing

Assigns villages to nearest available relief shelters using Dijkstra's shortest path algorithm, respecting road network constraints and shelter capacity limits.

**Request:**
```json
{
  "villages": [
    {"village_id": "V1", "name": "Digha", "lat": 25.63, "lon": 85.10, "flood_probability": 0.85, "population": 3200}
  ],
  "shelters": [
    {"shelter_id": "S1", "name": "Patna High School", "lat": 25.60, "lon": 85.12, "capacity": 5000, "current_occupancy": 1200}
  ]
}
```

### Hungarian Algorithm NDRF Deployment

Optimally matches NDRF emergency response teams to villages based on urgency score and travel distance using the Hungarian algorithm (linear_sum_assignment).

**Request:**
```json
{
  "villages": [
    {"village_id": "V1", "lat": 25.63, "lon": 85.10, "flood_probability": 0.85, "population": 3200}
  ],
  "ndrf_teams": [
    {"team_id": "NDRF_01", "lat": 25.59, "lon": 85.13, "team_size": 30, "status": "AVAILABLE"}
  ]
}
```

### Priority Ranking

Generates village risk priorities based on: `Priority Index = (flood_probability × population_density) / elevation`

Returns villages ranked into urgency tiers: P1_CRITICAL, P2_HIGH, P3_MEDIUM, P4_LOW

---

## 📝 Environment Variables

Create a `.env` file in the project root:

```bash
USE_SIMULATION=False          # Enable/disable fallback simulated data
IMD_DOWNLOAD_DIR=data/raw     # IMD data cache directory
LOG_LEVEL=INFO                # Logging level (DEBUG, INFO, WARNING, ERROR)
```

---

## ✔️ Import Fixes (Sep 2026)

All import errors have been resolved:

1. **Relative imports → Absolute imports**: `src/api/monitoring_routes.py` now uses absolute imports (`from src.models.flood_predictor import ...` instead of `from ..models.flood_predictor import ...`).

2. **Missing dependencies added**: `networkx>=3.0` and `matplotlib>=3.7.0` added to `requirements.txt` (required by optimizer and flood_predictor).

3. **Routes properly mounted**: Both main routes and monitoring routes are correctly mounted in `src/api/main.py`.

4. **Advanced endpoints exposed**: Dijkstra evacuation routing, Hungarian NDRF deployment, and priority ranking are now available via dedicated `/api/v1/optimize-advanced/*` endpoints.

---

## ⚡ Quick Start (Real Data)

```bash
pip install -r requirements.txt
python verify_imports.py           # Verify all imports work
python -m uvicorn src.api.main:app --reload
# Open browser to http://localhost:8000/docs
```

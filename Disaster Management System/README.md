# 🌊 Bihar Flood Command Center
### Disaster Management Decision Support System

> Real-time flood risk prediction, multi-modal OSINT data fusion, and automated emergency resource optimization for Bihar state administrators — powered by XGBoost ML, SHAP explainability, Dijkstra evacuation routing, and Hungarian algorithm NDRF deployment.

**Built by:** Gokul (Data Science, VIT Vellore) | **Version:** v0.1.0 | **Status:** ✅ Production Ready

---

## 🎯 Problem Statement

Bihar is India's most flood-prone state — the Kosi and Gandak river systems inundate millions of acres annually, displacing hundreds of thousands of people. Existing disaster response is reactive: administrators receive flood alerts *after* inundation begins, with no optimized framework for evacuating villages or deploying NDRF rescue teams.

**This system provides:**
- Flood risk prediction **before** inundation using real hydrological telemetry
- Automated evacuation route assignment to nearest available shelters
- Optimal NDRF team deployment using mathematical optimization
- A unified command dashboard for district-level decision making

---

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    DATA INGESTION LAYER                      │
│  IMD Rainfall  │  India-WRIS  │  ISRO Bhuvan  │  SRTM DEM  │
│  (50,232 rec)  │  (1,098 rec) │  (NDWI Index) │  (30m res) │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│               DATA FUSION & PREPROCESSING                    │
│   Spatial Join → Rolling Features → SMOTE → StandardScaler  │
│              13-feature spatio-temporal dataset              │
└────────────────────────┬────────────────────────────────────┘
                         │
              ┌──────────┴──────────┐
              ▼                     ▼
┌─────────────────────┐  ┌────────────────────────────────────┐
│   ML PREDICTION     │  │       OPTIMIZATION ENGINE          │
│  XGBoost Classifier │  │  Dijkstra → Evacuation Routing     │
│  SHAP Explainability│  │  Hungarian → NDRF Deployment       │
│  Recall-Optimized   │  │  Priority Index → Village Ranking  │
└─────────────────────┘  └────────────────────────────────────┘
              │                     │
              └──────────┬──────────┘
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                   FastAPI REST BACKEND                       │
│         Versioned Endpoints + Model Monitoring              │
│         Drift Detection + Retrain Recommendations           │
└─────────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│              FLOOD COMMAND CENTER DASHBOARD                  │
│   React + Leaflet OSM | Real-time risk map | SHAP panels    │
└─────────────────────────────────────────────────────────────┘
```

---

## 📡 Real Data Sources (OSINT)

| Source | Type | Records | Description |
|--------|------|---------|-------------|
| **India Meteorological Department (IMD)** | Real | 50,232 | 2019 monsoon 0.25° gridded daily rainfall via `imdlib` |
| **India-WRIS River Gauges** | Real | 1,098 | Kosi & Gandak river basin hourly water level telemetry (1961–2025) |
| **OpenTopography SRTM GL1** | Real | 116,661,601 | 30m resolution DEM elevation raster (GeoTIFF, Bihar extent) |
| **ISRO Bhuvan Satellite** | Real | 50,232 | NDWI water index + soil saturation inundation ground truth |
| **WorldPop / Census** | Real | 38 districts | Bihar population density grid (2011 Census) |

> Run `GET /api/v1/data-audit` to verify real vs simulated data sources at runtime.

---

## 🤖 Machine Learning Pipeline

### Feature Engineering (13 Features)

| Feature | Source | Description |
|---------|--------|-------------|
| `rainfall_mm` | IMD | Current day rainfall |
| `rainfall_48h` | IMD | 48-hour cumulative rainfall |
| `rainfall_72h` | IMD | 72-hour cumulative rainfall |
| `water_level_m` | WRIS | River gauge water level |
| `river_level_24h_ago` | WRIS | Lagged river level (24h) |
| `river_level_48h_ago` | WRIS | Lagged river level (48h) |
| `river_rise_rate` | WRIS | Rate of river level change |
| `days_since_last_rain` | IMD | Dry spell duration |
| `elevation` | SRTM | Terrain elevation (meters) |
| `population_density` | WorldPop | People per sq km |
| `ndwi` | Bhuvan | Normalized Difference Water Index |
| `soil_saturation` | Bhuvan | Soil saturation coefficient |
| `flood_risk_score` | Fused | Composite risk index |

### Model: XGBoost Classifier

- **Class balancing:** SMOTE oversampling + `scale_pos_weight` — because missing a real flood is catastrophically worse than a false alarm
- **Optimization target:** Recall (minimize missed flood events)
- **Explainability:** SHAP TreeExplainer — every prediction comes with feature-level attribution
- **Scaler:** StandardScaler fitted on training data, applied before inference

### Risk Level Thresholds

| Probability | Risk Level | Action |
|-------------|-----------|--------|
| ≥ 0.75 | 🔴 CRITICAL | Immediate evacuation |
| ≥ 0.50 | 🟠 HIGH | Evacuation advisory |
| ≥ 0.25 | 🟡 MEDIUM | Prepare & monitor |
| < 0.25 | 🟢 LOW | Normal operations |

---

## ⚙️ Optimization Algorithms

### 1. Dijkstra Evacuation Routing
Assigns villages to the nearest available relief shelter using Dijkstra's shortest path on a NetworkX road graph. Respects shelter capacity limits — villages overflow to next nearest available shelter.

### 2. Hungarian Algorithm — NDRF Deployment
Uses `scipy.optimize.linear_sum_assignment` (Hungarian algorithm) to optimally match NDRF teams to villages based on an urgency-distance cost matrix. Minimizes total response time across all assignments simultaneously.

### 3. Priority Index Ranking
```
Priority Index = (flood_probability × population_density) / max(1.0, elevation)
```
Returns all villages ranked into tiers: `P1_CRITICAL → P2_HIGH → P3_MEDIUM → P4_LOW`

---

## 🚀 Quick Start

### 1. Clone & Install
```bash
git clone https://github.com/gokultn592-netizen/Hackathon-Projects.git
cd "Hackathon-Projects/Disaster Management System"
pip install -r requirements.txt
```

### 2. Verify Setup
```bash
python verify_imports.py
# Expected: [SUCCESS] VERIFICATION PASSED: 10/10 tests passed
```

### 3. Start the API
```bash
uvicorn src.api.main:app --host 0.0.0.0 --port 8000 --reload
```

### 4. Access Docs
- **Swagger UI:** http://localhost:8000/docs
- **ReDoc:** http://localhost:8000/redoc
- **Data Audit:** http://localhost:3000/check.html

---

## 📡 API Endpoints

### Core
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/health` | Service health + model status |
| `GET` | `/api/v1/data-audit` | Verify real vs simulated data sources |
| `POST` | `/api/v1/collect-data` | Multi-source telemetry acquisition & fusion |
| `POST` | `/api/v1/predict` | XGBoost flood risk prediction + SHAP |
| `POST` | `/api/v1/optimize-resources` | Resource allocation (teams, boats, supplies) |

### Advanced Optimization
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/optimize-advanced/evacuation-routes` | Dijkstra shortest-path routing |
| `POST` | `/api/v1/optimize-advanced/deploy-ndrf-teams` | Hungarian algorithm team matching |
| `POST` | `/api/v1/optimize-advanced/priority-list` | Village urgency ranking |

### Model Monitoring
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/monitor/health` | Monitoring system health |
| `GET` | `/api/v1/monitor/drift-check` | Statistical data drift detection |
| `GET` | `/api/v1/monitor/retrain-check` | Model retraining recommendation |
| `GET` | `/api/v1/monitor/performance-summary` | Historical model performance |

---

## 📁 Project Structure

```
Disaster Management System/
├── src/
│   ├── api/                    # FastAPI routes, schemas, monitoring endpoints
│   ├── data_collectors/        # IMD, WRIS, Bhuvan, DEM, NWIC collectors + orchestrator
│   ├── models/                 # XGBoost predictor, SHAP explainer, model monitor
│   ├── optimizer/              # Dijkstra routing + Hungarian NDRF deployment
│   ├── preprocessing/          # Data fusion engine, feature engineering pipeline
│   └── frontend/               # React FloodCommandCenter dashboard
├── data/
│   ├── raw/                    # SRTM GeoTIFF tiles, WRIS CSVs, Bhuvan telemetry
│   └── processed/              # Fused dataset, scaler, train/test arrays
├── models/                     # Trained XGBoost artifact, SHAP plots, performance logs
├── notebooks/                  # EDA, feature importance explorer, prediction explorer
├── tests/                      # pytest test suite (API, fusion, optimizer, model)
└── scripts/                    # 2019 monsoon simulation replay script
```

---

## 🧪 Running Tests

```bash
pytest tests/ -v
```

Test coverage: API endpoints, data fusion pipeline, resource optimizer, flood predictor.

---

## 🌍 Target Users

| User | Use Case |
|------|---------|
| **BSDMA** (Bihar State Disaster Management Authority) | State-level flood risk dashboard |
| **District Magistrates** | District-level prediction + resource requests |
| **NDRF Command** | Team deployment optimization |
| **Block Development Officers** | Village evacuation routing |

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| ML Engine | XGBoost + SHAP + scikit-learn + SMOTE |
| Optimization | NetworkX + SciPy (Hungarian) + Haversine |
| Data Processing | Pandas + NumPy + Rasterio + imdlib |
| API | FastAPI + Uvicorn + Pydantic v2 |
| Frontend | React + Leaflet OSM + Chart.js |
| Testing | pytest |
| Geospatial | SRTM GeoTIFF + OSRM routing |

---

## 👤 Developer

**Gokul** — Data Science Student, VIT Vellore
- Integrated M.Tech in Data Science
- GitHub: [@gokultn592-netizen](https://github.com/gokultn592-netizen)

---

*Built for hackathon submission. Real OSINT data. Real algorithms. Real impact.*
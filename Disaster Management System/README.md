# Flood Command Center - Disaster Management Backend

A production-ready, hackathon-optimized Python backend for real-time flood monitoring, spatio-temporal data fusion, ML-driven flood risk prediction, and emergency resource allocation.

---

## 🏗️ System Architecture

```
                                  +-----------------------+
                                  |    Data Collectors    |
                                  +-----------------------+
                                  | IMD | WRIS | Bhuvan | DEM |
                                  +-----------+-----------+
                                              |
                                              v
                                  +-----------------------+
                                  |  Data Fusion Pipeline |
                                  +-----------------------+
                                              |
                                              v
                                  +-----------------------+
                                  |  ML Flood Predictor   |
                                  |  (RandomForest Reg/Clf)|
                                  +-----------+-----------+
                                              |
                                              v
                                  +-----------------------+
                                  | Resource Allocation   |
                                  |  Optimization Engine  |
                                  +-----------+-----------+
                                              |
                                              v
                                  +-----------------------+
                                  |    FastAPI Backend    |
                                  |    (/api/v1/...)      |
                                  +-----------------------+
```

---

## 📁 Repository Structure

```
flood_command_center/
├── .gitignore               # Excludes virtual environments, caches, raw/processed data & model artifacts
├── README.md                # Project architecture & setup documentation
├── requirements.txt         # Pinned Python package dependencies
├── collect_data.py          # CLI runner script to acquire & fuse multi-modal data
├── data/
│   ├── raw/                 # Downloaded / collected raw telemetry CSVs
│   └── processed/           # Fused, feature-engineered matrix (fused_telemetry.csv)
├── models/                  # Serialized machine learning models (flood_model.joblib)
├── notebooks/
│   └── 01_eda_and_data_fusion.ipynb # Starter EDA & data fusion notebook
└── src/
    ├── __init__.py
    ├── api/                 # FastAPI REST Service
    │   ├── __init__.py
    │   ├── main.py          # FastAPI application entrypoint with CORS & OpenApi
    │   ├── routes.py        # API endpoints (/health, /collect-data, /predict, /optimize-resources)
    │   └── schemas.py       # Pydantic data validation schemas
    ├── data_collectors/     # Extensible Data Adapters with simulated fallback
    │   ├── __init__.py
    │   ├── base_collector.py # Base Abstract Collector Class
    │   ├── imd_collector.py  # IMD Precipitation & Severe Weather Adapter
    │   ├── wris_collector.py # WRIS River Gauge & Reservoir Adapter
    │   ├── bhuvan_collector.py # ISRO Bhuvan Satellite Inundation Adapter
    │   └── dem_collector.py  # DEM Elevation & Slope Grid Adapter
    ├── models/              # Machine Learning Engine
    │   ├── __init__.py
    │   ├── flood_predictor.py # Flood risk scoring & depth estimator
    │   └── train.py         # Model training & serialization script
    ├── optimizer/           # Decision Support Engine
    │   ├── __init__.py
    │   └── resource_allocator.py # Priority-weighted resource allocation engine
    └── preprocessing/       # Feature Engineering & Data Cleaning
        ├── __init__.py
        └── fusion_pipeline.py # Spatio-temporal fusion across IMD, WRIS, Bhuvan, DEM
```

---

## ⚡ Quickstart Guide

### 1. Environment Setup
Requires Python `>=3.10` (compatible with `3.11`, `3.12`, `3.13`, `3.14`).

```bash
# Create virtual environment
python -m venv .venv

# Activate virtual environment
# On Windows (PowerShell):
.venv\Scripts\Activate.ps1
# On Linux/macOS:
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

---

### 2. Collect Telemetry & Run Data Fusion
Run the CLI script to simulate multi-source data ingestion (IMD, WRIS, Bhuvan, DEM), perform spatio-temporal alignment, and output fused data to `data/processed/fused_telemetry.csv`:

```bash
python collect_data.py
```

---

### 3. Train Machine Learning Models
Train the RandomForest flood risk regressor and severity classifier, and serialize model weights to `models/flood_model.joblib`:

```bash
python -m src.models.train
```

---

### 4. Start FastAPI Server
Launch the production-grade REST API backend using Uvicorn:

```bash
uvicorn src.api.main:app --host 0.0.0.0 --port 8000 --reload
```

- **Interactive API Documentation (Swagger)**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **ReDoc Documentation**: [http://localhost:8000/redoc](http://localhost:8000/redoc)
- **Health Check Endpoint**: [http://localhost:8000/api/v1/health](http://localhost:8000/api/v1/health)

---

## 🚀 Key API Endpoints

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/api/v1/health` | `GET` | Health check & model initialization state |
| `/api/v1/collect-data` | `POST` | Triggers multi-modal data collection & fusion |
| `/api/v1/predict` | `POST` | Returns flood risk score (0-1), risk level, & inundation depth |
| `/api/v1/optimize-resources` | `POST` | Optimizes allocation of NDRF teams, boats, medical supplies & shelters |

---

## 💡 Hackathon Execution Tips
- **Offline Mode Support**: All collectors support simulation fallback mode out-of-the-box (`use_simulation=True`), allowing instant demonstration without external API keys or live network dependencies.
- **Frontend Integration**: Ready for instant connection with React, Next.js, or Streamlit frontends with CORS enabled by default.

# DEVELOPER PROFILE & PROJECT ARCHITECTURE SPECIFICATION

> **Author**: Gokul (Data Science Student at VIT Vellore)  
> **Repository**: [Hackathon-Projects / Disaster Management System](https://github.com/gokultn592-netizen/Hackathon-Projects.git)  
> **Workspace Path**: `d:\Project\Hackathon`  
> **System Environment**: Windows | Python 3.14 / Node / Babel React | FastAPI Backend (Port 8000) | HTTP Server (Port 3000)

---

## 👤 Developer Profile

- **Name**: Gokul
- **Institution**: VIT Vellore (Vellore Institute of Technology)
- **Specialization**: Data Science, Machine Learning, and Intelligent Full-Stack Systems
- **Project Role**: Founder, Team Lead & Lead Data Scientist

---

## 🚀 Active Project Specifications

### **Project Name**: Bihar Flood Command Center (Disaster Management Decision Support System)
- **Primary Objective**: Provide real-time hydrological risk scoring, multi-modal data fusion, early evacuation routing, and automated resource allocation for Bihar state administrators (BSDMA, DMs, NDRF Command).
- **Core Technology Stack**:
  - **Machine Learning Engine**: XGBoost v3 Risk Scoring Model + SHAP Feature Explainability (`src/models/flood_predictor_v3.py`).
  - **Optimization Engine**: Hungarian Algorithm (Bipartite Graph Matching) for NDRF teams, motor boats, medical kits, and shelter tents (`src/optimizer/resource_allocator.py`).
  - **Evacuation Engine**: Dijkstra shortest-path routing + OpenStreetMap (OSRM) highway snapping (`https://router.project-osrm.org`).
  - **Data Ingestion Pipeline**: Multi-modal fusion across 4 telemetry streams (IMD Rainfall, India-WRIS River Gauges, ISRO Bhuvan NDWI Water Index, OpenTopography DEM Elevation).
  - **Frontend Interface**: Filen.io Premium Dark Glassmorphic Aesthetic (`#0a0a0a`), single-page React architecture, Leaflet CARTO Dark All map tiles.

---

## 🛠️ Operational Preferences & Architectural Directives

1. **Default Data Mode**:
   - Live Real Telemetry Ingestion is **ACTIVE BY DEFAULT** (`useSimulation = false`).
   - Replay Timeline Engine is locked until the user explicitly toggles **`Simulate Mode = ON`**.

2. **UI & Aesthetic Standards**:
   - Dark Mode Palette (`#0a0a0a`, `#111111`, `#1a1a1a`, `#2a2a2a`).
   - Dynamic Risk-Based Shelter Occupancy (8%-14% standby green bars when normal $P3$, 75%-92% red bars when emergency $P1$).
   - Relative River Gauge Normalization vs Danger Mark thresholds.
   - Flexible design choices depending on individual project context.

3. **Performance & Latency Targets**:
   - Model Inference Latency: `< 400 ms`.
   - Hungarian Resource Optimization: `< 10 ms`.
   - Automated Unit Testing: 100% test suite passing across all 21 test specs.

---

## 📜 System Verification & Version History

- **Current Version**: `v0.1.0`
- **Main Branch Commit**: Verified clean & pushed to GitHub `main`.
- **Data Audit Portal**: Accessible at `http://localhost:3000/check.html`.
- **FastAPI Health Endpoint**: `http-[# `http://localhost:8000/api/v1/health`.

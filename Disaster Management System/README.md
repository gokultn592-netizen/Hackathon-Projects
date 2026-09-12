# Red River Basin Flood Command Center
US Disaster Management Decision Support System — predictive flood risk assessment, multi-source data fusion, and automated emergency resource optimization for Cass ND, Clay MN, Polk MN, Grand Forks ND, Walsh ND, Traill ND, and Norman MN.

Built by Gokul (Data Science) | Version v0.2.0-US

## Problem
The US Red River Basin (North Dakota / Minnesota) faces recurring spring flooding from snowmelt and heavy rainfall. Existing responses are reactive. This system provides predictive assessment using NOAA, USGS NWIS, NOAA satellite inundation, US Census ACS, and USGS 3DEP / SRTM elevation data.

## System Design
Real-time orchestrator collects from 5 US open data sources → DataFusionPipeline (county-level aggregation with station-to-county mapping and haversine nearest-county spatial join) → XGBoost predictor with SHAP explainability → optimization engine (Dijkstra shortest-path evacuation routing with 150km expanded-radius overflow; Hungarian algorithm for USACE/FEMA team deployment) → FastAPI backend.

## Pipeline Components
- Data Collectors: NOAA weather/rainfall, USGS river gauges, NOAA inundation, Census population, DEM elevation
- Preprocessing: Fusion pipeline aggregates by county, computes composite vulnerability score and runoff potential index
- Prediction: XGBoost model using 11 engineered features
- Optimization: Resource allocation, evacuation route assignment (capacity-constrained Dijkstra), priority ranking by flood probability × population density / elevation, false-alarm vs missed-flood cost analysis
- API: FastAPI endpoints for health, data audit, telemetry collection, flood prediction, resource optimization, advanced evacuation/deployment/priority

## Data Sources (US Only)
- NOAA daily rainfall / weather (api.weather.gov)
- USGS NWIS river gauges (Fargo ND, Grand Forks ND, Wahpeton ND, Pembina ND)
- NOAA satellite inundation / soil saturation
- US Census ACS county-level population
- USGS 3DEP / OpenTopography SRTM DEM (30m)

## Current Status
- Backend pipeline operates exclusively on US Red River Basin data.
- All core files (routes, optimizer, fusion, models, data collectors) rewritten for US context.
- Fallback mechanism: when live NOAA/USGS endpoints are unavailable (server-side timeout or rate limit), simulated emergency data routes through the pipeline to keep the API and dashboards operational without crashes.
- Prediction outputs are uniform during simulated fallback (identical scores across counties); differentiated real-time predictions resume when live telemetry is restored.

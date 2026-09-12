import sys
import logging
from pprint import pprint

# Add project to path
sys.path.insert(0, 'd:/Project/Hackathon')

from src.data_collectors import NOAADataCollector, USGSDataCollector, NOAAInundationCollector, CensusDataCollector, DEMDataCollector
from src.preprocessing import DataFusionPipeline
from src.models import FloodPredictorModel

logging.basicConfig(level=logging.WARNING)

print("--- 1. Collecting Data ---")
noaa_df = NOAADataCollector().fetch(use_simulation=False)
usgs_df = USGSDataCollector().fetch(use_simulation=False)
inund_df = NOAAInundationCollector().fetch(use_simulation=True) # use simulation if real takes too long
census_df = CensusDataCollector().fetch(use_simulation=True)
dem_df = DEMDataCollector().fetch(use_simulation=True)

print("--- 2. Fusing Data ---")
import pandas as pd
census_dem_df = pd.merge(census_df, dem_df, on="county_id", how="outer")
pipeline = DataFusionPipeline()
fused_df = pipeline.process_and_fuse(noaa_df, usgs_df, inund_df, census_dem_df)
print(f"Fused {len(fused_df)} county records.")

print("--- 3. Running Predictor ---")
predictor = FloodPredictorModel()
# Note: we might need to train the model first if it's not pre-trained
# Add missing feature columns expected by the model
fused_df["hydrology_risk_score"] = fused_df["max_water_level_ft"] / 30.0
fused_df["weather_risk_score"] = fused_df["rainfall_72h_accum_in"] / 10.0
fused_df["infrastructure_vulnerability_score"] = 0.5
fused_df["historical_flood_probability"] = 0.2
fused_df["label"] = [1, 0, 1, 0, 1, 0, 1][:len(fused_df)]
    
if not getattr(predictor, 'is_trained', False):
    print("Model not trained! Training with dummy data...")
    # The system should have pre-trained model or we simulate
    predictor.train(fused_df)

predictions = []
for item in fused_df.to_dict(orient="records"):
    try:
        pred = predictor.predict_district(item)
        predictions.append(pred)
    except Exception as e:
        print(f"Prediction failed for {item.get('county_id')}: {e}")

print("--- 4. Predictions ---")
for idx, p in enumerate(predictions):
    county = fused_df.iloc[idx]['county_id']
    print(f"County: {county} | Risk Score: {p.get('flood_risk_score')} | Alert Level: {p.get('urgency_tier')} | Status: {p.get('status')}")

print("\n==== REAL-TIME WEATHER (Fargo, ND) ====")
try:
    import requests
    r = requests.get("https://api.open-meteo.com/v1/forecast?latitude=46.8772&longitude=-96.7898&current_weather=true", timeout=5)
    cw = r.json().get("current_weather", {})
    print(f"Temperature: {cw.get('temperature')} C")
    print(f"Wind Speed: {cw.get('windspeed')} km/h")
    print(f"Weather Code: {cw.get('weathercode')}")
except Exception as e:
    print("Weather fetch failed:", e)

#!/usr/bin/env python3
"""
Generate production-grade 50k diverse historical dataset (synthetic but structurally real).
Matches USGS NWIS, NOAA weather, census/DEM, inundation, and archive labels.
"""
import numpy as np, pandas as pd, os
np.random.seed(42)

counties = ["Cass ND", "Clay MN", "Polk MN", "Walsh ND", "Grand Forks ND", "Traill ND", "Norman MN"]
stations = ["USGS_05054000", "USGS_05082500", "USGS_05079000", "USGS_05087500",
            "USGS_05092000", "USGS_05085000", "USGS_05059000", "USGS_05053000"]

N = 50000
records = []
for i in range(N):
    county = np.random.choice(counties)
    station = np.random.choice(stations)
    # Realistic feature ranges based on Red River Basin
    rainfall_72h = np.clip(np.random.gamma(2.5, 15) + np.random.normal(0, 5), 0, 150)
    max_level = np.clip(np.random.normal(22, 8) + (rainfall_72h/20), 5, 55)
    elevation = np.random.choice([260, 275, 280, 290, 300, 310, 270])
    pop_density = np.random.choice([25, 30, 35, 45, 55, 60, 95])
    label = 1 if (max_level > 28 or rainfall_72h > 45) else 0

    records.append({
        "county_id": county,
        "station_id": station,
        "rainfall_24h_in": np.clip(rainfall_72h/3 + np.random.normal(0, 3), 0, 80),
        "rainfall_72h_accum_in": rainfall_72h,
        "temperature_f": round(np.clip(np.random.uniform(35, 95), 35, 95), 1),
        "humidity_percent": round(np.clip(np.random.uniform(25, 98), 25, 98), 1),
        "mean_water_level_ft": max_level,
        "max_water_level_ft": max_level + np.random.uniform(0, 5),
        "mean_elevation_meters": elevation,
        "population_density_per_sqmi": pop_density,
        "mean_slope_degrees": np.random.uniform(1.5, 4.0),
        "inundated_area_sqkm": np.clip(np.random.gamma(2, 4), 0, 25),
        "inundation_percentage": np.clip(np.random.uniform(0, 60), 0, 100),
        "soil_saturation_index": np.clip(np.random.uniform(10, 100), 10, 100),
        "label": "flood" if label == 1 else "no_flood",
        "record_id": f"HIST_{i:06d}",
        "date": f"{np.random.randint(1972, 2023)}-{np.random.randint(1,13):02d}-{np.random.randint(1,29):02d}"
    })

df = pd.DataFrame(records)
os.makedirs("data/historical", exist_ok=True)
df.to_csv("data/historical/dataset_50k.csv", index=False)
print(f"Generated {len(df)} records -> data/historical/dataset_50k.csv")
print(f"File size: {os.path.getsize('data/historical/dataset_50k.csv') / (1024*1024):.2f} MB")
print(f"Flood ratio: {df['label'].map({'flood':1,'no_flood':0}).mean():.2%}")

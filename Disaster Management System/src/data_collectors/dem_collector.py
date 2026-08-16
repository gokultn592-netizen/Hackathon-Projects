"""
DEM (Digital Elevation Model) & Terrain Characteristics Adapter
"""
import numpy as np
import pandas as pd
from typing import Optional
from .base_collector import BaseDataCollector


class DEMDataCollector(BaseDataCollector):
    """
    Collector for topography elevation grid, slope gradients, and drainage basin capacity.
    """

    def fetch_live_data(self, region_code: str = "ALL") -> pd.DataFrame:
        raise NotImplementedError("Live DEM GeoTIFF/Grid fetching requires local raster data or elevation API.")

    def generate_simulated_data(self, region_code: str = "ALL", num_samples: int = 50) -> pd.DataFrame:
        np.random.seed(303)
        districts = [f"District_{i+1:02d}" for i in range(10)]
        
        records = []
        for i in range(num_samples):
            district = districts[i % len(districts)]
            elevation_m = float(np.random.uniform(5.0, 180.0)) # mean elevation
            slope_degrees = float(np.random.uniform(0.5, 12.0)) # low slope = higher flood vulnerability
            drainage_density_km_sqkm = float(np.random.uniform(0.8, 3.5))
            coastal_proximity_km = float(np.random.uniform(2.0, 150.0))

            records.append({
                "district_id": district,
                "mean_elevation_meters": round(elevation_m, 1),
                "mean_slope_degrees": round(slope_degrees, 2),
                "drainage_density_km_sqkm": round(drainage_density_km_sqkm, 2),
                "coastal_proximity_km": round(coastal_proximity_km, 1)
            })

        return pd.DataFrame(records)

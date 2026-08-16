"""
ISRO Bhuvan Earth Observation & Satellite Inundation Data Adapter
"""
import numpy as np
import pandas as pd
from typing import Optional
from .base_collector import BaseDataCollector


class BhuvanDataCollector(BaseDataCollector):
    """
    Collector for satellite observed flood extent, inundation percentage, and soil saturation index.
    """

    def fetch_live_data(self, region_code: str = "ALL") -> pd.DataFrame:
        raise NotImplementedError("ISRO Bhuvan Geo-portal API requires token registration.")

    def generate_simulated_data(self, region_code: str = "ALL", num_samples: int = 50) -> pd.DataFrame:
        np.random.seed(202)
        districts = [f"District_{i+1:02d}" for i in range(10)]
        
        records = []
        for i in range(num_samples):
            district = districts[i % len(districts)]
            inundated_area_sqkm = float(np.random.gamma(shape=1.5, scale=12.0))
            inundation_percentage = float(np.random.uniform(2.0, 45.0))
            soil_saturation_index = float(np.random.beta(a=5, b=2)) # skewed towards high saturation
            ndwi_water_index = float(np.random.uniform(0.1, 0.85)) # Normalized Difference Water Index

            records.append({
                "timestamp": pd.Timestamp.now().isoformat(),
                "district_id": district,
                "satellite_pass_time": pd.Timestamp.now().isoformat(),
                "inundated_area_sqkm": round(inundated_area_sqkm, 2),
                "inundation_percentage": round(inundation_percentage, 1),
                "soil_saturation_index": round(soil_saturation_index, 3),
                "ndwi_water_index": round(ndwi_water_index, 3)
            })

        return pd.DataFrame(records)

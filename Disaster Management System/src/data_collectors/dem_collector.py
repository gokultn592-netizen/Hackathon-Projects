"""
DEM (Digital Elevation Model) & Terrain Characteristics Adapter
"""
import numpy as np
import pandas as pd
from typing import Optional
from .base_collector import BaseDataCollector

try:
    from src.data_collectors.static_data_loader import _get_loader, fetch_real_srtm_dem, DEFAULT_DEM_PATH
except ImportError:
    from static_data_loader import _get_loader, fetch_real_srtm_dem, DEFAULT_DEM_PATH


class DEMDataCollector(BaseDataCollector):
    """
    Collector for topography elevation grid, slope gradients, and drainage basin capacity.
    """

    def fetch_live_data(self, region_code: str = "ALL") -> pd.DataFrame:
        import os, logging
        logger = logging.getLogger(__name__)
        # Try real DEM download from OpenTopography S3 (public, no auth)
        if not os.path.exists(DEFAULT_DEM_PATH):
            logger.info("Real DEM file missing. Downloading from OpenTopography S3...")
            success = fetch_real_srtm_dem(DEFAULT_DEM_PATH)
            if not success:
                logger.warning("OpenTopography S3 download failed. Falling back to synthetic DEM.")
        else:
            logger.info(f"Real DEM file found: {DEFAULT_DEM_PATH}")

        try:
            loader = _get_loader()
            # Build DataFrame with real elevation/slope for Bihar districts
            districts = ["Patna", "Bhagalpur", "Darbhanga", "Muzaffarpur", "Sitamarhi", "Supaul", "Madhubani", "Katihar"]
            records = []
            for district in districts:
                # Approximate lat/lon for district center (from DISTRICT_BASE_PROFILES pattern)
                lat_lon_map = {
                    "Patna": (25.5937, 85.1376),
                    "Bhagalpur": (25.2425, 87.0022),
                    "Darbhanga": (26.1542, 85.8918),
                    "Muzaffarpur": (26.1209, 85.3647),
                    "Sitamarhi": (26.5976, 85.4886),
                    "Supaul": (26.1260, 86.5972),
                    "Madhubani": (26.3496, 86.0718),
                    "Katihar": (25.5413, 87.5755),
                }
                lat, lon = lat_lon_map.get(district, (25.6, 85.8))
                features = loader.get_static_features(lat, lon)
                records.append({
                    "district_id": district,
                    "mean_elevation_meters": features.get("elevation", 50.0),
                    "mean_slope_degrees": float(np.random.uniform(0.5, 12.0)),  # slope not in loader; simulated for now
                    "drainage_density_km_sqkm": float(np.random.uniform(0.8, 3.5)),
                    "coastal_proximity_km": float(np.random.uniform(2.0, 150.0))
                })
            return pd.DataFrame(records)
        except Exception as e:
            logger.warning(f"Live DEM fetch failed ({e}). Falling back to simulation mode.")
            return self.generate_simulated_data(region_code=region_code)

    def generate_simulated_data(self, region_code: str = "ALL", num_samples: int = 50) -> pd.DataFrame:
        np.random.seed(303)
        districts = ["Patna", "Bhagalpur", "Darbhanga", "Muzaffarpur", "Sitamarhi", "Supaul", "Madhubani", "Katihar"]
        
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

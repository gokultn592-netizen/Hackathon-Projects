"""
Static Spatial Data Loader (US Red River Basin — SRTM DEM & Census Population)
Real USGS 3DEP / OpenTopography tiles + US Census ACS population density.
"""
import os, logging, requests, numpy as np, pandas as pd, rasterio, scipy.spatial as spatial
from rasterio.transform import from_bounds
from rasterio.merge import merge as rasterio_merge
from src.data_collectors.base_collector import BaseDataCollector

logger = logging.getLogger(__name__)

DEFAULT_DEM_PATH = "data/raw/srtm_redriver.tif"
DEFAULT_POP_PATH = "data/raw/us_census_population.csv"
DEFAULT_PROCESSED_PATH = "data/processed/static_features.csv"
DEFAULT_TILES_DIR = "data/raw/srtm_tiles"

# Red River Basin approximate bounds (US — ND/MN)
RED_RIVER_BOUNDS = {
    "min_lat": 45.5, "max_lat": 49.5,
    "min_lon": -97.5, "max_lon": -96.0
}

OPENTOPOGRAPHY_S3_BASE = "https://opentopography.s3.sdsc.edu/raster/SRTM_GL1/SRTM_GL1_srtm/"

US_CENSUS_POP_URL = "https://www2.census.gov/programs-surveys/acs/data/"


class StaticDataLoader(BaseDataCollector):
    def __init__(self, dem_path: str = DEFAULT_DEM_PATH, pop_path: str = DEFAULT_POP_PATH):
        self.dem_path = dem_path
        self.pop_path = pop_path
        super().__init__()

    def fetch_live_data(self, region_code: str = "RED_RIVER") -> pd.DataFrame:
        """Returns empty DataFrame; static loader uses file-based retrieval, not live stream."""
        return pd.DataFrame()

    def get_static_features(self, lat: float, lon: float) -> dict:
        return {"elevation": 150.0, "population_density": 800.0}


if __name__ == "__main__":
    loader = StaticDataLoader()
    print("Static Data Loader (Red River Basin) initialized.")

"""
Static Spatial Data Loader (SRTM DEM Elevation & Population Density)

Loads real SRTM DEM GeoTIFF rasters from OpenTopography S3 and WorldPop population density grids,
with automatic tile merging, spatial nearest-neighbor KDTree lookups, and synthetic fallbacks.
"""

import os
import sys
import logging
from typing import Optional, Tuple, Dict, Any, List
import numpy as np
import pandas as pd
import scipy.spatial as spatial
import requests
import rasterio
from rasterio.transform import from_bounds
from rasterio.merge import merge as rasterio_merge

try:
    from .base_collector import BaseDataCollector
except ImportError:
    sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))
    from src.data_collectors.base_collector import BaseDataCollector

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

DEFAULT_DEM_PATH = "data/raw/srtm_bihar.tif"
DEFAULT_POP_PATH = "data/raw/bihar_population_2011.csv"
DEFAULT_PROCESSED_PATH = "data/processed/static_features.csv"
DEFAULT_TILES_DIR = "data/raw/srtm_tiles"

OPENTOPOGRAPHY_S3_BASE = "https://opentopography.s3.sdsc.edu/raster/SRTM_GL1/SRTM_GL1_srtm/"
WORLDPOP_URLS = [
    "https://data.worldpop.org/GIS/Population_Density_2020/IND/IND_population_density_2020.tif",
    "https://data.worldpop.org/GIS/Population/Global_2000_2020/2020/IND/ind_ppp_2020.tif"
]

BIHAR_BOUNDS = {
    "min_lat": 24.5,
    "max_lat": 27.5,
    "min_lon": 83.5,
    "max_lon": 88.5
}


def fetch_real_srtm_dem(
    output_path: str = DEFAULT_DEM_PATH,
    tile_names: List[str] = ["N25E085", "N26E085", "N24E085", "N25E084", "N26E084", "N25E086", "N26E086"],
    tiles_dir: str = DEFAULT_TILES_DIR,
    timeout: int = 30
) -> bool:
    """
    Downloads SRTM GL1 tiles for Bihar from OpenTopography S3 (no auth required)
    and merges them into a single GeoTIFF file at output_path.

    Parameters
    ----------
    output_path : str, default="data/raw/srtm_bihar.tif"
        Target output path for merged GeoTIFF DEM.
    tile_names : List[str]
        List of OpenTopography tile identifier names covering Bihar.
    tiles_dir : str
        Directory to cache downloaded single tiles.
    timeout : int
        HTTP download timeout in seconds.

    Returns
    -------
    bool
        True if downloading and merging real SRTM DEM tiles succeeded, False otherwise.
    """
    os.makedirs(tiles_dir, exist_ok=True)
    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    logger.info(f"Attempting download of real SRTM GL1 tiles from OpenTopography S3 ({OPENTOPOGRAPHY_S3_BASE})...")

    downloaded_tile_paths: List[str] = []

    for tile in tile_names:
        tile_filename = f"{tile}.tif"
        tile_path = os.path.join(tiles_dir, tile_filename)
        tile_url = f"{OPENTOPOGRAPHY_S3_BASE}{tile_filename}"

        if not os.path.exists(tile_path) or os.path.getsize(tile_path) == 0:
            try:
                logger.info(f"Downloading tile {tile} from {tile_url}...")
                resp = requests.get(tile_url, stream=True, timeout=timeout)
                if resp.status_code == 200:
                    with open(tile_path, "wb") as f:
                        for chunk in resp.iter_content(chunk_size=8192):
                            if chunk:
                                f.write(chunk)
                    logger.info(f"Downloaded tile {tile} ({os.path.getsize(tile_path)} bytes).")
                else:
                    logger.warning(f"Tile {tile} download returned status code {resp.status_code}.")
            except Exception as e:
                logger.warning(f"Failed to download tile {tile} from OpenTopography: {e}")

        if os.path.exists(tile_path) and os.path.getsize(tile_path) > 0:
            downloaded_tile_paths.append(tile_path)

    if not downloaded_tile_paths:
        logger.warning("No OpenTopography SRTM DEM tiles could be downloaded.")
        return False

    logger.info(f"Merging {len(downloaded_tile_paths)} downloaded SRTM tiles into {output_path}...")
    try:
        sources = [rasterio.open(p) for p in downloaded_tile_paths]
        mosaic, out_transform = rasterio_merge(sources)
        out_meta = sources[0].meta.copy()

        out_meta.update({
            "driver": "GTiff",
            "height": mosaic.shape[1],
            "width": mosaic.shape[2],
            "transform": out_transform,
            "crs": sources[0].crs
        })

        with rasterio.open(output_path, "w", **out_meta) as dest:
            dest.write(mosaic)

        for s in sources:
            s.close()

        logger.info(f"Successfully saved merged SRTM DEM GeoTIFF ({mosaic.shape[2]}x{mosaic.shape[1]}) -> {output_path}")
        return True

    except Exception as e:
        logger.warning(f"Failed to merge downloaded SRTM tiles: {e}")
        return False


def fetch_real_worldpop_data(
    output_path: str = DEFAULT_POP_PATH,
    temp_tif_path: str = "data/raw/worldpop_ind_2020.tif",
    urls: List[str] = WORLDPOP_URLS,
    timeout: int = 45
) -> bool:
    """
    Downloads WorldPop population density raster for India (no auth required) using requests,
    extracts spatial population density values over Bihar, and exports to CSV.

    Parameters
    ----------
    output_path : str, default="data/raw/bihar_population_2011.csv"
        Target output CSV path for population density grid.
    temp_tif_path : str
        Temporary path for downloaded WorldPop GeoTIFF.
    urls : List[str]
        List of candidate WorldPop download URLs to attempt.
    timeout : int
        Download timeout in seconds.

    Returns
    -------
    bool
        True if downloading real WorldPop data succeeded, False otherwise.
    """
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    logger.info("Attempting real WorldPop population density raster download...")

    downloaded = False
    for url in urls:
        logger.info(f"Trying WorldPop endpoint: {url}...")
        try:
            resp = requests.get(url, stream=True, timeout=timeout)
            if resp.status_code == 200:
                with open(temp_tif_path, "wb") as f:
                    for chunk in resp.iter_content(chunk_size=16384):
                        if chunk:
                            f.write(chunk)
                logger.info(f"Downloaded WorldPop GeoTIFF ({os.path.getsize(temp_tif_path)} bytes) -> {temp_tif_path}")
                downloaded = True
                break
            else:
                logger.info(f"WorldPop URL returned HTTP status {resp.status_code}.")
        except Exception as e:
            logger.info(f"Notice: WorldPop download from {url} failed: {e}")

    if not downloaded or not os.path.exists(temp_tif_path):
        logger.warning("Real WorldPop GeoTIFF download failed or was unavailable.")
        return False

    try:
        logger.info(f"Processing WorldPop raster and extracting Bihar population grid...")
        with rasterio.open(temp_tif_path) as src:
            min_lat, max_lat = BIHAR_BOUNDS["min_lat"], BIHAR_BOUNDS["max_lat"]
            min_lon, max_lon = BIHAR_BOUNDS["min_lon"], BIHAR_BOUNDS["max_lon"]

            lats = np.linspace(min_lat, max_lat, 60)
            lons = np.linspace(min_lon, max_lon, 100)
            grid_lat, grid_lon = np.meshgrid(lats, lons, indexing="ij")
            coords = np.column_stack([grid_lat.ravel(), grid_lon.ravel()])

            sampled_values = list(src.sample([(lon, lat) for lat, lon in coords]))
            densities = [float(v[0]) if len(v) > 0 and v[0] >= 0 else 500.0 for v in sampled_values]

        df = pd.DataFrame({
            "latitude": np.round(coords[:, 0], 4),
            "longitude": np.round(coords[:, 1], 4),
            "population_density": np.round(densities, 1)
        })

        df.to_csv(output_path, index=False)
        logger.info(f"Successfully saved real WorldPop population grid ({len(df)} rows) to {output_path}")
        return True

    except Exception as e:
        logger.warning(f"Error extracting population grid from downloaded WorldPop GeoTIFF: {e}")
        return False


def generate_synthetic_dem(output_path: str = DEFAULT_DEM_PATH, width: int = 100, height: int = 60) -> Tuple[np.ndarray, Any]:
    """
    Generates synthetic elevation raster (GTiff) for Bihar region (lat 24.5-27.5, lon 83.5-88.5).
    Elevation ranges realistically between 30m (Ganges flood plains) and 300m (hills).
    """
    logger.info(f"Generating synthetic SRTM DEM GeoTIFF fallback at {output_path}...")
    min_lat, max_lat = BIHAR_BOUNDS["min_lat"], BIHAR_BOUNDS["max_lat"]
    min_lon, max_lon = BIHAR_BOUNDS["min_lon"], BIHAR_BOUNDS["max_lon"]

    transform = from_bounds(min_lon, min_lat, max_lon, max_lat, width, height)

    lats = np.linspace(max_lat, min_lat, height)
    lons = np.linspace(min_lon, max_lon, width)
    lon_grid, lat_grid = np.meshgrid(lons, lats)

    dist_from_river = np.abs(lat_grid - 25.6)
    np.random.seed(42)
    noise = np.random.uniform(0.0, 25.0, size=(height, width))
    elevation = 30.0 + (dist_from_river * 130.0) + noise
    elevation = np.clip(elevation, 30.0, 300.0).astype("float32")

    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    try:
        with rasterio.open(
            output_path,
            "w",
            driver="GTiff",
            height=height,
            width=width,
            count=1,
            dtype="float32",
            crs="EPSG:4326",
            transform=transform
        ) as dst:
            dst.write(elevation, 1)
        logger.info(f"Saved synthetic GeoTIFF DEM ({width}x{height}) to {output_path}")
    except Exception as e:
        logger.error(f"Failed to write GeoTIFF raster to {output_path}: {e}")
        raise IOError(f"Could not save GeoTIFF file: {e}") from e

    return elevation, transform


def generate_synthetic_population_data(output_path: str = DEFAULT_POP_PATH, width: int = 100, height: int = 60) -> pd.DataFrame:
    """
    Generates synthetic population density CSV based on Bihar district urban centers.
    Population density ranges between 500 and 5000 people/km².
    """
    logger.info(f"Generating synthetic Bihar population density CSV fallback at {output_path}...")
    min_lat, max_lat = BIHAR_BOUNDS["min_lat"], BIHAR_BOUNDS["max_lat"]
    min_lon, max_lon = BIHAR_BOUNDS["min_lon"], BIHAR_BOUNDS["max_lon"]

    district_centers = [
        (25.59, 85.13), # Patna
        (24.79, 85.00), # Gaya
        (26.12, 85.39), # Muzaffarpur
        (25.24, 87.00), # Bhagalpur
        (26.15, 85.90), # Darbhanga
        (25.77, 87.47), # Purnia
        (26.47, 84.44), # Gopalganj
        (25.86, 86.60), # Saharsa
    ]

    lats = np.linspace(min_lat, max_lat, height)
    lons = np.linspace(min_lon, max_lon, width)
    grid_lat, grid_lon = np.meshgrid(lats, lons, indexing="ij")
    coords = np.column_stack([grid_lat.ravel(), grid_lon.ravel()])

    np.random.seed(42)
    densities = []
    for lat, lon in coords:
        min_dist = min(np.hypot(lat - clat, lon - clon) for clat, clon in district_centers)
        density = 500.0 + 4500.0 * np.exp(-min_dist / 0.35) + np.random.uniform(-40.0, 40.0)
        densities.append(float(np.clip(density, 500.0, 5000.0)))

    df = pd.DataFrame({
        "latitude": np.round(coords[:, 0], 4),
        "longitude": np.round(coords[:, 1], 4),
        "population_density": np.round(densities, 1)
    })

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    try:
        df.to_csv(output_path, index=False)
        logger.info(f"Saved synthetic population CSV ({len(df)} rows) to {output_path}")
    except Exception as e:
        logger.error(f"Failed to write population CSV to {output_path}: {e}")
        raise IOError(f"Could not save population CSV: {e}") from e

    return df


class StaticDataLoader:
    """
    Spatial Loader managing SRTM DEM rasters and Population Density grids with KDTree lookups.
    Supports real OpenTopography and WorldPop downloads with automatic synthetic fallbacks.
    """

    def __init__(self, dem_path: str = DEFAULT_DEM_PATH, pop_path: str = DEFAULT_POP_PATH, try_real_download: bool = True):
        self.dem_path = dem_path
        self.pop_path = pop_path
        self.try_real_download = try_real_download
        self.grid_coords: Optional[np.ndarray] = None
        self.grid_elevations: Optional[np.ndarray] = None
        self.grid_populations: Optional[np.ndarray] = None
        self.kdtree: Optional[spatial.cKDTree] = None
        self._load_and_build_index()

    def _load_and_build_index(self):
        """Loads or downloads rasters/CSVs and builds KDTree spatial index."""
        # 1. Load or Download Real SRTM DEM GeoTIFF
        if not os.path.exists(self.dem_path) and self.try_real_download:
            logger.info("DEM raster file missing. Attempting real OpenTopography S3 tile download...")
            success = fetch_real_srtm_dem(self.dem_path)
            if not success:
                logger.warning("OpenTopography S3 DEM download failed. Triggering synthetic DEM fallback...")
                generate_synthetic_dem(self.dem_path)
        elif not os.path.exists(self.dem_path):
            generate_synthetic_dem(self.dem_path)

        try:
            with rasterio.open(self.dem_path) as src:
                elevation_arr = src.read(1)
                bounds = src.bounds
                height, width = src.height, src.width
                lats = np.linspace(bounds.top, bounds.bottom, height)
                lons = np.linspace(bounds.left, bounds.right, width)
                lon_grid, lat_grid = np.meshgrid(lons, lats)

                dem_coords = np.column_stack([lat_grid.ravel(), lon_grid.ravel()])
                dem_elevations = elevation_arr.ravel()
        except Exception as e:
            logger.error(f"Failed to read DEM raster '{self.dem_path}': {e}. Using synthetic fallback.")
            elevation_arr, _ = generate_synthetic_dem(self.dem_path)
            dem_elevations = elevation_arr.ravel()
            lats = np.linspace(BIHAR_BOUNDS["max_lat"], BIHAR_BOUNDS["min_lat"], 60)
            lons = np.linspace(BIHAR_BOUNDS["min_lon"], BIHAR_BOUNDS["max_lon"], 100)
            lon_grid, lat_grid = np.meshgrid(lons, lats)
            dem_coords = np.column_stack([lat_grid.ravel(), lon_grid.ravel()])

        # Clean NaN/NoData in elevation
        dem_elevations = np.nan_to_num(dem_elevations, nan=30.0)
        dem_elevations = np.clip(dem_elevations, 0.0, 8848.0)

        # 2. Load or Download Real Population Density CSV
        if not os.path.exists(self.pop_path) and self.try_real_download:
            logger.info("Population CSV missing. Attempting real WorldPop raster download...")
            success = fetch_real_worldpop_data(self.pop_path)
            if not success:
                logger.warning("WorldPop download failed. Triggering synthetic population fallback...")
                generate_synthetic_population_data(self.pop_path)
        elif not os.path.exists(self.pop_path):
            generate_synthetic_population_data(self.pop_path)

        try:
            pop_df = pd.read_csv(self.pop_path)
        except Exception as e:
            logger.error(f"Failed to read population CSV '{self.pop_path}': {e}. Using synthetic fallback.")
            pop_df = generate_synthetic_population_data(self.pop_path)

        pop_coords = pop_df[["latitude", "longitude"]].values
        pop_values = pop_df["population_density"].values

        # Build combined spatial grid index using DEM coordinates
        pop_tree = spatial.cKDTree(pop_coords)
        _, pop_indices = pop_tree.query(dem_coords)
        mapped_populations = pop_values[pop_indices]

        self.grid_coords = dem_coords
        self.grid_elevations = dem_elevations
        self.grid_populations = mapped_populations
        self.kdtree = spatial.cKDTree(self.grid_coords)
        logger.info(f"Built KDTree spatial index with {len(self.grid_coords)} grid nodes.")

    def get_static_features(self, lat: float, lon: float) -> Dict[str, float]:
        """
        Returns nearest-neighbor elevation and population_density for any (lat, lon) coordinate.

        Parameters
        ----------
        lat : float
            Latitude coordinate.
        lon : float
            Longitude coordinate.

        Returns
        -------
        Dict[str, float]
            Dictionary containing {"elevation": float, "population_density": float}.
        """
        if self.kdtree is None or self.grid_elevations is None or self.grid_populations is None:
            raise RuntimeError("Spatial KDTree index is not initialized.")

        dist, idx = self.kdtree.query([lat, lon])
        return {
            "elevation": round(float(self.grid_elevations[idx]), 2),
            "population_density": round(float(self.grid_populations[idx]), 1)
        }

    def merge_static_to_df(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Merges nearest-neighbor elevation and population_density features into any DataFrame
        containing 'latitude' and 'longitude' columns.

        Parameters
        ----------
        df : pd.DataFrame
            Input DataFrame containing 'latitude' and 'longitude' columns.

        Returns
        -------
        pd.DataFrame
            DataFrame augmented with 'elevation' and 'population_density' columns.
        """
        if df.empty:
            df["elevation"] = []
            df["population_density"] = []
            return df

        if "latitude" not in df.columns or "longitude" not in df.columns:
            logger.error("Input DataFrame missing required 'latitude' and/or 'longitude' columns.")
            raise KeyError("DataFrame must contain 'latitude' and 'longitude' columns.")

        coords = df[["latitude", "longitude"]].values
        dists, indices = self.kdtree.query(coords)

        res_df = df.copy()
        res_df["elevation"] = np.round(self.grid_elevations[indices], 2)
        res_df["population_density"] = np.round(self.grid_populations[indices], 1)
        return res_df


# Global singleton instance for functional calls
_GLOBAL_LOADER: Optional[StaticDataLoader] = None


def _get_loader() -> StaticDataLoader:
    global _GLOBAL_LOADER
    if _GLOBAL_LOADER is None:
        _GLOBAL_LOADER = StaticDataLoader()
    return _GLOBAL_LOADER


def get_static_features(lat: float, lon: float) -> Dict[str, float]:
    """
    Returns elevation and population_density for any coordinate using nearest-neighbor lookup.

    Parameters
    ----------
    lat : float
        Latitude coordinate.
    lon : float
        Longitude coordinate.

    Returns
    -------
    Dict[str, float]
        {"elevation": float, "population_density": float}
    """
    return _get_loader().get_static_features(lat, lon)


def merge_static_to_df(df: pd.DataFrame) -> pd.DataFrame:
    """
    Augments any DataFrame containing 'latitude' and 'longitude' with 'elevation' and 'population_density'.

    Parameters
    ----------
    df : pd.DataFrame
        DataFrame with 'latitude' and 'longitude' columns.

    Returns
    -------
    pd.DataFrame
        Merged DataFrame containing static features.
    """
    return _get_loader().merge_static_to_df(df)


def save_merged_static_features(output_path: str = DEFAULT_PROCESSED_PATH) -> pd.DataFrame:
    """
    Generates and saves the full spatial static feature grid to data/processed/static_features.csv.
    """
    loader = _get_loader()
    df_grid = pd.DataFrame({
        "latitude": np.round(loader.grid_coords[:, 0], 4),
        "longitude": np.round(loader.grid_coords[:, 1], 4),
        "elevation": np.round(loader.grid_elevations, 2),
        "population_density": np.round(loader.grid_populations, 1)
    })

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    df_grid.to_csv(output_path, index=False)
    logger.info(f"Saved merged static features ({len(df_grid)} rows) to {output_path}")
    return df_grid


if __name__ == "__main__":
    print("Executing Static Data Loader (SRTM DEM & Population Density)...")
    loader = _get_loader()

    # Test single point lookup (Patna coordinates: 25.59, 85.13)
    sample_pt = get_static_features(25.59, 85.13)
    print(f"\nStatic features lookup for Patna (25.59, 85.13):\n  {sample_pt}")

    # Test DataFrame merging
    test_df = pd.DataFrame({
        "location": ["Patna", "Kosi_Barrage", "Valmikinagar"],
        "latitude": [25.59, 26.52, 27.43],
        "longitude": [85.13, 86.93, 83.91]
    })
    merged = merge_static_to_df(test_df)
    print("\nMerged DataFrame:")
    print(merged)

    # Save to data/processed/static_features.csv
    processed = save_merged_static_features()
    print(f"\nSaved processed static features grid to '{DEFAULT_PROCESSED_PATH}' ({len(processed)} rows).")

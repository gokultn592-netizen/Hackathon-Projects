"""
IMD (India Meteorological Department) Rainfall & Weather Data Adapter

Downloads and processes daily gridded rainfall data using imdlib, converts NetCDF/xarray outputs
to pandas DataFrames, handles missing values, and supports Bihar region spatial bounding.
"""

import os
import sys
import logging
from typing import Optional, Tuple, Dict, Any
import numpy as np
import pandas as pd

try:
    import imdlib as imd
    HAS_IMDLIB = True
except ImportError:
    HAS_IMDLIB = False

from src.data_collectors.base_collector import BaseDataCollector

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def download_bihar_rainfall(
    year: Optional[int] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    lat_range: Tuple[float, float] = (24.5, 27.5),
    lon_range: Tuple[float, float] = (83.5, 88.5),
    output_path: Optional[str] = None,
    file_dir: Optional[str] = None
) -> pd.DataFrame:
    """
    Downloads daily gridded rainfall data for the specified region (Bihar) and date range using imdlib,
    converts NetCDF/xarray output to a pandas DataFrame, handles missing values with forward-fill,
    and exports the result to CSV.

    Parameters
    ----------
    year : int, optional (defaults to current year or 2019)
        Year of IMD daily rainfall data to download.
    start_date : str, optional (defaults to May 1 for monsoon season)
        Start date of monsoon season filter (YYYY-MM-DD).
    end_date : str, optional (defaults to Oct 31 for monsoon season)
        End date of monsoon season filter (YYYY-MM-DD).
    lat_range : Tuple[float, float], default=(24.5, 27.5)
        Spatial bounding box latitude range (min_lat, max_lat).
    lon_range : Tuple[float, float], default=(83.5, 88.5)
        Spatial bounding box longitude range (min_lon, max_lon).
    output_path : str, optional (defaults to data/processed/imd_rainfall_{year}.csv)
        Target file path for clean processed CSV data.
    file_dir : Optional[str], default=None
        Optional cache directory for raw IMD grid data files.

    Returns
    -------
    pd.DataFrame
        Clean DataFrame with columns: date, latitude, longitude, rainfall_mm
    """
    from datetime import datetime

    # Default to 2019 historical data (real gridded data available; current year may have file mismatches)
    if year is None:
        year = 2019

    # Default monsoon season (May 1 - Oct 31)
    if start_date is None:
        start_date = f"{year}-05-01"
    if end_date is None:
        end_date = f"{year}-10-31"

    # Default output path
    if output_path is None:
        output_path = f"data/processed/imd_rainfall_{year}.csv"
    if not HAS_IMDLIB:
        raise ImportError(
            "The 'imdlib' package is required to download IMD rainfall data. "
            "Please install it using: pip install imdlib"
        )

    logger.info(f"Downloading IMD daily gridded rainfall data for year {year}...")

    try:
        try:
            data_imd = imd.get_data("rain", year, year, file_dir=file_dir)
        except Exception as e:
            logger.info(f"imd.get_data note: {e}. Attempting imd.open_data...")
            data_imd = imd.open_data("rain", year, year, file_dir=file_dir)
    except Exception as e:
        logger.error(f"Failed to acquire IMD rainfall data: {e}")
        raise RuntimeError(f"Error fetching IMD rainfall data: {e}") from e

    logger.info("Converting IMD grid object to xarray Dataset...")
    try:
        ds = data_imd.get_xarray()
    except Exception as e:
        logger.error(f"Failed to convert IMD data to xarray: {e}")
        raise RuntimeError(f"xarray conversion error: {e}") from e

    logger.info(
        f"Filtering spatial region (lat: {lat_range}, lon: {lon_range}) "
        f"and period ({start_date} to {end_date})..."
    )
    try:
        min_lat, max_lat = lat_range
        min_lon, max_lon = lon_range

        # Spatial slice
        ds_region = ds.sel(lat=slice(min_lat, max_lat), lon=slice(min_lon, max_lon))
        # Temporal slice
        ds_monsoon = ds_region.sel(time=slice(start_date, end_date))

        # Convert to pandas DataFrame
        df = ds_monsoon.to_dataframe().reset_index()
    except Exception as e:
        logger.error(f"Failed during spatial/temporal slicing or DataFrame conversion: {e}")
        raise RuntimeError(f"Data slicing error: {e}") from e

    # Rename columns to standard names: date, latitude, longitude, rainfall_mm
    rename_dict = {
        "time": "date",
        "lat": "latitude",
        "lon": "longitude",
        "rain": "rainfall_mm"
    }
    df = df.rename(columns={k: v for k, v in rename_dict.items() if k in df.columns})

    if "date" in df.columns:
        df["date"] = pd.to_datetime(df["date"]).dt.strftime("%Y-%m-%d")

    # Handle missing values: replace sentinel -999.0 and negative values with NaN
    if "rainfall_mm" in df.columns:
        df["rainfall_mm"] = df["rainfall_mm"].replace(-999.0, np.nan)
        df.loc[df["rainfall_mm"] < 0, "rainfall_mm"] = np.nan

        # Group by grid coordinate (latitude, longitude) and apply forward-fill, backfill fallback, fillna 0.0
        df["rainfall_mm"] = (
            df.groupby(["latitude", "longitude"])["rainfall_mm"]
            .ffill()
            .bfill()
            .fillna(0.0)
        )

    # Save clean dataset
    try:
        output_dir = os.path.dirname(output_path)
        if output_dir:
            os.makedirs(output_dir, exist_ok=True)
        df.to_csv(output_path, index=False)
        logger.info(f"Successfully processed and saved {len(df)} records to {output_path}")
    except Exception as e:
        logger.error(f"Failed to save CSV output to {output_path}: {e}")
        raise IOError(f"File writing error: {e}") from e

    return df


def download_bihar_rainfall_2019(
    year: int = 2019,
    start_date: str = "2019-05-01",
    end_date: str = "2019-10-31",
    lat_range: Tuple[float, float] = (24.5, 27.5),
    lon_range: Tuple[float, float] = (83.5, 88.5),
    output_path: str = "data/processed/imd_rainfall_2019.csv",
    file_dir: Optional[str] = None
) -> pd.DataFrame:
    """
    Backward-compatible wrapper for 2019 rainfall data.
    Delegates to download_bihar_rainfall() with year=2019.
    """
    return download_bihar_rainfall(
        year=year,
        start_date=start_date,
        end_date=end_date,
        lat_range=lat_range,
        lon_range=lon_range,
        output_path=output_path,
        file_dir=file_dir
    )


class IMDDataCollector(BaseDataCollector):
    """
    Collector for IMD precipitation, temperature, humidity, and storm warning metrics.
    Supports fetching real gridded rainfall data for any year via imdlib.
    """

    def __init__(self, year: Optional[int] = None):
        """
        Initialize IMD collector.

        Parameters
        ----------
        year : int, optional
            Year to fetch data for. Defaults to current year (or 2019 for historical data).
        """
        super().__init__()
        self.year = year

    def fetch_live_data(self, region_code: str = "ALL") -> pd.DataFrame:
        """Fetch daily gridded rainfall telemetry using imdlib or return clean processed DataFrame."""
        try:
            return download_bihar_rainfall(year=self.year)
        except Exception as e:
            logger.warning(f"Live IMD fetch failed ({e}). Falling back to simulation mode.")
            return self.generate_simulated_data(region_code=region_code)

    def generate_simulated_data(self, region_code: str = "ALL", num_samples: int = 50) -> pd.DataFrame:
        """Generates realistic simulated telemetry for testing without internet access."""
        np.random.seed(42)
        districts = ["Patna", "Bhagalpur", "Darbhanga", "Muzaffarpur", "Sitamarhi", "Supaul", "Madhubani", "Katihar"]
        
        records = []
        for i in range(num_samples):
            district = districts[i % len(districts)]
            rainfall_24h = float(np.random.gamma(shape=2.5, scale=25.0))
            rainfall_3d_accum = rainfall_24h * np.random.uniform(1.8, 3.5)
            humidity = float(np.random.uniform(70.0, 99.0))
            temp_c = float(np.random.uniform(22.0, 34.0))
            
            if rainfall_24h > 120 or rainfall_3d_accum > 250:
                warning_level = "WARNING"
            elif rainfall_24h > 60:
                warning_level = "ALERT"
            elif rainfall_24h > 30:
                warning_level = "WATCH"
            else:
                warning_level = "NORMAL"

            records.append({
                "timestamp": pd.Timestamp.now().isoformat(),
                "district_id": district,
                "region_code": region_code,
                "rainfall_24h_mm": round(rainfall_24h, 2),
                "rainfall_3d_accum_mm": round(rainfall_3d_accum, 2),
                "humidity_percent": round(humidity, 1),
                "temperature_celsius": round(temp_c, 1),
                "imd_warning_level": warning_level
            })
            
        return pd.DataFrame(records)


if __name__ == "__main__":
    from datetime import datetime
    try:
        current_year = datetime.now().year
        print(f"Running IMD rainfall data download for Bihar region (May 1 - Oct 31, {current_year})...")

        # Try to fetch current year data
        try:
            df_bihar = download_bihar_rainfall(year=current_year)
        except Exception as e:
            logger.info(f"Could not fetch {current_year} data ({e}). Falling back to 2019 historical data...")
            df_bihar = download_bihar_rainfall_2019()

        print("\nDownload & Processing Complete!")
        print(f"Total Rows: {len(df_bihar)}")
        print(f"Columns: {list(df_bihar.columns)}")
        print(f"Date Range: {df_bihar['date'].min()} to {df_bihar['date'].max()}")
        print("\nFirst 5 rows:")
        print(df_bihar.head())
        print("\nSample Statistics:")
        print(f"Rainfall Mean: {df_bihar['rainfall_mm'].mean():.2f} mm")
        print(f"Rainfall Max: {df_bihar['rainfall_mm'].max():.2f} mm")
    except Exception as error:
        logger.error(f"Execution failed: {error}")

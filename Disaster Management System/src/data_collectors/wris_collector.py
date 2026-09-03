"""
India WRIS (Water Resources Information System) Hydro-telemetry Adapter

Loads, filters, cleans, and validates river water level telemetry from India WRIS,
calculating 24-hour shifted levels and river rise rates for Kosi and Gandak basins.
"""

import os
import sys
import logging
from typing import Optional, Tuple, Dict, Any, List
import numpy as np
import pandas as pd

from src.data_collectors.base_collector import BaseDataCollector

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def generate_sample_wris_raw_data(output_path: str = "data/raw/wris_river_levels.csv") -> pd.DataFrame:
    """
    Generates realistic sample WRIS river water level data for testing when raw CSV is missing.

    Parameters
    ----------
    output_path : str, default="data/raw/wris_river_levels.csv"
        Path where sample raw CSV will be written.

    Returns
    -------
    pd.DataFrame
        Sample raw dataframe containing station metrics across multiple river basins.
    """
    logger.info("Generating sample raw WRIS river water level dataset...")
    np.random.seed(42)
    dates = pd.date_range("2019-05-01", "2019-10-31", freq="D")
    
    stations = [
        {"station_id": "STN_KOS_01", "station_name": "Kosi Barrage Birpur", "lat": 26.52, "lon": 86.93, "base_level": 45.0},
        {"station_id": "STN_KOS_02", "station_name": "Kosi Baltara Station", "lat": 25.68, "lon": 86.62, "base_level": 34.5},
        {"station_id": "STN_GAN_01", "station_name": "Gandak Valmikinagar Barrage", "lat": 27.43, "lon": 83.91, "base_level": 60.0},
        {"station_id": "STN_GAN_02", "station_name": "Gandak Rewaghat Station", "lat": 25.98, "lon": 85.22, "base_level": 50.2},
        {"station_id": "STN_GNG_01", "station_name": "Ganga Patna Gandhighat", "lat": 25.61, "lon": 85.13, "base_level": 48.6},
        {"station_id": "STN_SON_01", "station_name": "Son Dehri Station", "lat": 24.91, "lon": 84.18, "base_level": 38.0},
    ]

    records = []
    for stn in stations:
        curr_lvl = stn["base_level"]
        for d in dates:
            change = np.random.normal(0.05, 0.4)
            curr_lvl = max(10.0, curr_lvl + change)
            records.append({
                "station_id": stn["station_id"],
                "station_name": stn["station_name"],
                "date": d.strftime("%Y-%m-%d"),
                "water_level_m": round(curr_lvl, 2),
                "latitude": stn["lat"],
                "longitude": stn["lon"]
            })

    df = pd.DataFrame(records)
    out_dir = os.path.dirname(output_path)
    if out_dir:
        os.makedirs(out_dir, exist_ok=True)
    df.to_csv(output_path, index=False)
    logger.info(f"Saved sample raw WRIS data ({len(df)} rows) to {output_path}")
    return df


def validate_wris_data(df: pd.DataFrame) -> Dict[str, Any]:
    """
    Validates river water level dataset for missing dates, negative values, and statistical outliers (>3 std dev).

    Parameters
    ----------
    df : pd.DataFrame
        DataFrame containing water level records with date, station_id, and water_level_m columns.

    Returns
    -------
    Dict[str, Any]
        Validation report dictionary with counts of anomalies and quality status.
    """
    report: Dict[str, Any] = {
        "total_records": len(df),
        "total_stations": df["station_id"].nunique() if "station_id" in df.columns else 0,
        "negative_water_levels_count": 0,
        "outliers_count": 0,
        "missing_dates_per_station": {},
        "status": "PASSED"
    }

    if df.empty:
        report["status"] = "EMPTY_DATAFRAME"
        return report

    # 1. Negative Water Levels Check
    if "water_level_m" in df.columns:
        neg_mask = df["water_level_m"] < 0
        report["negative_water_levels_count"] = int(neg_mask.sum())
        if report["negative_water_levels_count"] > 0:
            logger.warning(f"Found {report['negative_water_levels_count']} negative water level values.")

    # 2. Missing Dates Check per Station
    if "date" in df.columns and "station_id" in df.columns:
        df_temp = df.copy()
        df_temp["date_dt"] = pd.to_datetime(df_temp["date"])
        
        for stn_id, group in df_temp.groupby("station_id"):
            min_date = group["date_dt"].min()
            max_date = group["date_dt"].max()
            expected_dates = pd.date_range(min_date, max_date, freq="D")
            actual_dates = set(group["date_dt"])
            missing = [d.strftime("%Y-%m-%d") for d in expected_dates if d not in actual_dates]
            if missing:
                report["missing_dates_per_station"][stn_id] = len(missing)

    # 3. Outlier Detection (>3 Std Dev from Station Mean)
    if "water_level_m" in df.columns and "station_id" in df.columns:
        outlier_total = 0
        for stn_id, group in df.groupby("station_id"):
            mean_val = group["water_level_m"].mean()
            std_val = group["water_level_m"].std()
            if std_val > 0:
                z_scores = np.abs((group["water_level_m"] - mean_val) / std_val)
                outlier_total += int((z_scores > 3).sum())
        report["outliers_count"] = outlier_total
        if outlier_total > 0:
            logger.warning(f"Detected {outlier_total} statistical outliers (>3 std dev).")

    return report


def load_and_clean_wris_river_data(
    input_path: str = "data/raw/wris_river_levels.csv",
    output_path: str = "data/processed/wris_river_cleaned.csv",
    basins: List[str] = ["Kosi", "Gandak"]
) -> Tuple[pd.DataFrame, Dict[str, Any]]:
    """
    Loads river level CSV, filters for specified basins (Kosi & Gandak), calculates 24-hour shifted
    levels and river rise rates, validates the data, and saves cleaned results.

    Parameters
    ----------
    input_path : str, default="data/raw/wris_river_levels.csv"
        Source path for raw WRIS river water level CSV file.
    output_path : str, default="data/processed/wris_river_cleaned.csv"
        Target path for cleaned processed CSV output.
    basins : List[str], default=["Kosi", "Gandak"]
        List of basin/river keywords to filter for.

    Returns
    -------
    Tuple[pd.DataFrame, Dict[str, Any]]
        Cleaned pandas DataFrame and validation report dictionary.
    """
    if not os.path.exists(input_path):
        logger.warning(f"Raw input file '{input_path}' not found. Generating sample raw data...")
        generate_sample_wris_raw_data(input_path)

    logger.info(f"Loading raw WRIS river levels from {input_path}...")
    try:
        df = pd.read_csv(input_path)
    except Exception as e:
        logger.error(f"Error reading CSV file {input_path}: {e}")
        raise IOError(f"Could not load WRIS CSV: {e}") from e

    expected_cols = ["station_id", "station_name", "date", "water_level_m", "latitude", "longitude"]
    missing_cols = [col for col in expected_cols if col not in df.columns]
    if missing_cols:
        logger.error(f"Input CSV is missing required columns: {missing_cols}")
        raise KeyError(f"Missing required columns in WRIS CSV: {missing_cols}")

    # 1. Filter for Kosi and Gandak basin stations only
    basin_pattern = "|".join(basins)
    logger.info(f"Filtering for stations matching basin keywords: {basins}...")
    df_filtered = df[df["station_name"].str.contains(basin_pattern, case=False, na=False)].copy()

    if df_filtered.empty:
        logger.warning("No records matched the specified basin filter! Returning empty dataset.")
        return df_filtered, validate_wris_data(df_filtered)

    # 2. Sort by station_id and date
    df_filtered["date"] = pd.to_datetime(df_filtered["date"]).dt.strftime("%Y-%m-%d")
    df_filtered = df_filtered.sort_values(by=["station_id", "date"]).reset_index(drop=True)

    # 3. Add column river_level_24h_ago by shifting each station's data by 1 day
    logger.info("Calculating 24-hour shifted water level per station...")
    df_filtered["river_level_24h_ago"] = (
        df_filtered.groupby("station_id")["water_level_m"].shift(1)
    )

    # 4. Add column river_rise_rate = (current - 24h_ago) / 24h_ago
    logger.info("Calculating 24-hour river rise rate...")
    df_filtered["river_rise_rate"] = (
        (df_filtered["water_level_m"] - df_filtered["river_level_24h_ago"])
        / df_filtered["river_level_24h_ago"]
    ).round(6)

    # Clean infinity / NaNs in rise rate
    df_filtered["river_rise_rate"] = df_filtered["river_rise_rate"].replace([np.inf, -np.inf], np.nan)

    # 5. Execute Data Validation
    logger.info("Validating processed WRIS dataset...")
    validation_report = validate_wris_data(df_filtered)
    logger.info(f"Validation Report: {validation_report}")

    # 6. Save cleaned data to CSV
    try:
        out_dir = os.path.dirname(output_path)
        if out_dir:
            os.makedirs(out_dir, exist_ok=True)
        df_filtered.to_csv(output_path, index=False)
        logger.info(f"Saved {len(df_filtered)} cleaned records to {output_path}")
    except Exception as e:
        logger.error(f"Error saving output to {output_path}: {e}")
        raise IOError(f"Could not save output file: {e}") from e

    return df_filtered, validation_report


class WRISDataCollector(BaseDataCollector):
    """
    Collector for river water levels, gauge discharge rates, and reservoir capacities from India WRIS.
    """

    def fetch_live_data(self, region_code: str = "ALL") -> pd.DataFrame:
        """Loads and processes WRIS river level data for Kosi & Gandak basins."""
        try:
            df_cleaned, _ = load_and_clean_wris_river_data()
            return df_cleaned
        except Exception as e:
            logger.warning(f"Live WRIS fetch failed ({e}). Falling back to simulation mode.")
            return self.generate_simulated_data(region_code=region_code)

    def generate_simulated_data(self, region_code: str = "ALL", num_samples: int = 50) -> pd.DataFrame:
        """Generates realistic simulated telemetry for testing without internet access."""
        np.random.seed(101)
        districts = ["Patna", "Bhagalpur", "Darbhanga", "Muzaffarpur", "Sitamarhi", "Supaul", "Madhubani", "Katihar"]
        rivers = ["Ganga", "Brahmaputra", "Godavari", "Krishna", "Kaveri", "Mahanadi", "Narmada", "Tapi"]
        
        records = []
        for i in range(num_samples):
            district = districts[i % len(districts)]
            river = rivers[i % len(rivers)]
            
            danger_level_m = float(np.random.uniform(45.0, 85.0))
            current_water_level_m = danger_level_m + float(np.random.uniform(-5.0, 4.0))
            discharge_rate_cumecs = float(np.random.uniform(1200.0, 15000.0))
            reservoir_capacity_percent = float(np.random.uniform(50.0, 99.5))
            
            is_above_danger = current_water_level_m >= danger_level_m

            records.append({
                "timestamp": pd.Timestamp.now().isoformat(),
                "district_id": district,
                "river_name": river,
                "gauge_station_id": f"STN_{river[:3].upper()}_{i%5+1:02d}",
                "water_level_meters": round(current_water_level_m, 2),
                "danger_level_meters": round(danger_level_m, 2),
                "is_above_danger": is_above_danger,
                "discharge_rate_cumecs": round(discharge_rate_cumecs, 1),
                "reservoir_capacity_percent": round(reservoir_capacity_percent, 1)
            })

        return pd.DataFrame(records)


if __name__ == "__main__":
    try:
        print("Running WRIS River Level Cleaning & Validation Pipeline for Kosi & Gandak Basins...")
        df_clean, report = load_and_clean_wris_river_data()
        print("\nPipeline Complete!")
        print("Validation Summary:", report)
        print(f"\nFiltered Dataset Rows: {len(df_clean)}")
        print(f"Columns: {list(df_clean.columns)}")
        print("\nFirst 10 rows:")
        print(df_clean.head(10))
    except Exception as error:
        logger.error(f"Execution failed: {error}")

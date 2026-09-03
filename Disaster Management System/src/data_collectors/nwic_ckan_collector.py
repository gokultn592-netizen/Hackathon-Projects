"""
NWIC CKAN Data Collector Adapter

Queries the National Water Informatics Centre (NWIC) CKAN API for river water level
datasets (e.g. Kosi and Gandak basins), extracts dataset metadata and resource download URLs,
downloads CSV/Excel telemetry files to data/raw/, and falls back to sample generation on failure.
"""

import os
import sys
import logging
import re
from typing import Optional, List, Dict, Any, Tuple
import requests
import pandas as pd
import urllib3

# Suppress unverified HTTPS warnings for government portal certificates if required
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

from src.data_collectors.base_collector import BaseDataCollector
from src.data_collectors.wris_collector import generate_sample_wris_raw_data

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

CKAN_API_ENDPOINT = "https://nwdp.nwic.gov.in/api/3/action/package_search"
SUPPORTED_FORMATS = {"CSV", "XLS", "XLSX", "ZIP"}


def sanitize_filename(filename: str) -> str:
    """Sanitizes strings for safe local filesystem storage."""
    clean_name = re.sub(r"[^\w\-_.]", "_", filename)
    return re.sub(r"_+", "_", clean_name).strip("_")


def query_nwic_ckan_api(
    query_string: str = "Kosi OR Gandak OR river water level OR bihar",
    api_endpoint: str = CKAN_API_ENDPOINT,
    api_key: Optional[str] = None,
    timeout: int = 15
) -> List[Dict[str, Any]]:
    """
    Queries NWIC's CKAN package_search API endpoint for river water level datasets.

    Parameters
    ----------
    query_string : str, default="Kosi OR Gandak OR river water level OR bihar"
        Search query parameter passed to CKAN API.
    api_endpoint : str, default="https://nwdp.nwic.gov.in/api/3/action/package_search"
        CKAN API action URL.
    api_key : Optional[str], default=None
        Optional authorization key for CKAN endpoints requiring authentication.
    timeout : int, default=15
        HTTP request timeout in seconds.

    Returns
    -------
    List[Dict[str, Any]]
        Extracted list of dataset resource objects containing titles, URLs, and metadata.
    """
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) FloodCommandCenter/1.0"
    }
    if api_key:
        headers["Authorization"] = api_key
        headers["X-CKAN-API-Key"] = api_key

    logger.info(f"Querying NWIC CKAN API ({api_endpoint}) with query='{query_string}'...")

    extracted_resources: List[Dict[str, Any]] = []

    try:
        response = requests.get(
            api_endpoint,
            params={"q": query_string, "rows": 20},
            headers=headers,
            timeout=timeout,
            verify=False
        )
        response.raise_for_status()
        data = response.json()

        if not data.get("success", False):
            logger.warning(f"CKAN API query succeeded but returned success=False. Response: {data}")
            return []

        results = data.get("result", {}).get("results", [])
        logger.info(f"CKAN API returned {len(results)} dataset packages.")

        if not results:
            logger.warning("Empty search results returned from CKAN API query.")
            return []

        for pkg in results:
            dataset_title = pkg.get("title", "Untitled Dataset")
            metadata_modified = pkg.get("metadata_modified") or pkg.get("revision_timestamp") or "Unknown"
            spatial_coverage = pkg.get("spatial") or pkg.get("state") or pkg.get("notes") or "India/Bihar"

            for res in pkg.get("resources", []):
                res_url = res.get("url")
                raw_fmt = (res.get("format") or "").upper().strip()

                if not res_url:
                    continue

                if raw_fmt not in SUPPORTED_FORMATS and not any(res_url.lower().endswith(ext) for ext in [".csv", ".xls", ".xlsx", ".zip"]):
                    logger.info(f"Skipping resource '{res.get('name')}' with unsupported format: {raw_fmt}")
                    continue

                res_name = res.get("name") or res.get("description") or dataset_title
                res_id = res.get("id", "0000")

                extracted_resources.append({
                    "dataset_title": dataset_title,
                    "resource_name": res_name,
                    "resource_id": res_id,
                    "download_url": res_url,
                    "format": raw_fmt if raw_fmt else "CSV",
                    "last_updated": res.get("last_modified") or metadata_modified,
                    "coverage_area": str(spatial_coverage)[:150]
                })

    except requests.exceptions.Timeout:
        logger.error(f"NWIC CKAN API query timed out after {timeout} seconds.")
    except requests.exceptions.ConnectionError as e:
        logger.error(f"NWIC CKAN API connection error: {e}")
    except requests.exceptions.HTTPError as e:
        logger.error(f"NWIC CKAN API HTTP error status: {e}")
    except Exception as e:
        logger.error(f"Unexpected error while querying NWIC CKAN API: {e}")

    return extracted_resources


def download_nwic_resource(
    resource_info: Dict[str, Any],
    output_dir: str = "data/raw",
    api_key: Optional[str] = None,
    timeout: int = 30
) -> Optional[str]:
    """
    Downloads actual CSV or Excel resource file from URL and saves to data/raw with descriptive name.

    Parameters
    ----------
    resource_info : Dict[str, Any]
        Dictionary containing download_url, resource_name, format, and dataset_title.
    output_dir : str, default="data/raw"
        Destination directory for saved resource file.
    api_key : Optional[str], default=None
        Optional authorization header key.
    timeout : int, default=30
        Download timeout in seconds.

    Returns
    -------
    Optional[str]
        Absolute or relative path to downloaded file if successful, None otherwise.
    """
    url = resource_info.get("download_url")
    if not url:
        return None

    os.makedirs(output_dir, exist_ok=True)
    fmt = resource_info.get("format", "CSV").lower()
    ext = ".csv" if "csv" in fmt else (".xlsx" if "xlsx" in fmt else (".xls" if "xls" in fmt else ".csv"))

    res_name = sanitize_filename(resource_info.get("resource_name", "nwic_dataset"))
    filename = f"nwic_{res_name}_{resource_info.get('resource_id', '')[:8]}{ext}"
    target_path = os.path.join(output_dir, filename)

    logger.info(f"Downloading resource '{resource_info.get('resource_name')}' from {url}...")

    headers = {"User-Agent": "Mozilla/5.0 FloodCommandCenter/1.0"}
    if api_key:
        headers["Authorization"] = api_key

    try:
        response = requests.get(url, headers=headers, stream=True, timeout=timeout, verify=False)
        response.raise_for_status()

        with open(target_path, "wb") as f:
            for chunk in response.iter_content(chunk_size=8192):
                if chunk:
                    f.write(chunk)

        logger.info(f"Successfully downloaded {os.path.getsize(target_path)} bytes -> {target_path}")
        return target_path

    except Exception as e:
        logger.error(f"Failed to download resource from {url}: {e}")
        return None


def fetch_and_process_nwic_ckan(
    search_terms: List[str] = ["Kosi", "Gandak", "bihar OR river OR water"],
    output_dir: str = "data/raw",
    api_key: Optional[str] = None
) -> Tuple[List[str], List[Dict[str, Any]]]:
    """
    Orchestrates searching CKAN API for river water level datasets, parsing metadata,
    downloading resource files to data/raw/, and triggering fallback generation if API fails.

    Parameters
    ----------
    search_terms : List[str]
        List of search queries to attempt against CKAN API.
    output_dir : str, default="data/raw"
        Target directory to store downloaded dataset files.
    api_key : Optional[str], default=None
        Optional authentication key.

    Returns
    -------
    Tuple[List[str], List[Dict[str, Any]]]
        Tuple of (list of downloaded file paths, list of dataset metadata objects).
    """
    resources: List[Dict[str, Any]] = []

    for term in search_terms:
        res_list = query_nwic_ckan_api(query_string=term, api_key=api_key)
        if res_list:
            resources.extend(res_list)
            break

    downloaded_files: List[str] = []
    if resources:
        logger.info(f"Found {len(resources)} downloadable resources from NWIC CKAN API.")
        for res_info in resources[:3]: # Download top 3 matching resources
            file_path = download_nwic_resource(res_info, output_dir=output_dir, api_key=api_key)
            if file_path:
                downloaded_files.append(file_path)

    # Fallback mechanism if CKAN API returned no resources or downloads failed
    if not downloaded_files:
        logger.warning("NWIC CKAN API returned no accessible resources or downloads failed. Triggering fallback data generator...")
        fallback_path = os.path.join(output_dir, "wris_river_levels.csv")
        df_fallback = generate_sample_wris_raw_data(fallback_path)
        downloaded_files.append(fallback_path)

    return downloaded_files, resources


class NWICCKANCollector(BaseDataCollector):
    """
    Collector adapter for NWIC CKAN API datasets.
    """

    def fetch_live_data(self, region_code: str = "ALL") -> pd.DataFrame:
        """Fetch river telemetry datasets from NWIC CKAN API or return processed DataFrame."""
        downloaded_files, _ = fetch_and_process_nwic_ckan()
        if downloaded_files and os.path.exists(downloaded_files[0]):
            try:
                return pd.read_csv(downloaded_files[0])
            except Exception as e:
                logger.warning(f"Could not parse downloaded CSV ({e}). Using simulation mode.")
        return self.generate_simulated_data(region_code=region_code)

    def generate_simulated_data(self, region_code: str = "ALL", num_samples: int = 50) -> pd.DataFrame:
        """Generate mock dataset for testing without internet."""
        return generate_sample_wris_raw_data("data/raw/wris_river_levels.csv")


if __name__ == "__main__":
    print("Executing NWIC CKAN API Collector for Kosi & Gandak River Water Levels...")
    downloaded, metadata_list = fetch_and_process_nwic_ckan()
    print("\nExecution Complete!")
    print(f"Downloaded Files Count: {len(downloaded)}")
    for f in downloaded:
        print(f" - Downloaded File: {f}")
    if metadata_list:
        print("\nDataset Metadata Summary:")
        for meta in metadata_list[:3]:
            print(f" - Title: {meta['dataset_title']}")
            print(f"   URL: {meta['download_url']}")
            print(f"   Format: {meta['format']} | Updated: {meta['last_updated']} | Coverage: {meta['coverage_area'][:60]}")

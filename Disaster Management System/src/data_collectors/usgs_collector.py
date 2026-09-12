"""
USGS NWIS Water Data Collector for Red River Basin (USA)
Fetches real-time river gauge levels from USGS National Water Information System.
"""
import os, logging
from typing import Optional
import pandas as pd, numpy as np
from src.data_collectors.base_collector import BaseDataCollector

logger = logging.getLogger(__name__)

STATIONS = [
    {"station_id":"USGS_05054000","station_name":"Red River at Fargo ND","lat":46.8772,"lon":-96.7898,"base_level_ft":17.0},
    {"station_id":"USGS_05082500","station_name":"Red River at Crookston MN","lat":47.843,"lon":-96.596,"base_level_ft":28.0},
    {"station_id":"USGS_05079000","station_name":"Red Lake River at Crookston MN","lat":47.843,"lon":-96.596,"base_level_ft":14.0},
    {"station_id":"USGS_05087500","station_name":"Red River at St Hilaire MN","lat":48.033,"lon":-96.247,"base_level_ft":22.0},
    {"station_id":"USGS_05092000","station_name":"Red River at Drayton ND","lat":48.557,"lon":-97.141,"base_level_ft":34.0},
    {"station_id":"USGS_05085000","station_name":"Red River at Halstad MN","lat":47.267,"lon":-96.833,"base_level_ft":25.0},
    {"station_id":"USGS_05059000","station_name":"Red River of the North at Wahpeton ND","lat":46.2661,"lon":-96.6170,"base_level_ft":10.0},
    {"station_id":"USGS_05053000","station_name":"Red River at Pembina ND","lat":48.9813,"lon":-97.2458,"base_level_ft":39.0},
]

class USGSDataCollector(BaseDataCollector):
    def fetch_live_data(self, region_code="ALL") -> pd.DataFrame:
        # Try real USGS NWIS Web Service (no key required for public data)
        try:
            import requests
            url = "https://waterservices.usgs.gov/nwis/iv/"
            params = {"format":"json","sites":"05054000,05082500,05079000,05087500,05092000,05085000,05059000,05053000","period":"P365D"}
            r = requests.get(url, params=params, timeout=20)
            r.raise_for_status()
            data = r.json()
            records = []
            for ts in data.get("value",{}).get("timeSeries",[]):
                # sourceInfo.siteCode is list; take first item value
                site_code_obj = ts.get("sourceInfo",{}).get("siteCode", [])
                sid = site_code_obj[0].get("value") if isinstance(site_code_obj, list) and len(site_code_obj) > 0 else (site_code_obj.get("value") if isinstance(site_code_obj, dict) else None)
                # values is list of value objects; take first value list
                values_list = ts.get("values", [])
                for val_obj in values_list:
                    value_entries = val_obj.get("value", [])
                    for v in value_entries:
                        records.append({
                            "station_id": sid,
                            "date": v.get("dateTime"),
                            "water_level_ft": float(v.get("value")) if v.get("value") is not None else None,
                        })
            if records:
                return pd.DataFrame(records)
        except Exception as e:
            logger.warning(f"Live USGS fetch failed ({e}). Using simulated USGS data.")
        return self.generate_simulated_data(region_code=region_code)

    def generate_simulated_data(self, region_code="ALL", num_samples=100) -> pd.DataFrame:
        np.random.seed(77)
        dates = pd.date_range("2025-04-01","2025-07-31",freq="D")
        records = []
        for stn in STATIONS:
            level = stn["base_level_ft"]
            for d in dates:
                change = np.random.normal(0.08, 0.35)
                level = max(5.0, level + change)
                records.append({
                    "station_id": stn["station_id"],
                    "station_name": stn["station_name"],
                    "date": d.strftime("%Y-%m-%d"),
                    "water_level_ft": round(level, 2),
                    "latitude": stn["lat"],
                    "longitude": stn["lon"],
                })
        return pd.DataFrame(records)

#!/usr/bin/env python3
"""
Production Polling Orchestrator — USGS NWIS + NOAA Weather (no Onist required).
Runs continuous polling loop: fetches live data, saves to data/live/, logs.
Can run as a cron or container service.
"""
import sys, time, logging, os, json
from datetime import datetime
sys.path.insert(0, '.')
from src.data_collectors.usgs_collector import USGSDataCollector
from src.data_collectors.noaa_collector import NOAADataCollector

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

POLL_INTERVAL = int(os.getenv("POLL_INTERVAL", "300"))  # default 5 minutes

usgs = USGSDataCollector()
noaa = NOAADataCollector()

def poll():
    ts = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    # Pull live USGS (P365D = full year of records per poll; can be filtered to recent)
    usgs_df = usgs.fetch(use_simulation=False)
    # Pull live NOAA expanded forecast
    noaa_df = noaa.fetch_live_data(region_code="ALL")
    # Save
    os.makedirs("data/live", exist_ok=True)
    usgs_df.to_csv(f"data/live/usgs_{ts}.csv", index=False)
    noaa_df.to_csv(f"data/live/noaa_{ts}.csv", index=False)
    # Log summary
    logger.info(f"POLL {ts}: USGS={len(usgs_df)} records | NOAA={len(noaa_df)} records | Saved to data/live/")
    # Keep last 10 files only (rotation)
    files = sorted([f for f in os.listdir("data/live") if f.startswith("usgs_")])
    for old in files[:-10]:
        os.remove(os.path.join("data/live", old))
    files_n = sorted([f for f in os.listdir("data/live") if f.startswith("noaa_")])
    for old in files_n[:-10]:
        os.remove(os.path.join("data/live", old))

if __name__ == "__main__":
    logger.info("Starting USGS + NOAA production polling (no Onist). Interval=%ds", POLL_INTERVAL)
    while True:
        try:
            poll()
        except Exception as e:
            logger.error(f"Poll failed: {e}")
        time.sleep(POLL_INTERVAL)

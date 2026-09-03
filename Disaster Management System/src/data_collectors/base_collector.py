"""
Base Data Collector Interface
"""
from abc import ABC, abstractmethod
import logging
from typing import Any, Dict, Optional
import pandas as pd

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class BaseDataCollector(ABC):
    """
    Abstract Base Class for all disaster management data collectors.
    Provides standard fetch interface with robust fallback simulation for offline/hackathon mode.
    """

    def __init__(self, api_key: Optional[str] = None, base_url: Optional[str] = None):
        self.api_key = api_key
        self.base_url = base_url

    @abstractmethod
    def fetch_live_data(self, region_code: str = "ALL") -> pd.DataFrame:
        """Fetch live telemetry from external API/service."""
        pass

    @abstractmethod
    def generate_simulated_data(self, region_code: str = "ALL", num_samples: int = 50) -> pd.DataFrame:
        """Generate realistic mock dataset for offline hackathon testing."""
        pass

    def fetch(self, region_code: str = "ALL", use_simulation: bool = False) -> pd.DataFrame:
        """
        Unified fetch wrapper. If use_simulation=False and live fetch fails, raises an exception.
        No silent fallback to simulation - fail loudly to expose integration issues.
        """
        if use_simulation:
            logger.info(f"[{self.__class__.__name__}] Generating simulated telemetry dataset for region: {region_code}.")
            return self.generate_simulated_data(region_code)

        # Real data mode - must succeed or raise
        logger.info(f"[{self.__class__.__name__}] Fetching live telemetry for region: {region_code}...")
        df = self.fetch_live_data(region_code)

        if df.empty:
            raise RuntimeError(
                f"[{self.__class__.__name__}] Failed to fetch real data from live source for region {region_code}. "
                f"Empty dataframe returned. Set use_simulation=True to use mock data for testing."
            )

        logger.info(f"[{self.__class__.__name__}] Successfully fetched {len(df)} real data records.")
        return df

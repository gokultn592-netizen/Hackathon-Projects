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
        Unified fetch wrapper that safely falls back to simulation mode if live API calls fail or credentials missing.
        """
        if not use_simulation:
            try:
                logger.info(f"[{self.__class__.__name__}] Fetching live telemetry for region: {region_code}...")
                df = self.fetch_live_data(region_code)
                if not df.empty:
                    return df
            except Exception as e:
                logger.warning(f"[{self.__class__.__name__}] Live fetch failed: {e}. Falling back to simulation mode.")

        logger.info(f"[{self.__class__.__name__}] Generating simulated telemetry dataset for region: {region_code}.")
        return self.generate_simulated_data(region_code)

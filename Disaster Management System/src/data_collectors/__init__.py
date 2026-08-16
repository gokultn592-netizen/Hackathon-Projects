"""
Data Collectors & Static Data Loaders for Flood Command Center

Provides adapters for IMD, WRIS, NWIC CKAN, Bhuvan, DEM, and Static Spatial Loaders.
"""

from .base_collector import BaseDataCollector
from .imd_collector import IMDDataCollector
from .wris_collector import WRISDataCollector
from .nwic_ckan_collector import NWICCKANCollector
from .bhuvan_collector import BhuvanDataCollector
from .dem_collector import DEMDataCollector
from .static_data_loader import StaticDataLoader, get_static_features, merge_static_to_df

__all__ = [
    "BaseDataCollector",
    "IMDDataCollector",
    "WRISDataCollector",
    "NWICCKANCollector",
    "BhuvanDataCollector",
    "DEMDataCollector",
    "StaticDataLoader",
    "get_static_features",
    "merge_static_to_df",
]

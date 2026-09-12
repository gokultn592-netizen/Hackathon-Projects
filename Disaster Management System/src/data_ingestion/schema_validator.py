"""
Schema Validator
Validates dataset quality and structure.
Flexible: flags issues but doesn't reject (allows data scientists to override).
"""

import logging
from typing import Dict, List, Tuple, Any
import pandas as pd
import numpy as np

logger = logging.getLogger(__name__)


class SchemaValidator:
    """
    Validates that a dataset meets minimum quality requirements.
    Checks for: data types, missing values, spatial/temporal keys, numeric measurements.
    """

    def __init__(self):
        self.max_missing_value_pct = 70  # Allow up to 70% missing
        self.min_numeric_cols = 1  # Require at least 1 numeric measurement
        self.min_spatial_temporal_cols = 1  # Require at least 1 spatial/temporal key

    def validate(self, df: pd.DataFrame, column_mapping: Dict[str, str]) -> Tuple[bool, Dict[str, Any]]:
        """
        Validate dataset against quality criteria.

        Args:
            df: Input DataFrame
            column_mapping: Expected column mapping (user_col -> standard_col)

        Returns:
            Tuple of (is_valid, validation_report)
        """
        report = {
            "row_count": len(df),
            "column_count": len(df.columns),
            "missing_values": {},
            "data_types": {},
            "numeric_columns": [],
            "spatial_temporal_keys": [],
            "outliers": {},
            "warnings": [],
            "errors": [],
            "is_valid": True
        }

        # Check 1: Basic structure
        if len(df) == 0:
            report["errors"].append("Dataset is empty (0 rows)")
            report["is_valid"] = False
            return False, report

        if len(df.columns) == 0:
            report["errors"].append("Dataset has no columns")
            report["is_valid"] = False
            return False, report

        # Check 2: Missing values
        missing_pct_per_col = (df.isnull().sum() / len(df) * 100).to_dict()
        report["missing_values"] = {
            col: round(pct, 2) for col, pct in missing_pct_per_col.items()
        }

        # Check for columns that are entirely missing
        for col, pct in missing_pct_per_col.items():
            if pct >= 100:
                report["errors"].append(f"Column '{col}' is entirely missing (100% null)")
            elif pct >= self.max_missing_value_pct:
                report["warnings"].append(f"Column '{col}' has {pct:.1f}% missing values (>{self.max_missing_value_pct}%)")

        # Check 3: Data types
        for col in df.columns:
            dtype = str(df[col].dtype)
            report["data_types"][col] = dtype

            # Try to convert to numeric if object
            if dtype == "object":
                try:
                    pd.to_numeric(df[col], errors="coerce")
                    report["numeric_columns"].append(col)
                except Exception:
                    pass
            elif pd.api.types.is_numeric_dtype(df[col].dtype):
                # Skip np.issubdtype for non-standard dtypes (StringDtype etc.)
                report["numeric_columns"].append(col)
            else:
                # Try np.issubdtype only for standard numeric types
                try:
                    if np.issubdtype(df[col].dtype, np.number):
                        report["numeric_columns"].append(col)
                except TypeError:
                    pass  # Non-standard dtype like StringDtype

        # Check 4: Require at least 1 numeric measurement
        if len(report["numeric_columns"]) < self.min_numeric_cols:
            report["errors"].append(
                f"Dataset requires at least {self.min_numeric_cols} numeric column(s), "
                f"but only found {len(report['numeric_columns'])}"
            )

        # Check 5: Spatial/temporal keys
        spatial_temporal_keywords = ["district", "region", "station", "lat", "lon", "date", "time", "timestamp"]
        for col in df.columns:
            col_lower = col.lower()
            if any(keyword in col_lower for keyword in spatial_temporal_keywords):
                report["spatial_temporal_keys"].append(col)

        if len(report["spatial_temporal_keys"]) < self.min_spatial_temporal_cols:
            report["warnings"].append(
                f"Dataset should have at least {self.min_spatial_temporal_cols} spatial/temporal key "
                f"(e.g., district_id, date, timestamp). Found: {report['spatial_temporal_keys']}"
            )

        # Check 6: Detect outliers in numeric columns
        outliers_summary = {}
        for col in report["numeric_columns"]:
            try:
                Q1 = df[col].quantile(0.25)
                Q3 = df[col].quantile(0.75)
                IQR = Q3 - Q1

                lower_bound = Q1 - 1.5 * IQR
                upper_bound = Q3 + 1.5 * IQR

                outlier_count = len(df[(df[col] < lower_bound) | (df[col] > upper_bound)])
                outlier_pct = (outlier_count / len(df)) * 100

                if outlier_count > 0:
                    outliers_summary[col] = {
                        "count": outlier_count,
                        "percentage": round(outlier_pct, 2),
                        "bounds": {
                            "lower": round(lower_bound, 4),
                            "upper": round(upper_bound, 4)
                        }
                    }

                    if outlier_pct > 10:
                        report["warnings"].append(
                            f"Column '{col}' has {outlier_pct:.1f}% outliers "
                            f"(likely normal for some datasets)"
                        )

            except Exception as e:
                logger.debug(f"Could not detect outliers for {col}: {e}")

        report["outliers"] = outliers_summary

        # Check 7: Data consistency
        if len(df.columns) < 2:
            report["warnings"].append("Dataset has only 1 column (minimal for analysis)")

        # Final verdict
        if len(report["errors"]) > 0:
            report["is_valid"] = False
        else:
            report["is_valid"] = True

        logger.info(f"Validation report: valid={report['is_valid']}, "
                   f"errors={len(report['errors'])}, warnings={len(report['warnings'])}")

        return report["is_valid"], report

    def get_validation_summary(self, report: Dict[str, Any]) -> str:
        """Get human-readable validation summary."""
        summary = f"Dataset Validation Report\n"
        summary += f"{'='*50}\n"
        summary += f"Rows: {report['row_count']}, Columns: {report['column_count']}\n"
        summary += f"Numeric columns: {len(report['numeric_columns'])}\n"
        summary += f"Spatial/Temporal keys: {len(report['spatial_temporal_keys'])}\n"
        summary += f"Outliers detected: {len(report['outliers'])}\n"

        if report["errors"]:
            summary += f"\n❌ ERRORS ({len(report['errors'])}): \n"
            for error in report["errors"]:
                summary += f"  - {error}\n"

        if report["warnings"]:
            summary += f"\n⚠️  WARNINGS ({len(report['warnings'])}): \n"
            for warning in report["warnings"]:
                summary += f"  - {warning}\n"

        summary += f"\n✅ VALID: {report['is_valid']}\n"
        return summary

"""
Operational XGBoost Flood Predictor Model (v2)

Trains an 11-feature operational XGBClassifier excluding optical satellite indices (NDWI, Soil Saturation).
Engineered specifically for real-time deployment when satellite coverage is unavailable or obscured.
"""

import os
import sys
import logging
from typing import Dict, Any, Tuple, List, Union, Optional
import numpy as np
import pandas as pd
import joblib
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import xgboost as xgb
from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    roc_auc_score,
    confusion_matrix
)
from sklearn.model_selection import train_test_split

try:
    from src.preprocessing.fusion_engine import run_data_fusion
except ImportError:
    sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))
    from src.preprocessing.fusion_engine import run_data_fusion

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

DEFAULT_PROCESSED_DIR = "data/processed"
DEFAULT_MODEL_DIR = "models"

EXCLUDED_FEATURES = {"ndwi", "soil_saturation"}

OPERATIONAL_FEATURES = [
    "rainfall_mm",
    "rainfall_48h",
    "rainfall_72h",
    "water_level_m",
    "river_level_24h_ago",
    "river_level_48h_ago",
    "river_rise_rate",
    "days_since_last_rain",
    "elevation",
    "population_density",
    "flood_risk_score"
]


class XGBFloodClassifierV2:
    """
    11-Feature Operational XGBoost Model for Real-World Field Deployment.
    """

    def __init__(
        self,
        model_dir: str = DEFAULT_MODEL_DIR,
        processed_dir: str = DEFAULT_PROCESSED_DIR
    ):
        self.model_dir = model_dir
        self.processed_dir = processed_dir
        self.pkl_path = os.path.join(model_dir, "xgboost_flood_model_v2.pkl")
        self.json_path = os.path.join(model_dir, "xgboost_flood_model_v2.json")
        self.importance_plot_path = os.path.join(model_dir, "feature_importance_v2.png")

        self.model: Optional[xgb.XGBClassifier] = None
        self.feature_names: List[str] = OPERATIONAL_FEATURES
        self.is_trained: bool = False

        self.load_saved_model()

    def load_saved_model(self) -> bool:
        """Loads trained operational v2 XGBoost model from disk if available."""
        if os.path.exists(self.pkl_path):
            try:
                self.model = joblib.load(self.pkl_path)
                self.is_trained = True
                logger.info(f"Loaded operational v2 model from {self.pkl_path}")
                return True
            except Exception as e:
                logger.warning(f"Failed to load v2 PKL model: {e}")

        if os.path.exists(self.json_path):
            try:
                self.model = xgb.XGBClassifier()
                self.model.load_model(self.json_path)
                self.is_trained = True
                logger.info(f"Loaded operational v2 JSON model from {self.json_path}")
                return True
            except Exception as e:
                logger.warning(f"Failed to load v2 JSON model: {e}")

        return False

    def load_operational_data(self) -> Tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray, List[str]]:
        """
        Loads dataset from data/processed/ and filters out optical satellite features (ndwi, soil_saturation).
        """
        x_tr_p = os.path.join(self.processed_dir, "X_train.npy")
        x_te_p = os.path.join(self.processed_dir, "X_test.npy")
        y_tr_p = os.path.join(self.processed_dir, "y_train.npy")
        y_te_p = os.path.join(self.processed_dir, "y_test.npy")
        fn_p = os.path.join(self.processed_dir, "feature_names.npy")

        req_files = [x_tr_p, x_te_p, y_tr_p, y_te_p, fn_p]
        if not all(os.path.exists(f) for f in req_files):
            logger.info("Processed dataset missing. Triggering data fusion...")
            run_data_fusion()

        X_train_raw = np.load(x_tr_p)
        X_test_raw = np.load(x_te_p)
        y_train = np.load(y_tr_p)
        y_test = np.load(y_te_p)
        raw_fn = [str(f) for f in np.load(fn_p)]

        # Filter indices to keep 11 operational features
        feature_indices = [i for i, name in enumerate(raw_fn) if name not in EXCLUDED_FEATURES]
        feature_names_v2 = [raw_fn[i] for i in feature_indices]

        X_train = X_train_raw[:, feature_indices]
        X_test = X_test_raw[:, feature_indices]

        self.feature_names = feature_names_v2
        logger.info(f"Filtered dataset to {len(feature_names_v2)} operational features: {feature_names_v2}")
        return X_train, X_test, y_train, y_test, feature_names_v2

    def train(
        self,
        n_estimators: int = 200,
        max_depth: int = 6,
        learning_rate: float = 0.1,
        subsample: float = 0.8,
        colsample_bytree: float = 0.8,
        early_stopping_rounds: int = 10,
        random_state: int = 42
    ) -> Dict[str, Any]:
        """
        Trains operational XGBoost model (v2) on 11 predictive features.
        """
        logger.info("=" * 70)
        logger.info(" STARTING OPERATIONAL XGBOOST V2 MODEL TRAINING (11 FEATURES)")
        logger.info("=" * 70)

        X_train, X_test, y_train, y_test, feature_names = self.load_operational_data()

        # Class imbalance scale_pos_weight
        n_pos = float(np.sum(y_train))
        n_neg = float(len(y_train) - n_pos)
        scale_pos_weight = n_neg / max(1.0, n_pos)

        # 10% validation split for early stopping
        X_tr, X_val, y_tr, y_val = train_test_split(
            X_train, y_train, test_size=0.1, stratify=y_train, random_state=random_state
        )

        self.model = xgb.XGBClassifier(
            n_estimators=n_estimators,
            max_depth=max_depth,
            learning_rate=learning_rate,
            subsample=subsample,
            colsample_bytree=colsample_bytree,
            scale_pos_weight=scale_pos_weight,
            random_state=random_state,
            eval_metric="logloss",
            early_stopping_rounds=early_stopping_rounds
        )

        logger.info("Fitting operational v2 model with early stopping...")
        self.model.fit(
            X_tr, y_tr,
            eval_set=[(X_val, y_val)],
            verbose=False
        )

        best_iter = getattr(self.model, "best_iteration", n_estimators)
        logger.info(f"Model v2 training finished at iteration {best_iter}.")

        # Predictions & Metrics
        y_pred = self.model.predict(X_test)
        y_proba = self.model.predict_proba(X_test)[:, 1]

        acc = float(accuracy_score(y_test, y_pred))
        prec = float(precision_score(y_test, y_pred))
        rec = float(recall_score(y_test, y_pred))
        f1 = float(f1_score(y_test, y_pred))
        auc = float(roc_auc_score(y_test, y_proba))
        cm = confusion_matrix(y_test, y_pred).tolist()

        logger.info("\n" + "=" * 50)
        logger.info(" OPERATIONAL MODEL V2 TEST EVALUATION METRICS")
        logger.info("=" * 50)
        logger.info(f" - Accuracy:        {acc:.4f} ({acc * 100:.2f}%)")
        logger.info(f" - Precision:       {prec:.4f}")
        logger.info(f" - Recall:          {rec:.4f}")
        logger.info(f" - F1-Score:        {f1:.4f}")
        logger.info(f" - ROC-AUC Score:   {auc:.4f}")
        logger.info(f" - Confusion Matrix:\n    TN: {cm[0][0]}  FP: {cm[0][1]}\n    FN: {cm[1][0]}  TP: {cm[1][1]}")

        # Top Features & Plotting
        importances = self.model.feature_importances_
        sorted_indices = np.argsort(importances)[::-1]

        top_5 = []
        logger.info("\nTop 5 Operational Features:")
        for idx in sorted_indices[:5]:
            fname = feature_names[idx]
            imp_v = float(importances[idx])
            top_5.append({"feature": fname, "importance": round(imp_v, 4)})
            logger.info(f"  {len(top_5)}. {fname:25s}: {imp_v:.4f}")

        # Generate Feature Importance Plot
        os.makedirs(self.model_dir, exist_ok=True)
        plt.figure(figsize=(10, 6))
        sorted_feats = [feature_names[i] for i in sorted_indices[::-1]]
        sorted_imps = [importances[i] for i in sorted_indices[::-1]]

        plt.barh(sorted_feats, sorted_imps, color="#2e7d32", edgecolor="#1b5e20")
        plt.xlabel("Feature Importance Score", fontsize=12, fontweight="bold")
        plt.ylabel("Operational Telemetry Feature", fontsize=12, fontweight="bold")
        plt.title("Operational Flood Prediction Model (v2) - Feature Importance", fontsize=14, fontweight="bold", pad=15)
        plt.grid(axis="x", linestyle="--", alpha=0.6)
        plt.tight_layout()

        plt.savefig(self.importance_plot_path, dpi=300)
        plt.close()
        logger.info(f"Saved operational feature importance plot -> {self.importance_plot_path}")

        # Save v2 Model Artifacts
        joblib.dump(self.model, self.pkl_path)
        logger.info(f"Saved Joblib v2 model artifact -> {self.pkl_path}")

        self.model.save_model(self.json_path)
        logger.info(f"Saved JSON v2 model artifact -> {self.json_path}")

        self.is_trained = True

        return {
            "status": "SUCCESS",
            "model_version": "v2_operational",
            "accuracy": round(acc, 4),
            "precision": round(prec, 4),
            "recall": round(rec, 4),
            "f1_score": round(f1, 4),
            "roc_auc": round(auc, 4),
            "confusion_matrix": cm,
            "best_iteration": int(best_iter),
            "top_features": top_5,
            "pkl_model_path": self.pkl_path,
            "json_model_path": self.json_path,
            "importance_plot": self.importance_plot_path
        }

    def predict(
        self,
        features: Union[Dict[str, float], List[float], np.ndarray]
    ) -> Dict[str, Any]:
        """
        Predicts flood risk for sample using the 11 operational features.
        """
        if not self.is_trained or self.model is None:
            if not self.load_saved_model():
                self.train()

        vec = np.zeros(len(self.feature_names), dtype=float)

        if isinstance(features, dict):
            for i, name in enumerate(self.feature_names):
                vec[i] = float(features.get(name, 0.0))
        elif isinstance(features, (list, tuple)):
            vec[:min(len(features), len(vec))] = [float(v) for v in features[:len(vec)]]
        elif isinstance(features, np.ndarray):
            flat = features.ravel()
            vec[:min(len(flat), len(vec))] = flat[:len(vec)]

        X_input = vec.reshape(1, -1)
        prob = float(self.model.predict_proba(X_input)[0, 1])

        if prob >= 0.75:
            risk_level = "CRITICAL"
        elif prob >= 0.50:
            risk_level = "HIGH"
        elif prob >= 0.25:
            risk_level = "MEDIUM"
        else:
            risk_level = "LOW"

        importances = self.model.feature_importances_
        contributions = np.abs(vec * importances)
        if np.max(contributions) > 0:
            top_idx = int(np.argmax(contributions))
        else:
            top_idx = int(np.argmax(importances))

        return {
            "flood_probability": round(prob, 4),
            "risk_level": risk_level,
            "top_feature": self.feature_names[top_idx]
        }


# Global singleton instance for v2
_GLOBAL_MODEL_V2: Optional[XGBFloodClassifierV2] = None


def _get_v2_classifier() -> XGBFloodClassifierV2:
    global _GLOBAL_MODEL_V2
    if _GLOBAL_MODEL_V2 is None:
        _GLOBAL_MODEL_V2 = XGBFloodClassifierV2()
    return _GLOBAL_MODEL_V2


def train_xgboost_v2() -> Dict[str, Any]:
    """Helper entrypoint to train operational XGBoost v2 model."""
    return _get_v2_classifier().train()


def predict_v2(features: Union[Dict[str, float], List[float], np.ndarray]) -> Dict[str, Any]:
    """Helper entrypoint for real-time operational v2 inference."""
    return _get_v2_classifier().predict(features)


if __name__ == "__main__":
    print("Executing Operational XGBoost Model (v2) Training & Evaluation...")
    classifier = XGBFloodClassifierV2()
    res = classifier.train()

    print("\nOperational v2 Training Metrics Summary:")
    for k, v in res.items():
        if k != "confusion_matrix":
            print(f" - {k}: {v}")

    sample = {
        "rainfall_mm": 110.0,
        "rainfall_48h": 180.0,
        "rainfall_72h": 260.0,
        "water_level_m": 62.5,
        "river_rise_rate": 0.12,
        "elevation": 42.0,
        "population_density": 3200.0,
        "flood_risk_score": 0.85
    }

    pred_res = predict_v2(sample)
    print("\nOperational v2 Sample Prediction Output:")
    print(pred_res)

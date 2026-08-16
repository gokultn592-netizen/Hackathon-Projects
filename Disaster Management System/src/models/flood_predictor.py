"""
XGBoost ML Flood Predictor Engine with SHAP Explainability

Loads SMOTE-resampled spatio-temporal telemetry from data/processed/,
trains an XGBClassifier optimized for RECALL (minimizing missed flood disasters),
evaluates metrics, plots feature importances, computes SHAP explanations,
and serializes model artifacts to models/xgboost_flood_model.pkl.
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
import shap
from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    roc_auc_score,
    confusion_matrix
)

try:
    from src.preprocessing.fusion_engine import run_data_fusion
except ImportError:
    sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))
    from src.preprocessing.fusion_engine import run_data_fusion

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

DEFAULT_PROCESSED_DIR = "data/processed"
DEFAULT_MODEL_DIR = "models"
DEFAULT_MODEL_PATH = "models/xgboost_flood_model.pkl"
DEFAULT_JSON_PATH = "models/xgboost_flood_model.json"
DEFAULT_IMPORTANCE_PLOT_PATH = "models/feature_importance.png"

FEATURE_NAMES = [
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
    "ndwi",
    "soil_saturation",
    "flood_risk_score"
]


class XGBFloodPredictor:
    """
    XGBoost Predictor Engine with SHAP explainability and Recall optimization.
    """

    def __init__(
        self,
        model_dir: str = DEFAULT_MODEL_DIR,
        processed_dir: str = DEFAULT_PROCESSED_DIR
    ):
        self.model_dir = model_dir
        self.processed_dir = processed_dir
        self.model_path = os.path.join(model_dir, "xgboost_flood_model.pkl")
        self.json_path = os.path.join(model_dir, "xgboost_flood_model.json")
        self.importance_plot_path = os.path.join(model_dir, "feature_importance.png")

        self.model: Optional[xgb.XGBClassifier] = None
        self.explainer: Optional[shap.TreeExplainer] = None
        self.scaler = None
        self.feature_names: List[str] = FEATURE_NAMES
        self.is_trained: bool = False

        self.load_model()

    def load_model(self) -> bool:
        """Loads trained XGBoost model and SHAP explainer from disk if available."""
        if os.path.exists(self.model_path):
            try:
                data = joblib.load(self.model_path)
                if isinstance(data, dict):
                    self.model = data.get("model")
                    self.feature_names = data.get("feature_names", FEATURE_NAMES)
                else:
                    self.model = data

                if self.model is not None:
                    self.explainer = shap.TreeExplainer(self.model)
                    self.is_trained = True
                    logger.info(f"Loaded trained XGBoost model & SHAP explainer from {self.model_path}")
                    return True
            except Exception as e:
                logger.warning(f"Failed to load model file {self.model_path}: {e}")

        # Try loading scaler if present
        scaler_path = os.path.join(self.processed_dir, "scaler.pkl")
        if os.path.exists(scaler_path):
            try:
                self.scaler = joblib.load(scaler_path)
            except Exception as e:
                logger.warning(f"Notice: Scaler file load warning: {e}")

        logger.info("No pre-trained XGBoost model artifact found on disk.")
        return False

    def load_processed_data(self) -> Tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray, List[str]]:
        """Loads SMOTE-resampled dataset arrays from data/processed/."""
        x_tr_p = os.path.join(self.processed_dir, "X_train.npy")
        x_te_p = os.path.join(self.processed_dir, "X_test.npy")
        y_tr_p = os.path.join(self.processed_dir, "y_train.npy")
        y_te_p = os.path.join(self.processed_dir, "y_test.npy")
        fn_p = os.path.join(self.processed_dir, "feature_names.npy")

        req_files = [x_tr_p, x_te_p, y_tr_p, y_te_p, fn_p]
        if not all(os.path.exists(f) for f in req_files):
            logger.info("Processed dataset files missing. Running Data Fusion Pipeline...")
            run_data_fusion()

        X_train = np.load(x_tr_p)
        X_test = np.load(x_te_p)
        y_train = np.load(y_tr_p)
        y_test = np.load(y_te_p)
        raw_fn = np.load(fn_p)
        feature_names = [str(f) for f in raw_fn]

        self.feature_names = feature_names
        return X_train, X_test, y_train, y_test, feature_names

    def train(
        self,
        n_estimators: int = 200,
        max_depth: int = 6,
        learning_rate: float = 0.1,
        subsample: float = 0.8,
        colsample_bytree: float = 0.8,
        random_state: int = 42
    ) -> Dict[str, Any]:
        """
        Trains XGBClassifier on SMOTE-balanced training data with scale_pos_weight class balancing,
        evaluates RECALL-focused metrics, plots feature importances, initializes SHAP explainer,
        and saves model artifacts.
        """
        logger.info("=" * 70)
        logger.info(" STARTING RECALL-OPTIMIZED XGBOOST MODEL TRAINING & EVALUATION")
        logger.info("=" * 70)

        X_train, X_test, y_train, y_test, feature_names = self.load_processed_data()

        # Class imbalance scale_pos_weight calculation
        n_pos = float(np.sum(y_train))
        n_neg = float(len(y_train) - n_pos)
        scale_pos_weight = n_neg / max(1.0, n_pos)

        logger.info(f"Loaded SMOTE training set ({len(X_train)} samples). scale_pos_weight: {scale_pos_weight:.4f}")

        self.model = xgb.XGBClassifier(
            n_estimators=n_estimators,
            max_depth=max_depth,
            learning_rate=learning_rate,
            subsample=subsample,
            colsample_bytree=colsample_bytree,
            scale_pos_weight=scale_pos_weight,
            random_state=random_state,
            eval_metric="logloss"
        )

        logger.info("Fitting XGBClassifier...")
        self.model.fit(X_train, y_train)
        logger.info("Model fitting completed.")

        # Initialize SHAP TreeExplainer
        logger.info("Initializing SHAP TreeExplainer for model explainability...")
        self.explainer = shap.TreeExplainer(self.model)

        # Predict & Evaluate Test Set
        y_pred = self.model.predict(X_test)
        y_proba = self.model.predict_proba(X_test)[:, 1]

        acc = float(accuracy_score(y_test, y_pred))
        prec = float(precision_score(y_test, y_pred))
        rec = float(recall_score(y_test, y_pred))
        f1 = float(f1_score(y_test, y_pred))
        auc = float(roc_auc_score(y_test, y_proba))
        cm = confusion_matrix(y_test, y_pred)
        tn, fp, fn, tp = int(cm[0, 0]), int(cm[0, 1]), int(cm[1, 0]), int(cm[1, 1])

        logger.info("\n" + "=" * 60)
        logger.info(" MODEL EVALUATION METRICS ON TEST SET (RECALL FOCUS)")
        logger.info("=" * 60)
        logger.info(f" - Accuracy:        {acc:.4f} ({acc * 100:.2f}%)")
        logger.info(f" - Precision:       {prec:.4f}")
        logger.info(f" - RECALL:          {rec:.4f} ({rec * 100:.2f}% - MINIMIZING MISSED FLOODS)")
        logger.info(f" - F1-Score:        {f1:.4f}")
        logger.info(f" - ROC-AUC Score:   {auc:.4f}")
        logger.info(f" - Confusion Matrix: TN={tn}, FP={fp}, FN={fn} (Missed Floods), TP={tp}")

        # Feature Importance Plot
        importances = self.model.feature_importances_
        sorted_indices = np.argsort(importances)[::-1]

        top_5 = []
        logger.info("\nTop 5 Most Important Features:")
        for idx in sorted_indices[:5]:
            fname = feature_names[idx]
            imp_val = float(importances[idx])
            top_5.append({"feature": fname, "importance": round(imp_val, 4)})
            logger.info(f"  {len(top_5)}. {fname:25s}: {imp_val:.4f}")

        os.makedirs(self.model_dir, exist_ok=True)
        plt.figure(figsize=(10, 6))
        sorted_feats = [feature_names[i] for i in sorted_indices[::-1]]
        sorted_imps = [importances[i] for i in sorted_indices[::-1]]

        plt.barh(sorted_feats, sorted_imps, color="#0288d1", edgecolor="#01579b")
        plt.xlabel("Feature Importance Score", fontsize=12, fontweight="bold")
        plt.ylabel("Telemetry Feature", fontsize=12, fontweight="bold")
        plt.title("XGBoost Flood Prediction Model - Feature Importances", fontsize=14, fontweight="bold", pad=15)
        plt.grid(axis="x", linestyle="--", alpha=0.6)
        plt.tight_layout()

        plt.savefig(self.importance_plot_path, dpi=300)
        plt.close()
        logger.info(f"Saved feature importance plot -> {self.importance_plot_path}")

        # Save Model Artifacts
        model_payload = {
            "model": self.model,
            "feature_names": feature_names,
            "recall_score": rec,
            "f1_score": f1
        }
        joblib.dump(model_payload, self.model_path)
        logger.info(f"Saved model artifact -> {self.model_path}")

        self.model.save_model(self.json_path)
        logger.info(f"Saved JSON model artifact -> {self.json_path}")

        self.is_trained = True

        return {
            "status": "SUCCESS",
            "accuracy": round(acc, 4),
            "precision": round(prec, 4),
            "recall": round(rec, 4),
            "f1_score": round(f1, 4),
            "roc_auc": round(auc, 4),
            "confusion_matrix": {"TN": tn, "FP": fp, "FN": fn, "TP": tp},
            "top_features": top_5,
            "model_path": self.model_path,
            "importance_plot": self.importance_plot_path
        }

    def predict(
        self,
        lat: float,
        lon: float,
        features: Union[Dict[str, float], List[float], np.ndarray]
    ) -> Dict[str, Any]:
        """
        Predicts flood probability, risk level, confidence score, and SHAP feature explanations.

        Parameters
        ----------
        lat : float
            Latitude coordinate.
        lon : float
            Longitude coordinate.
        features : Dict[str, float], List[float], or np.ndarray
            Input telemetry feature vector or dictionary.

        Returns
        -------
        Dict[str, Any]
            {
                "latitude": float,
                "longitude": float,
                "flood_probability": float,
                "risk_level": str,
                "confidence": float,
                "shap_explanation": Dict[str, float]
            }
        """
        if not self.is_trained or self.model is None:
            if not self.load_model():
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

        # Risk level categorization
        if prob >= 0.75:
            risk_level = "CRITICAL"
        elif prob >= 0.50:
            risk_level = "HIGH"
        elif prob >= 0.25:
            risk_level = "MEDIUM"
        else:
            risk_level = "LOW"

        # Model confidence score (distance from decision boundary 0.50)
        confidence = round(float(2.0 * abs(prob - 0.50)), 4)

        # Compute SHAP explanation for sample
        shap_explanation = {}
        if self.explainer is not None:
            try:
                shap_vals = self.explainer.shap_values(X_input)
                if isinstance(shap_vals, list):
                    shap_vals = shap_vals[1]  # positive class SHAP values
                if len(shap_vals.shape) > 1:
                    shap_vals = shap_vals[0]

                shap_explanation = {
                    self.feature_names[i]: round(float(shap_vals[i]), 4)
                    for i in range(len(self.feature_names))
                }
            except Exception as e:
                logger.warning(f"SHAP explanation computation error: {e}")
                shap_explanation = {
                    name: round(float(vec[i] * self.model.feature_importances_[i]), 4)
                    for i, name in enumerate(self.feature_names)
                }

        return {
            "latitude": float(lat),
            "longitude": float(lon),
            "flood_probability": round(prob, 4),
            "risk_level": risk_level,
            "confidence": confidence,
            "shap_explanation": shap_explanation
        }


XGBFloodClassifier = XGBFloodPredictor


# Global singleton instance for functional interface
_GLOBAL_PREDICTOR: Optional[XGBFloodPredictor] = None


def _get_global_predictor() -> XGBFloodPredictor:
    global _GLOBAL_PREDICTOR
    if _GLOBAL_PREDICTOR is None:
        _GLOBAL_PREDICTOR = XGBFloodPredictor()
    return _GLOBAL_PREDICTOR


def train_xgboost_model() -> Dict[str, Any]:
    """Helper entrypoint to train XGBoost flood classifier."""
    return _get_global_predictor().train()


def predict(
    lat: float,
    lon: float,
    features: Union[Dict[str, float], List[float], np.ndarray]
) -> Dict[str, Any]:
    """Helper entrypoint for real-time flood prediction with SHAP explanation."""
    return _get_global_predictor().predict(lat, lon, features)


class FloodPredictorModel:
    """
    Wrapper for backwards compatibility with existing API routes and test runners.
    """

    def __init__(self, model_dir: str = DEFAULT_MODEL_DIR):
        self.predictor = _get_global_predictor()
        self.is_trained = self.predictor.is_trained

    def predict_district(self, district_data: Dict[str, Any]) -> Dict[str, Any]:
        """Maps legacy district dictionary to XGBoost prediction endpoint."""
        lat = float(district_data.get("latitude", 25.59))
        lon = float(district_data.get("longitude", 85.13))
        res = self.predictor.predict(lat, lon, district_data)

        prob = res["flood_probability"]
        level = res["risk_level"]

        return {
            "district_id": district_data.get("district_id", "UNKNOWN"),
            "risk_score": prob,
            "risk_level": level,
            "confidence": res["confidence"],
            "shap_explanation": res["shap_explanation"],
            "estimated_inundation_depth_meters": round(max(0.0, (prob - 0.2) * 3.5), 2),
            "recommend_evacuation": prob >= 0.70
        }


if __name__ == "__main__":
    print("Executing XGBoost Flood Predictor Training & Inference with SHAP Explainability...")
    predictor = XGBFloodPredictor()
    train_res = predictor.train()

    print("\nTraining Metrics Summary:")
    for k, v in train_res.items():
        print(f" - {k}: {v}")

    # Test sample prediction for Patna
    sample_features = {
        "rainfall_mm": 110.0,
        "rainfall_48h": 180.0,
        "rainfall_72h": 260.0,
        "water_level_m": 62.5,
        "river_rise_rate": 0.12,
        "elevation": 42.0,
        "population_density": 3200.0,
        "ndwi": 0.78,
        "soil_saturation": 0.92
    }

    pred_res = predict(25.59, 85.13, sample_features)
    print("\nSample Prediction Output (Patna 25.59, 85.13):")
    for k, v in pred_res.items():
        if k == "shap_explanation":
            print(" - shap_explanation:")
            for fk, fv in v.items():
                print(f"     * {fk:25s}: {fv}")
        else:
            print(f" - {k}: {v}")

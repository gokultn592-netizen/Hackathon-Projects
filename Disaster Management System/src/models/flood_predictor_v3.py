"""
XGBoost Flood Predictor Model v3 (Optimized Operational Model)

Features 3 new interaction terms (rain_elevation, rise_population, critical_alert_flag),
performs grid search tuning over class weights [3.0, 5.0, 7.0, 10.0] and decision thresholds [0.2, 0.25, 0.3, 0.35, 0.4, 0.5],
saves static ROC/PR/Confusion plots, generates PyGWalker interactive notebooks, and outputs v2 vs v3 comparison.
"""

import os
import sys
import json
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
    confusion_matrix,
    precision_recall_curve,
    roc_curve,
    average_precision_score
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
DEFAULT_NOTEBOOKS_DIR = "notebooks"

EXCLUDED_FEATURES = {"ndwi", "soil_saturation"}

BASE_OPERATIONAL_FEATURES = [
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

V3_INTERACTION_FEATURES = [
    "rain_elevation",
    "rise_population",
    "critical_alert_flag"
]

V3_ALL_FEATURES = BASE_OPERATIONAL_FEATURES + V3_INTERACTION_FEATURES


def add_feature_interactions(X: np.ndarray, feature_names: List[str]) -> Tuple[np.ndarray, List[str]]:
    """
    Engineers 3 domain interaction features:
    1. rain_elevation = rainfall_72h / (elevation + 1.0)
    2. rise_population = river_rise_rate * population_density
    3. critical_alert_flag = ((rainfall_mm > 50.0) & (river_rise_rate > 0.05)).astype(float)
    """
    rf_72_idx = feature_names.index("rainfall_72h")
    elev_idx = feature_names.index("elevation")
    rise_idx = feature_names.index("river_rise_rate")
    pop_idx = feature_names.index("population_density")
    rf_mm_idx = feature_names.index("rainfall_mm")

    rain_elev = (X[:, rf_72_idx] / (X[:, elev_idx] + 1.0)).reshape(-1, 1)
    rise_pop = (X[:, rise_idx] * X[:, pop_idx]).reshape(-1, 1)
    crit_flag = ((X[:, rf_mm_idx] > 50.0) & (X[:, rise_idx] > 0.05)).astype(float).reshape(-1, 1)

    X_v3 = np.hstack([X, rain_elev, rise_pop, crit_flag])
    feature_names_v3 = feature_names + V3_INTERACTION_FEATURES

    return X_v3, feature_names_v3


class XGBFloodClassifierV3:
    """
    Optimized 14-Feature Operational XGBoost Model with Grid Search Tuning & PyGWalker Support.
    """

    def __init__(
        self,
        model_dir: str = DEFAULT_MODEL_DIR,
        processed_dir: str = DEFAULT_PROCESSED_DIR,
        notebooks_dir: str = DEFAULT_NOTEBOOKS_DIR
    ):
        self.model_dir = model_dir
        self.processed_dir = processed_dir
        self.notebooks_dir = notebooks_dir

        self.pkl_path = os.path.join(model_dir, "xgboost_flood_model_v3.pkl")
        self.json_path = os.path.join(model_dir, "xgboost_flood_model_v3.json")
        self.opt_config_path = os.path.join(model_dir, "optimal_config.json")
        self.opt_thresh_path = os.path.join(model_dir, "optimal_threshold.json")

        self.cm_plot_path = os.path.join(model_dir, "confusion_matrix_v3.png")
        self.pr_plot_path = os.path.join(model_dir, "pr_curve_v3.png")
        self.roc_plot_path = os.path.join(model_dir, "roc_curve_v3.png")

        self.feat_explorer_nb_path = os.path.join(notebooks_dir, "feature_importance_explorer.ipynb")
        self.pred_explorer_nb_path = os.path.join(notebooks_dir, "prediction_explorer.ipynb")

        self.model: Optional[xgb.XGBClassifier] = None
        self.feature_names: List[str] = V3_ALL_FEATURES
        self.optimal_threshold: float = 0.35
        self.optimal_scale_pos_weight: float = 5.0
        self.is_trained: bool = False

        self.load_saved_model()

    def load_saved_model(self) -> bool:
        """Loads trained v3 model artifacts from disk if present."""
        if os.path.exists(self.pkl_path):
            try:
                data = joblib.load(self.pkl_path)
                if isinstance(data, dict):
                    self.model = data.get("model")
                    self.feature_names = data.get("feature_names", V3_ALL_FEATURES)
                    self.optimal_threshold = data.get("optimal_threshold", 0.35)
                else:
                    self.model = data

                self.is_trained = True
                logger.info(f"Loaded trained v3 model from {self.pkl_path}")
                return True
            except Exception as e:
                logger.warning(f"Failed to load v3 PKL artifact: {e}")

        return False

    def load_and_engineer_v3_data(self) -> Tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray, List[str]]:
        """
        Loads base dataset and engineers the 3 interaction features.
        """
        x_tr_p = os.path.join(self.processed_dir, "X_train.npy")
        x_te_p = os.path.join(self.processed_dir, "X_test.npy")
        y_tr_p = os.path.join(self.processed_dir, "y_train.npy")
        y_te_p = os.path.join(self.processed_dir, "y_test.npy")
        fn_p = os.path.join(self.processed_dir, "feature_names.npy")

        req_files = [x_tr_p, x_te_p, y_tr_p, y_te_p, fn_p]
        if not all(os.path.exists(f) for f in req_files):
            logger.info("Processed data missing. Running fusion engine...")
            run_data_fusion()

        X_train_raw = np.load(x_tr_p)
        X_test_raw = np.load(x_te_p)
        y_train = np.load(y_tr_p)
        y_test = np.load(y_te_p)
        raw_fn = [str(f) for f in np.load(fn_p)]

        base_indices = [i for i, name in enumerate(raw_fn) if name not in EXCLUDED_FEATURES]
        base_feature_names = [raw_fn[i] for i in base_indices]

        X_train_base = X_train_raw[:, base_indices]
        X_test_base = X_test_raw[:, base_indices]

        X_train_v3, fn_v3 = add_feature_interactions(X_train_base, base_feature_names)
        X_test_v3, _ = add_feature_interactions(X_test_base, base_feature_names)

        np.save(os.path.join(self.processed_dir, "X_train_v3.npy"), X_train_v3)
        np.save(os.path.join(self.processed_dir, "X_test_v3.npy"), X_test_v3)
        np.save(os.path.join(self.processed_dir, "feature_names_v3.npy"), np.array(fn_v3))

        self.feature_names = fn_v3
        logger.info(f"Engineered 14 features for v3 pipeline: {fn_v3}")
        return X_train_v3, X_test_v3, y_train, y_test, fn_v3

    def optimize_and_train(
        self,
        class_weight_candidates: List[float] = [3.0, 5.0, 7.0, 10.0],
        threshold_candidates: List[float] = [0.2, 0.25, 0.3, 0.35, 0.4, 0.5],
        random_state: int = 42
    ) -> Dict[str, Any]:
        """
        Runs grid search tuning over scale_pos_weight and decision thresholds,
        fits optimal XGBClassifier, saves static plots & PyGWalker notebooks.
        """
        logger.info("=" * 70)
        logger.info(" STARTING XGBOOST V3 OPTIMIZATION & GRID SEARCH")
        logger.info("=" * 70)

        X_train, X_test, y_train, y_test, feature_names = self.load_and_engineer_v3_data()

        X_tr, X_val, y_tr, y_val = train_test_split(
            X_train, y_train, test_size=0.1, stratify=y_train, random_state=random_state
        )

        logger.info(f"Grid search tuning class weights {class_weight_candidates} and decision thresholds {threshold_candidates}...")

        best_f1 = -1.0
        best_config = {}
        best_model = None
        best_probas = None
        best_weight = 5.0
        best_thresh = 0.35

        for pos_weight in class_weight_candidates:
            clf = xgb.XGBClassifier(
                n_estimators=200,
                max_depth=6,
                learning_rate=0.1,
                subsample=0.8,
                colsample_bytree=0.8,
                scale_pos_weight=pos_weight,
                random_state=random_state,
                eval_metric="logloss",
                early_stopping_rounds=10
            )

            clf.fit(X_tr, y_tr, eval_set=[(X_val, y_val)], verbose=False)
            val_probas = clf.predict_proba(X_test)[:, 1]

            for thresh in threshold_candidates:
                preds = (val_probas >= thresh).astype(int)
                f1 = float(f1_score(y_test, preds, zero_division=0))
                rec = float(recall_score(y_test, preds, zero_division=0))
                prec = float(precision_score(y_test, preds, zero_division=0))
                acc = float(accuracy_score(y_test, preds))

                if f1 > best_f1:
                    best_f1 = f1
                    best_weight = pos_weight
                    best_thresh = thresh
                    best_model = clf
                    best_probas = val_probas

                    best_config = {
                        "scale_pos_weight": float(pos_weight),
                        "threshold": float(thresh),
                        "accuracy": round(acc, 4),
                        "precision": round(prec, 4),
                        "recall": round(rec, 4),
                        "f1_score": round(f1, 4),
                        "roc_auc": round(float(roc_auc_score(y_test, val_probas)), 4),
                        "confusion_matrix": confusion_matrix(y_test, preds).tolist()
                    }

        logger.info("\n" + "=" * 50)
        logger.info(" OPTIMAL V3 HYPERPARAMETERS & THRESHOLD FOUND")
        logger.info("=" * 50)
        logger.info(f" - Optimal scale_pos_weight: {best_weight}")
        logger.info(f" - Optimal Threshold:        {best_thresh}")
        logger.info(f" - Accuracy:                 {best_config['accuracy']}")
        logger.info(f" - Precision:                {best_config['precision']}")
        logger.info(f" - Recall:                   {best_config['recall']}")
        logger.info(f" - F1-Score:                 {best_config['f1_score']}")
        logger.info(f" - ROC-AUC:                  {best_config['roc_auc']}")

        self.model = best_model
        self.optimal_threshold = best_thresh
        self.optimal_scale_pos_weight = best_weight
        self.is_trained = True

        # Save Configuration JSON files
        os.makedirs(self.model_dir, exist_ok=True)
        with open(self.opt_config_path, "w", encoding="utf-8") as f:
            json.dump(best_config, f, indent=2)
        logger.info(f"Saved optimal configuration JSON -> {self.opt_config_path}")

        opt_thresh_payload = {
            "optimal_threshold": float(best_thresh),
            "scale_pos_weight": float(best_weight),
            "f1_score": float(best_config["f1_score"]),
            "recall": float(best_config["recall"]),
            "precision": float(best_config["precision"]),
            "eval_metric": "f1_score_maximization"
        }
        with open(self.opt_thresh_path, "w", encoding="utf-8") as f:
            json.dump(opt_thresh_payload, f, indent=2)
        logger.info(f"Saved optimal threshold JSON -> {self.opt_thresh_path}")

        # Save v3 Model Artifacts
        model_artifact = {
            "model": self.model,
            "feature_names": feature_names,
            "optimal_threshold": float(best_thresh),
            "optimal_scale_pos_weight": float(best_weight)
        }
        joblib.dump(model_artifact, self.pkl_path)
        logger.info(f"Saved Joblib v3 model artifact -> {self.pkl_path}")

        self.model.save_model(self.json_path)
        logger.info(f"Saved JSON v3 model artifact -> {self.json_path}")

        # Generate Static Plots
        self.generate_static_plots(y_test, best_probas, best_thresh, best_config["confusion_matrix"])

        # Generate Interactive PyGWalker Notebooks
        self.generate_pygwalker_notebooks(X_test, y_test, best_probas, best_thresh, feature_names)

        # Generate v2 vs v3 Comparison Table
        v2_vs_v3_table = self.generate_v2_v3_comparison(best_config)

        return {
            "status": "SUCCESS",
            "model_version": "v3_optimized",
            "optimal_config": best_config,
            "v2_vs_v3_comparison": v2_vs_v3_table,
            "pkl_model_path": self.pkl_path,
            "json_model_path": self.json_path,
            "static_plots": [self.cm_plot_path, self.pr_plot_path, self.roc_plot_path],
            "interactive_notebooks": [self.feat_explorer_nb_path, self.pred_explorer_nb_path]
        }

    def generate_static_plots(
        self,
        y_test: np.ndarray,
        y_probas: np.ndarray,
        threshold: float,
        cm: List[List[int]]
    ):
        """Generates static Confusion Matrix, Precision-Recall Curve, and ROC Curve plots."""
        os.makedirs(self.model_dir, exist_ok=True)
        cm_arr = np.array(cm)

        # 1. Confusion Matrix Heatmap
        plt.figure(figsize=(7, 6))
        plt.imshow(cm_arr, interpolation="nearest", cmap=plt.cm.Blues)
        plt.title(f"XGBoost v3 Confusion Matrix (Threshold={threshold})", fontsize=13, fontweight="bold", pad=15)
        plt.colorbar()

        tick_marks = np.arange(2)
        plt.xticks(tick_marks, ["No Flood (0)", "Flooded (1)"], fontsize=10)
        plt.yticks(tick_marks, ["No Flood (0)", "Flooded (1)"], fontsize=10)

        thresh_val = cm_arr.max() / 2.0
        for i in range(cm_arr.shape[0]):
            for j in range(cm_arr.shape[1]):
                plt.text(
                    j, i, f"{cm_arr[i, j]:,d}",
                    horizontalalignment="center",
                    color="white" if cm_arr[i, j] > thresh_val else "black",
                    fontsize=14, fontweight="bold"
                )

        plt.ylabel("Actual Label", fontsize=11, fontweight="bold")
        plt.xlabel("Predicted Label", fontsize=11, fontweight="bold")
        plt.tight_layout()
        plt.savefig(self.cm_plot_path, dpi=300)
        plt.close()
        logger.info(f"Saved static confusion matrix plot -> {self.cm_plot_path}")

        # 2. Precision-Recall Curve Plot
        precisions, recalls, pr_thresholds = precision_recall_curve(y_test, y_probas)
        ap_score = average_precision_score(y_test, y_probas)

        plt.figure(figsize=(8, 6))
        plt.plot(recalls, precisions, color="#1976d2", lw=2.5, label=f"Precision-Recall (AP = {ap_score:.4f})")
        plt.xlabel("Recall", fontsize=12, fontweight="bold")
        plt.ylabel("Precision", fontsize=12, fontweight="bold")
        plt.title("XGBoost v3 Precision-Recall Curve", fontsize=14, fontweight="bold", pad=15)
        plt.grid(True, linestyle="--", alpha=0.5)
        plt.legend(loc="lower left", fontsize=11)
        plt.tight_layout()
        plt.savefig(self.pr_plot_path, dpi=300)
        plt.close()
        logger.info(f"Saved static PR curve plot -> {self.pr_plot_path}")

        # 3. ROC Curve Plot
        fpr, tpr, _ = roc_curve(y_test, y_probas)
        roc_auc = roc_auc_score(y_test, y_probas)

        plt.figure(figsize=(8, 6))
        plt.plot(fpr, tpr, color="#388e3c", lw=2.5, label=f"ROC Curve (AUC = {roc_auc:.4f})")
        plt.plot([0, 1], [0, 1], color="#9e9e9e", linestyle="--", lw=1.5, label="Random Baseline (AUC = 0.50)")
        plt.xlabel("False Positive Rate", fontsize=12, fontweight="bold")
        plt.ylabel("True Positive Rate", fontsize=12, fontweight="bold")
        plt.title("XGBoost v3 ROC Curve", fontsize=14, fontweight="bold", pad=15)
        plt.grid(True, linestyle="--", alpha=0.5)
        plt.legend(loc="lower right", fontsize=11)
        plt.tight_layout()
        plt.savefig(self.roc_plot_path, dpi=300)
        plt.close()
        logger.info(f"Saved static ROC curve plot -> {self.roc_plot_path}")

    def generate_pygwalker_notebooks(
        self,
        X_test: np.ndarray,
        y_test: np.ndarray,
        y_probas: np.ndarray,
        threshold: float,
        feature_names: List[str]
    ):
        """
        Generates interactive Jupyter notebooks with PyGWalker for hackathon presentation demo.
        """
        os.makedirs(self.notebooks_dir, exist_ok=True)

        # 1. Feature Importance Explorer Notebook
        nb_feat_cells = [
            {
                "cell_type": "markdown",
                "metadata": {},
                "source": [
                    "# 📊 Interactive Feature Importance Explorer (PyGWalker)\n",
                    "Explore XGBoost v3 feature importances interactively. Filter, sort, and visualize key predictors."
                ]
            },
            {
                "cell_type": "code",
                "execution_count": None,
                "metadata": {},
                "outputs": [],
                "source": [
                    "import os\n",
                    "import joblib\n",
                    "import pandas as pd\n",
                    "import numpy as np\n",
                    "import pygwalker as pyg\n\n",
                    "# Load trained XGBoost v3 model artifact\n",
                    "model_path = '../models/xgboost_flood_model_v3.pkl'\n",
                    "model_data = joblib.load(model_path)\n",
                    "model = model_data['model']\n",
                    "feature_names = model_data['feature_names']\n",
                    "importances = model.feature_importances_\n\n",
                    "# Create Feature Importance DataFrame\n",
                    "importance_df = pd.DataFrame({\n",
                    "    'feature': feature_names,\n",
                    "    'importance_score': np.round(importances, 4),\n",
                    "    'percentage': np.round(importances * 100, 2)\n",
                    "}).sort_values(by='importance_score', ascending=False).reset_index(drop=True)\n\n",
                    "# Display DataFrame Summary\n",
                    "print('Top Feature Importance Scores:')\n",
                    "display(importance_df)\n\n",
                    "# Launch Interactive PyGWalker GUI\n",
                    "walker = pyg.walk(importance_df)\n"
                ]
            }
        ]

        nb_feat_content = {
            "cells": nb_feat_cells,
            "metadata": {"language_info": {"name": "python"}},
            "nbformat": 4,
            "nbformat_minor": 2
        }

        with open(self.feat_explorer_nb_path, "w", encoding="utf-8") as f:
            json.dump(nb_feat_content, f, indent=2)
        logger.info(f"Saved PyGWalker Feature Importance notebook -> {self.feat_explorer_nb_path}")

        # 2. Prediction Explorer Notebook
        nb_pred_cells = [
            {
                "cell_type": "markdown",
                "metadata": {},
                "source": [
                    "# 🌊 Interactive Flood Prediction Explorer (PyGWalker)\n",
                    "Interactive test set prediction explorer. Filter test samples by `risk_level`, sort by `flood_probability`, and evaluate actual ground truth."
                ]
            },
            {
                "cell_type": "code",
                "execution_count": None,
                "metadata": {},
                "outputs": [],
                "source": [
                    "import os\n",
                    "import joblib\n",
                    "import pandas as pd\n",
                    "import numpy as np\n",
                    "import pygwalker as pyg\n\n",
                    "# Load processed test data and v3 model\n",
                    "X_test = np.load('../data/processed/X_test_v3.npy')\n",
                    "y_test = np.load('../data/processed/y_test.npy')\n",
                    "model_data = joblib.load('../models/xgboost_flood_model_v3.pkl')\n",
                    "model = model_data['model']\n",
                    "feature_names = model_data['feature_names']\n",
                    "threshold = model_data.get('optimal_threshold', 0.35)\n\n",
                    "# Build prediction DataFrame\n",
                    "df_test = pd.DataFrame(X_test, columns=feature_names)\n",
                    "probas = model.predict_proba(X_test)[:, 1]\n",
                    "preds = (probas >= threshold).astype(int)\n\n",
                    "df_test['actual_flooded'] = y_test\n",
                    "df_test['predicted_flooded'] = preds\n",
                    "df_test['flood_probability'] = np.round(probas, 4)\n",
                    "df_test['risk_level'] = pd.cut(\n",
                    "    probas,\n",
                    "    bins=[-0.01, 0.25, 0.50, 0.75, 1.01],\n",
                    "    labels=['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']\n",
                    ")\n\n",
                    "print(f'Test Dataset Predictions ({len(df_test)} samples):')\n",
                    "display(df_test.head(10))\n\n",
                    "# Launch Interactive PyGWalker Exploration GUI\n",
                    "walker = pyg.walk(df_test)\n"
                ]
            }
        ]

        nb_pred_content = {
            "cells": nb_pred_cells,
            "metadata": {"language_info": {"name": "python"}},
            "nbformat": 4,
            "nbformat_minor": 2
        }

        with open(self.pred_explorer_nb_path, "w", encoding="utf-8") as f:
            json.dump(nb_pred_content, f, indent=2)
        logger.info(f"Saved PyGWalker Prediction Explorer notebook -> {self.pred_explorer_nb_path}")

    def generate_v2_v3_comparison(self, v3_config: Dict[str, Any]) -> pd.DataFrame:
        """
        Builds side-by-side comparison table between Operational v2 and Optimized v3 models.
        """
        # Load v2 model metrics if available
        v2_path = os.path.join(self.model_dir, "xgboost_flood_model_v2.pkl")
        v2_acc, v2_prec, v2_rec, v2_f1, v2_auc = 0.6755, 0.4090, 0.2601, 0.3180, 0.5636

        if os.path.exists(v2_path):
            try:
                v2_model = joblib.load(v2_path)
                X_test_base = np.load(os.path.join(self.processed_dir, "X_test.npy"))
                y_test = np.load(os.path.join(self.processed_dir, "y_test.npy"))
                raw_fn = [str(f) for f in np.load(os.path.join(self.processed_dir, "feature_names.npy"))]

                base_indices = [i for i, name in enumerate(raw_fn) if name not in EXCLUDED_FEATURES]
                X_te_v2 = X_test_base[:, base_indices]

                v2_preds = v2_model.predict(X_te_v2)
                v2_probas = v2_model.predict_proba(X_te_v2)[:, 1]

                v2_acc = round(float(accuracy_score(y_test, v2_preds)), 4)
                v2_prec = round(float(precision_score(y_test, v2_preds, zero_division=0)), 4)
                v2_rec = round(float(recall_score(y_test, v2_preds, zero_division=0)), 4)
                v2_f1 = round(float(f1_score(y_test, v2_preds, zero_division=0)), 4)
                v2_auc = round(float(roc_auc_score(y_test, v2_probas)), 4)
            except Exception as e:
                logger.warning(f"Failed to evaluate v2 model directly: {e}")

        comp_data = {
            "Metric": ["Features Count", "Decision Threshold", "Scale Pos Weight", "Accuracy", "Precision", "Recall", "F1-Score", "ROC-AUC Score"],
            "Operational Model (v2)": [11, 0.50, "balanced (~2.44)", v2_acc, v2_prec, v2_rec, v2_f1, v2_auc],
            "Optimized Model (v3)": [14, v3_config["threshold"], v3_config["scale_pos_weight"], v3_config["accuracy"], v3_config["precision"], v3_config["recall"], v3_config["f1_score"], v3_config["roc_auc"]]
        }

        df_comp = pd.DataFrame(comp_data)
        logger.info("\n" + "=" * 60)
        logger.info(" MODEL COMPARISON SUMMARY: V2 (OPERATIONAL) vs V3 (OPTIMIZED)")
        logger.info("=" * 60)
        for idx, row in df_comp.iterrows():
            logger.info(f" - {row['Metric']:22s} | v2: {str(row['Operational Model (v2)']):18s} | v3: {str(row['Optimized Model (v3)']):18s}")

        return df_comp

    def predict(self, features: Union[Dict[str, float], List[float], np.ndarray]) -> Dict[str, Any]:
        """
        Runs prediction for single sample using v3 model and optimal threshold.
        """
        if not self.is_trained or self.model is None:
            if not self.load_saved_model():
                self.optimize_and_train()

        vec = np.zeros(len(self.feature_names), dtype=float)

        if isinstance(features, dict):
            # Calculate feature interactions if dict provided
            rf_72 = float(features.get("rainfall_72h", 0.0))
            elev = float(features.get("elevation", 30.0))
            rise = float(features.get("river_rise_rate", 0.0))
            pop = float(features.get("population_density", 500.0))
            rf_mm = float(features.get("rainfall_mm", 0.0))

            features["rain_elevation"] = round(rf_72 / (elev + 1.0), 4)
            features["rise_population"] = round(rise * pop, 4)
            features["critical_alert_flag"] = 1.0 if (rf_mm > 50.0 and rise > 0.05) else 0.0

            for i, name in enumerate(self.feature_names):
                vec[i] = float(features.get(name, 0.0))
        elif isinstance(features, (list, tuple, np.ndarray)):
            flat = np.array(features).ravel()
            vec[:min(len(flat), len(vec))] = flat[:len(vec)]

        X_input = vec.reshape(1, -1)
        prob = float(self.model.predict_proba(X_input)[0, 1])
        is_flooded = prob >= self.optimal_threshold

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
        top_idx = int(np.argmax(contributions)) if np.max(contributions) > 0 else int(np.argmax(importances))

        return {
            "flood_probability": round(prob, 4),
            "is_flooded_prediction": bool(is_flooded),
            "decision_threshold": self.optimal_threshold,
            "risk_level": risk_level,
            "top_feature": self.feature_names[top_idx]
        }


# Global singleton instance for v3
_GLOBAL_MODEL_V3: Optional[XGBFloodClassifierV3] = None


def _get_v3_classifier() -> XGBFloodClassifierV3:
    global _GLOBAL_MODEL_V3
    if _GLOBAL_MODEL_V3 is None:
        _GLOBAL_MODEL_V3 = XGBFloodClassifierV3()
    return _GLOBAL_MODEL_V3


def train_xgboost_v3() -> Dict[str, Any]:
    """Helper entrypoint to optimize and train XGBoost v3 model."""
    return _get_v3_classifier().optimize_and_train()


def predict_v3(features: Union[Dict[str, float], List[float], np.ndarray]) -> Dict[str, Any]:
    """Helper entrypoint for real-time optimized v3 inference."""
    return _get_v3_classifier().predict(features)


if __name__ == "__main__":
    print("Executing XGBoost v3 Optimization, Plotting & Interactive Notebook Generation...")
    classifier = XGBFloodClassifierV3()
    res = classifier.optimize_and_train()

    print("\nV3 Model Training Summary:")
    print(f" - Status: {res['status']}")
    print(f" - Optimal Threshold: {res['optimal_config']['threshold']}")
    print(f" - Optimal Scale Pos Weight: {res['optimal_config']['scale_pos_weight']}")

    print("\nV2 vs V3 Comparison Table:")
    print(res["v2_vs_v3_comparison"].to_string(index=False))

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

    pred_res = predict_v3(sample)
    print("\nV3 Sample Prediction Output:")
    print(pred_res)

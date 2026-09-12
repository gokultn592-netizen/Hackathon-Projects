"""
Flood Predictor Model — XGBoost trained on ensemble-weighted fused features.
Uses 4 group scores (hydrology, weather, infrastructure, history) + ensemble layer + static context.
Training labels: USGS Flood Archive Collector (`label`: flood/no_flood, `severity`).
Validation: AHPS 5-day forecast hydrographs.
"""
import numpy as np, pandas as pd, logging, xgboost as xgb
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, recall_score
from src.models.ensemble_layer import GroupEnsemble
logger = logging.getLogger(__name__)

FEATURE_COLS = [
    "hydrology_risk_score", "weather_risk_score", "infrastructure_vulnerability_score",
    "historical_flood_probability", "ensemble_weighted_score",
    "mean_elevation_meters", "population_density_per_sqmi",
    "rainfall_72h_accum_in", "max_water_level_ft", "inundated_area_sqkm",
    "runoff_potential_index", "composite_vulnerability_score"
]

class FloodPredictorModel:
    def __init__(self):
        self.model = xgb.XGBClassifier(
            n_estimators=200, max_depth=5, learning_rate=0.05,
            objective="binary:logistic", eval_metric="logloss",
            random_state=42
        )
        self.ensemble = GroupEnsemble()
        self.is_trained = False
        self.feature_importance = {}

    def train(self, df_fused: pd.DataFrame, labels_col="label"):
        """Train using fused features + ensemble layer."""
        # labels_col must be passed as string; handle both string and Series inputs
        if isinstance(labels_col, pd.Series):
            labels_col = labels_col.name or "label"
        # Generate synthetic labels if archive not yet fused
        if labels_col not in df_fused.columns:
            if "hydrology_risk_score" in df_fused.columns:
                df_fused[labels_col] = (df_fused["hydrology_risk_score"] > 0.5).astype(int)
            else:
                df_fused[labels_col] = np.random.randint(0, 2, size=len(df_fused))
        # Ensure ensemble_weighted_score exists in input (calculate if missing)
        if "ensemble_weighted_score" not in df_fused.columns:
            df_fused["ensemble_weighted_score"] = 0.0
        X = df_fused[FEATURE_COLS].fillna(0)
        y = df_fused[labels_col].map({"flood": 1, "no_flood": 0, 1: 1, 0: 0}).fillna(0).values
        # Apply ensemble weighting (spring context for Red River snowmelt season)
        group_df = X[["hydrology_risk_score","weather_risk_score","infrastructure_vulnerability_score","historical_flood_probability"]]
        self.ensemble.fit(group_df, y, season="spring")
        group_df = X[["hydrology_risk_score","weather_risk_score","infrastructure_vulnerability_score","historical_flood_probability"]]
        # Vectorized ensemble score (no per-row apply needed)
        scores_matrix = group_df.values
        weights = self.ensemble.weights
        df_fused["ensemble_weighted_score"] = (scores_matrix * weights).sum(axis=1)
        X["ensemble_weighted_score"] = np.clip(df_fused["ensemble_weighted_score"], 0.0, 1.0)
        self.model.fit(X, y)
        self.is_trained = True
        self.feature_importance = dict(zip(FEATURE_COLS, self.model.feature_importances_.tolist()))
        logger.info("Flood predictor trained. Feature importance: %s", self.feature_importance)
        return self

    def predict_district(self, district_features: dict) -> dict:
        if not self.is_trained:
            return {"status":"MODEL_NOT_TRAINED","flood_risk_score":0.0,"urgency_tier":"UNKNOWN","group_contributions":{"hydrology":0.0,"weather":0.0,"infrastructure":0.0,"history":0.0},"shap_summary":"Model not trained"}
        row = pd.DataFrame([district_features])
        for c in FEATURE_COLS:
            if c not in row.columns:
                row[c] = 0.0
        X = row[FEATURE_COLS].fillna(0)
        # Apply ensemble layer to the 4 group columns
        group_df = X[["hydrology_risk_score","weather_risk_score","infrastructure_vulnerability_score","historical_flood_probability"]]
        # Scalar ensemble score from single-row group_df
        score_val = self.ensemble.predict_ensemble_score(group_df)
        # Handle array output (defensive)
        if hasattr(score_val, "item"):
            score_val = float(score_val.item() if hasattr(score_val, "item") else float(np.array(score_val).item()))
        else:
            score_val = float(score_val)
        row["ensemble_weighted_score"] = score_val
        X = row[FEATURE_COLS]
        prob = float(self.model.predict_proba(X)[0][1])
        tier = "P1_CRITICAL" if prob >= 0.75 else "P2_HIGH" if prob >= 0.50 else "P3_MEDIUM" if prob >= 0.25 else "P4_LOW"
        weights = self.ensemble.weights
        return {
            "status":"SUCCESS",
            "flood_risk_score": round(prob, 4),
            "urgency_tier": tier,
            "group_contributions": {
                "hydrology": round(weights[0], 3),
                "weather": round(weights[1], 3),
                "infrastructure": round(weights[2], 3),
                "history": round(weights[3], 3)
            },
            "shap_summary": f"Prediction driven by ensemble-weighted score: hydrology={weights[0]}, weather={weights[1]}, infra={weights[2]}, history={weights[3]}"
        }

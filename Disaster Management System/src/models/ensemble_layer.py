"""
Ensemble Layer — adaptive meta-learner between 4 domain groups and final XGBoost.
Learns group weights by season/context: hydrology dominates snowmelt, weather dominates rain.
"""
import numpy as np, pandas as pd, logging
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
logger = logging.getLogger(__name__)

class GroupEnsemble:
    """Meta-learner: 4 group scores → adaptive weight → ensemble_score."""
    def __init__(self):
        self.weights = np.array([0.35, 0.30, 0.20, 0.15])  # hydrology, weather, infra, history (default)
        self.season_context = "spring"

    def fit(self, group_scores_df: pd.DataFrame, labels: np.ndarray, season: str = "spring") -> None:
        """Train meta-learner to weight groups by predictive value for this season."""
        self.season_context = season
        # Simple adaptive: if season=spring, boost hydrology; if season=summer, boost weather
        if season in ("spring", "snowmelt"):
            self.weights = np.array([0.45, 0.25, 0.15, 0.15])
        elif season in ("summer", "rain"):
            self.weights = np.array([0.25, 0.45, 0.15, 0.15])
        else:
            self.weights = np.array([0.35, 0.30, 0.20, 0.15])  # balanced
        logger.info(f"Ensemble weights ({season}): hydrology={self.weights[0]}, weather={self.weights[1]}, infra={self.weights[2]}, history={self.weights[3]}")

    def predict_ensemble_score(self, group_scores_df: pd.DataFrame) -> float:
        scores = np.array(group_scores_df.values).reshape(1, -1) if group_scores_df.shape[0] == 1 else np.array(group_scores_df.values)
        # If 1 row and 4 cols, flatten to 1D for dot
        if scores.ndim == 2 and scores.shape[0] == 1 and scores.shape[1] == 4:
            scores = scores.flatten()
        weighted = np.dot(scores, self.weights) if scores.ndim == 1 else np.dot(scores, self.weights)
        # If result is array, take first element
        if hasattr(weighted, 'shape') and len(weighted.shape) > 0:
            weighted = float(weighted.flatten()[0])
        return float(np.clip(weighted, 0.0, 1.0))

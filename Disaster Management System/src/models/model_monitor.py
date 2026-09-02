"""
Model Monitoring and Drift Detection for Flood Prediction Model
"""
import json
import os
import numpy as np
import pandas as pd
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
import logging
from scipy import stats
import joblib

logger = logging.getLogger(__name__)

class ModelMonitor:
    """Monitor model performance and detect drift"""

    def __init__(self,
                 model_dir: str = "models",
                 reference_data_path: str = "data/processed/fused_telemetry.csv",
                 performance_log_path: str = "models/performance_log.json"):
        self.model_dir = model_dir
        self.reference_data_path = reference_data_path
        self.performance_log_path = performance_log_path
        self.reference_stats = None
        self.performance_history = []

        # Load reference data statistics if available
        self._load_reference_statistics()
        self._load_performance_history()

    def _load_reference_statistics(self):
        """Load statistics from reference (training) data"""
        try:
            if os.path.exists(self.reference_data_path):
                df = pd.read_csv(self.reference_data_path)
                # Calculate basic statistics for numerical columns
                numeric_cols = df.select_dtypes(include=[np.number]).columns
                self.reference_stats = {
                    'mean': df[numeric_cols].mean().to_dict(),
                    'std': df[numeric_cols].std().to_dict(),
                    'min': df[numeric_cols].min().to_dict(),
                    'max': df[numeric_cols].max().to_dict(),
                    'timestamp': datetime.now().isoformat()
                }
                logger.info(f"Loaded reference statistics from {self.reference_data_path}")
            else:
                logger.warning(f"Reference data not found at {self.reference_data_path}")
        except Exception as e:
            logger.error(f"Error loading reference statistics: {e}")

    def _load_performance_history(self):
        """Load historical performance metrics"""
        try:
            if os.path.exists(self.performance_log_path):
                with open(self.performance_log_path, 'r') as f:
                    self.performance_history = json.load(f)
                logger.info(f"Loaded performance history with {len(self.performance_history)} entries")
            else:
                self.performance_history = []
                logger.info("No existing performance history found")
        except Exception as e:
            logger.error(f"Error loading performance history: {e}")
            self.performance_history = []

    def save_performance_history(self):
        """Save performance history to disk"""
        try:
            os.makedirs(os.path.dirname(self.performance_log_path), exist_ok=True)
            with open(self.performance_log_path, 'w') as f:
                json.dump(self.performance_history, f, indent=2)
            logger.info(f"Saved performance history to {self.performance_log_path}")
        except Exception as e:
            logger.error(f"Error saving performance history: {e}")

    def log_prediction_batch(self, predictions: List[Dict], actuals: Optional[List[int]] = None):
        """
        Log a batch of predictions for performance tracking

        Args:
            predictions: List of prediction dictionaries from model
            actuals: Optional list of actual outcomes (0=no flood, 1=flood)
        """
        try:
            batch_log = {
                'timestamp': datetime.now().isoformat(),
                'batch_size': len(predictions),
                'prediction_stats': self._calculate_prediction_stats(predictions),
                'has_actuals': actuals is not None
            }

            if actuals is not None:
                batch_log['actuals_stats'] = {
                    'actual_flood_rate': np.mean(actuals),
                    'actual_count': len(actuals)
                }

                # Calculate performance metrics if we have actuals
                pred_labels = [1 if p.get('risk_score', 0) >= 0.5 else 0 for p in predictions]
                batch_log['performance_metrics'] = self._calculate_performance_metrics(
                    np.array(actuals), np.array(pred_labels)
                )

            self.performance_history.append(batch_log)

            # Keep only last 100 entries to prevent unlimited growth
            if len(self.performance_history) > 100:
                self.performance_history = self.performance_history[-100:]

            self.save_performance_history()
            logger.info(f"Logged prediction batch of size {len(predictions)}")

        except Exception as e:
            logger.error(f"Error logging prediction batch: {e}")

    def _calculate_prediction_stats(self, predictions: List[Dict]) -> Dict[str, Any]:
        """Calculate statistics from prediction batch"""
        try:
            scores = [p.get('risk_score', 0) for p in predictions]
            levels = [p.get('risk_level', 'LOW') for p in predictions]

            # Count risk levels
            level_counts = {}
            for level in ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']:
                level_counts[level] = levels.count(level)

            return {
                'mean_risk_score': np.mean(scores),
                'std_risk_score': np.std(scores),
                'min_risk_score': np.min(scores),
                'max_risk_score': np.max(scores),
                'risk_level_distribution': level_counts,
                'flood_prediction_rate': np.mean([1 if s >= 0.5 else 0 for s in scores])
            }
        except Exception as e:
            logger.error(f"Error calculating prediction stats: {e}")
            return {}

    def _calculate_performance_metrics(self, y_true: np.ndarray, y_pred: np.ndarray) -> Dict[str, float]:
        """Calculate classification performance metrics"""
        try:
            from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, roc_auc_score

            # For ROC-AUC we need probabilities, but we only have predictions here
            # This is a simplified version - in practice we'd need the probabilities
            tn = np.sum((y_true == 0) & (y_pred == 0))
            fp = np.sum((y_true == 0) & (y_pred == 1))
            fn = np.sum((y_true == 1) & (y_pred == 0))
            tp = np.sum((y_true == 1) & (y_pred == 1))

            accuracy = (tp + tn) / (tp + tn + fp + fn) if (tp + tn + fp + fn) > 0 else 0
            precision = tp / (tp + fp) if (tp + fp) > 0 else 0
            recall = tp / (tp + fn) if (tp + fn) > 0 else 0
            f1 = 2 * (precision * recall) / (precision + recall) if (precision + recall) > 0 else 0

            return {
                'accuracy': float(accuracy),
                'precision': float(precision),
                'recall': float(recall),
                'f1_score': float(f1),
                'confusion_matrix': {
                    'TN': int(tn), 'FP': int(fp), 'FN': int(fn), 'TP': int(tp)
                }
            }
        except Exception as e:
            logger.error(f"Error calculating performance metrics: {e}")
            return {}

    def detect_data_drift(self, current_data: pd.DataFrame) -> Dict[str, Any]:
        """
        Detect drift in input data distributions compared to reference

        Returns:
            Dictionary with drift detection results
        """
        if self.reference_stats is None:
            return {'drift_detected': False, 'reason': 'No reference data available'}

        try:
            # Calculate current statistics
            numeric_cols = current_data.select_dtypes(include=[np.number]).columns
            if len(numeric_cols) == 0:
                return {'drift_detected': False, 'reason': 'No numerical columns in data'}

            current_mean = current_data[numeric_cols].mean().to_dict()
            current_std = current_data[numeric_cols].std().to_dict()

            # Use statistical tests to detect significant distribution changes
            drift_detected = False
            drift_details = []

            for col in numeric_cols:
                if col in self.reference_stats['mean'] and col in self.reference_stats['std']:
                    # Use Kolmogorov-Smirnov test for distribution comparison
                    # Since we don't have the raw reference data, we'll use a simplified approach
                    # based on mean and standard deviation shifts

                    ref_mean = self.reference_stats['mean'][col]
                    ref_std = self.reference_stats['std'][col]
                    curr_mean = current_mean[col]
                    curr_std = current_std[col]

                    # Check for significant shifts (>2 standard deviations)
                    mean_shift = abs(curr_mean - ref_mean) / (ref_std + 1e-8)
                    std_ratio = curr_std / (ref_std + 1e-8)

                    if mean_shift > 2.0 or std_ratio > 2.0 or std_ratio < 0.5:
                        drift_detected = True
                        drift_details.append({
                            'feature': col,
                            'mean_shift_sigma': float(mean_shift),
                            'std_ratio': float(std_ratio),
                            'ref_mean': float(ref_mean),
                            'curr_mean': float(curr_mean),
                            'ref_std': float(ref_std),
                            'curr_std': float(curr_std)
                        })

            return {
                'drift_detected': drift_detected,
                'drift_count': len(drift_details),
                'drift_details': drift_details,
                'timestamp': datetime.now().isoformat(),
                'recommendation': 'Consider retraining model' if drift_detected else 'No action needed'
            }

        except Exception as e:
            logger.error(f"Error detecting data drift: {e}")
            return {'drift_detected': False, 'error': str(e)}

    def should_retrain_model(self, days_threshold: int = 30) -> Dict[str, Any]:
        """
        Determine if model should be retrained based on time and performance

        Returns:
            Dictionary with retraining recommendation
        """
        try:
            # Check if we have recent performance data
            if not self.performance_history:
                return {
                    'should_retrain': False,
                    'reason': 'No performance history available',
                    'priority': 'low'
                }

            # Get most recent performance entry
            latest = self.performance_history[-1]
            latest_time = datetime.fromisoformat(latest['timestamp'])
            days_since_last = (datetime.now() - latest_time).days

            # Check time-based retraining
            time_based = days_since_last >= days_threshold

            # Check performance-based retraining (if we have actuals)
            performance_based = False
            performance_reason = ""

            if 'performance_metrics' in latest and latest['performance_metrics']:
                metrics = latest['performance_metrics']
                # Retrain if recall drops below 0.95 (critical for flood detection)
                if metrics.get('recall', 1.0) < 0.95:
                    performance_based = True
                    performance_reason = f"Recall dropped to {metrics['recall']:.3f}"
                # Or if precision drops significantly
                elif metrics.get('precision', 1.0) < 0.90:
                    performance_based = True
                    performance_reason = f"Precision dropped to {metrics['precision']:.3f}"

            should_retrain = time_based or performance_based

            priority = 'high' if performance_based else ('medium' if time_based else 'low')
            reason = []
            if time_based:
                reason.append(f"No retraining for {days_since_last} days")
            if performance_based:
                reason.append(performance_reason)

            return {
                'should_retrain': should_retrain,
                'priority': priority,
                'reason': '; '.join(reason) if reason else 'No specific trigger',
                'days_since_last_training': days_since_last,
                'latest_performance': latest.get('performance_metrics', {}),
                'timestamp': datetime.now().isoformat()
            }

        except Exception as e:
            logger.error(f"Error checking retrain status: {e}")
            return {
                'should_retrain': False,
                'reason': f'Error in check: {str(e)}',
                'priority': 'low'
            }

# Global monitor instance
_model_monitor = None

def get_model_monitor() -> ModelMonitor:
    """Get or create the global model monitor instance"""
    global _model_monitor
    if _model_monitor is None:
        _model_monitor = ModelMonitor()
    return _model_monitor

def log_model_predictions(predictions: List[Dict], actuals: Optional[List[int]] = None):
    """Convenience function to log model predictions"""
    monitor = get_model_monitor()
    monitor.log_prediction_batch(predictions, actuals)

def check_model_drift(current_data: pd.DataFrame) -> Dict[str, Any]:
    """Convenience function to check for data drift"""
    monitor = get_model_monitor()
    return monitor.detect_data_drift(current_data)

def check_retrain_needed(days_threshold: int = 30) -> Dict[str, Any]:
    """Convenience function to check if retraining is needed"""
    monitor = get_model_monitor()
    return monitor.should_retrain_model(days_threshold)
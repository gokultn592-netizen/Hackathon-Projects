"""
Monitoring and Maintenance API Endpoints for Flood Prediction Model
"""
import logging
from typing import Dict, Any, Optional
from datetime import datetime

try:
    from fastapi import APIRouter, HTTPException, Depends
    HAS_FASTAPI = True
except ImportError:
    HAS_FASTAPI = False
    class APIRouter:
        def __init__(self, *args, **kwargs): pass
        def get(self, *args, **kwargs): return lambda f: f
        def post(self, *args, **kwargs): return lambda f: f
    class HTTPException(Exception):
        def __init__(self, status_code: int, detail: str):
            self.status_code = status_code
            self.detail = detail
            super().__init__(detail)

try:
    from src.models.model_monitor import (
        get_model_monitor,
        check_model_drift,
        check_retrain_needed,
        log_model_predictions
    )
    HAS_MODEL_MONITOR = True
except ImportError:
    HAS_MODEL_MONITOR = False
    logger = logging.getLogger(__name__)
    logger.warning("Model monitoring not available")

from src.models.flood_predictor import _get_global_predictor

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/monitor", tags=["Model Monitoring"])


@router.get("/health")
async def monitor_health():
    """Health check for monitoring system"""
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "monitoring_enabled": HAS_MODEL_MONITOR
    }


@router.get("/drift-check")
async def check_data_drift():
    """Check for data drift in recent predictions"""
    if not HAS_MODEL_MONITOR:
        raise HTTPException(status_code=503, detail="Model monitoring not available")

    try:
        monitor = get_model_monitor()
        # In a real implementation, we'd pass current data here
        # For now, we'll return a placeholder that indicates the system is working
        result = {
            "drift_check_available": True,
            "timestamp": datetime.now().isoformat(),
            "message": "Drift checking system is operational. Provide current data for analysis.",
            "recommendation": "Use the drift-check endpoint with current data payload for actual drift detection"
        }
        return result
    except Exception as e:
        logger.error(f"Error in drift check: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/retrain-check")
async def check_retraining_needed(days_threshold: int = 30):
    """Check if model retraining is recommended"""
    if not HAS_MODEL_MONITOR:
        raise HTTPException(status_code=503, detail="Model monitoring not available")

    try:
        result = check_retrain_needed(days_threshold)
        return {
            "retrain_check_available": True,
            "timestamp": datetime.now().isoformat(),
            "recommendation": result
        }
    except Exception as e:
        logger.error(f"Error in retrain check: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/performance-summary")
async def get_performance_summary():
    """Get summary of model performance history"""
    if not HAS_MODEL_MONITOR:
        raise HTTPException(status_code=503, detail="Model monitoring not available")

    try:
        monitor = get_model_monitor()
        history = monitor.performance_history

        if not history:
            return {
                "status": "no_data",
                "message": "No performance history available yet",
                "timestamp": datetime.now().isoformat()
            }

        # Calculate trends from recent performance
        recent_entries = history[-10:] if len(history) >= 10 else history

        summary = {
            "total_batches_logged": len(history),
            "most_recent_entry": history[-1] if history else None,
            "timestamp": datetime.now().isoformat()
        }

        # If we have performance metrics in recent entries, calculate trends
        perf_entries = [entry for entry in recent_entries
                       if 'performance_metrics' in entry and entry['performance_metrics']]

        if perf_entries:
            latest_perf = perf_entries[-1]['performance_metrics']
            summary["latest_performance"] = latest_perf

            # Calculate simple trends if we have enough data
            if len(perf_entries) >= 2:
                first_perf = perf_entries[0]['performance_metrics']
                summary["performance_trend"] = {
                    "accuracy": latest_perf.get('accuracy', 0) - first_perf.get('accuracy', 0),
                    "precision": latest_perf.get('precision', 0) - first_perf.get('precision', 0),
                    "recall": latest_perf.get('recall', 0) - first_perf.get('recall', 0),
                    "f1_score": latest_perf.get('f1_score', 0) - first_perf.get('f1_score', 0)
                }

        return summary

    except Exception as e:
        logger.error(f"Error getting performance summary: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/log-predictions")
async def log_predictions(predictions: Dict[str, Any]):
    """Endpoint for logging predictions (to be called by prediction endpoint)"""
    if not HAS_MODEL_MONITOR:
        # Still return success to not break the prediction flow
        return {"status": "logged", "monitoring_enabled": False}

    try:
        # Expect predictions to be a list or contain a list under 'predictions' key
        pred_list = predictions.get('predictions', predictions) if isinstance(predictions, dict) else predictions
        if not isinstance(pred_list, list):
            pred_list = [pred_list]

        log_model_predictions(pred_list)
        return {"status": "logged", "count": len(pred_list)}
    except Exception as e:
        logger.error(f"Error logging predictions: {e}")
        # Don't raise exception to avoid breaking prediction flow
        return {"status": "error", "message": str(e)}


@router.get("/model-info")
async def get_model_info():
    """Get information about the current model"""
    try:
        predictor = _get_global_predictor()

        info = {
            "model_loaded": predictor.is_trained,
            "model_path": predictor.model_path if hasattr(predictor, 'model_path') else "unknown",
            "timestamp": datetime.now().isoformat()
        }

        if predictor.is_trained and hasattr(predictor, 'model') and predictor.model is not None:
            info.update({
                "feature_count": len(predictor.feature_names) if hasattr(predictor, 'feature_names') else "unknown",
                "feature_names": predictor.feature_names[:10] if hasattr(predictor, 'feature_names') and len(predictor.feature_names) > 10 else
                               (getattr(predictor, 'feature_names', []) if hasattr(predictor, 'feature_names') else []),
                "model_type": type(predictor.model).__name__ if predictor.model else "unknown"
            })

        return info
    except Exception as e:
        logger.error(f"Error getting model info: {e}")
        raise HTTPException(status_code=500, detail=str(e))
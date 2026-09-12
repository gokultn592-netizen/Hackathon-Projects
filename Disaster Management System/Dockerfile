FROM python:3.11-slim

WORKDIR /app
COPY . /app

RUN pip install --no-cache-dir xgboost scikit-learn pandas numpy requests joblib fastapi uvicorn

ENV PYTHONPATH=/app/src

# Production entry: start API (or retrain on startup if needed)
CMD ["python", "-m", "uvicorn", "src.api.main:app", "--host", "0.0.0.0", "--port", "8000"]

#!/bin/bash
# Orbital Eye DBMS — One-Command Starter (env-only, never hardcodes credentials)
# Sources .env, runs deploy, starts backend + frontend.
set -euo pipefail

echo "========================================"
echo "Orbital Eye — One-Command Starter"
echo "========================================"

echo "[1/4] Loading environment (.env) ..."
set -a
[ -f .env ] && source .env || [ -f ../.env ] && source ../.env || echo "(No .env found — create one with ORACLE_USER, ORACLE_PASS, ORACLE_HOST, ORACLE_PORT, ORACLE_SERVICE)"
set +a
echo "  ORACLE_USER=${ORACLE_USER:?Not set — check .env}"

echo "[2/4] Running database deploy ..."
(cd database && bash deploy.sh)

echo "[3/4] Starting backend ..."
python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload > backend_server.log 2>&1 &
echo $! > backend.pid
echo "  Backend started (PID $(cat backend.pid))"

echo "[4/4] Starting frontend ..."
(cd frontend && npm start)

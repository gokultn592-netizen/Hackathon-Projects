@echo off
echo ===================================================
echo   ORBITALEYE (VIN KAN) - SYSTEM BOOTSTRAPPER
echo ===================================================

:: Go to project root (where venv and frontend live)
cd /d D:\Project\OrbitalEye

:: 1. Activate Python Virtual Environment
if exist venv\Scripts\activate.bat (
    echo [INFO] Activating Python virtual environment...
    call venv\Scripts\activate.bat
) else (
    echo [ERROR] Virtual environment 'venv' not found at D:\Project\OrbitalEye\venv
)

:: 2. Start FastAPI Backend in a new visible window
echo [INFO] Igniting Python Backend Engine on Port 8000...
start "OrbitalEye Engine" cmd /k "call D:\Project\OrbitalEye\venv\Scripts\activate.bat && uvicorn src.api:app --reload --port 8000"

:: 3. Start Next.js Frontend in the current window
echo [INFO] Booting Command Center UI on Port 3000...
if exist frontend (
    cd frontend
    npm run dev
) else (
    echo [ERROR] 'frontend' directory not found!
    pause
)

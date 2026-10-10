@echo off
title OrbitalEye Mission Control Launcher
color 0B

echo =========================================================================
echo               ORBITALEYE DBMS EDITION -- NATIVE LAUNCHER
echo =========================================================================
echo.

echo [1/3] Checking Oracle Database Service...
sc query OracleServiceXE 2>nul | findstr /I "RUNNING" >nul
if %errorlevel% equ 0 (
    echo       [OK] OracleServiceXE is RUNNING.
) else (
    echo       [INFO] Oracle service is ready.
)

echo.
echo [2/3] Starting FastAPI Backend on http://localhost:8000...
start "OrbitalEye Backend (FastAPI)" cmd /k "cd /d "%~dp0backend" && python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload"

echo.
echo [3/3] Starting React Vite Frontend on http://localhost:3000...
start "OrbitalEye Frontend (Vite)" cmd /k "cd /d "%~dp0frontend" && npm run dev"

echo.
echo =========================================================================
echo   Both services are launching in dedicated background windows!
echo   - Backend Swagger Docs: http://localhost:8000/docs
echo   - Mission Control Dashboard: http://localhost:3000
echo =========================================================================
echo.

timeout /t 4 >nul
start http://localhost:3000

echo System running. You can close this launcher window at any time.
timeout /t 3 >nul
exit

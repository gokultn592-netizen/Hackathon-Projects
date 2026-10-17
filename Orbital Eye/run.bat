@echo off
title OrbitalEye Mission Control -- Stop & Relaunch
color 0B

echo =========================================================================
echo               ORBITALEYE DBMS EDITION -- RESTART LAUNCHER
echo =========================================================================
echo.

:: -----------------------------------------------------------
:: STEP 1: STOP EXISTING SERVICES (Backend & Frontend)
:: -----------------------------------------------------------
echo [1/4] Stopping existing OrbitalEye services...

:: Kill processes by port 8000 (FastAPI Backend)
for /f "tokens=5" %%p in ('netstat -aon ^| findstr ":8000.*LISTENING"') do (
    echo       Stopping backend process (PID %%p on port 8000)...
    taskkill /PID %%p /F >nul 2>&1
)

:: Kill processes by port 3000 (React Vite Frontend)
for /f "tokens=5" %%p in ('netstat -aon ^| findstr ":3000.*LISTENING"') do (
    echo       Stopping frontend process (PID %%p on port 3000)...
    taskkill /PID %%p /F >nul 2>&1
)

:: Kill any lingering launcher windows by title
taskkill /FI "WINDOWTITLE eq OrbitalEye Backend*" /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq OrbitalEye Frontend*" /F >nul 2>&1

:: Brief pause to ensure TCP sockets are fully released
timeout /t 2 /nobreak >nul
echo       [OK] All previous services stopped and ports cleared.
echo.

:: -----------------------------------------------------------
:: STEP 2: CHECK ORACLE DATABASE SERVICE
:: -----------------------------------------------------------
echo [2/4] Verifying Oracle Database XE service...
sc query OracleServiceXE 2>nul | findstr /I "RUNNING" >nul
if %errorlevel% equ 0 (
    echo       [OK] OracleServiceXE is RUNNING.
) else (
    echo       [WARN] OracleServiceXE not detected as running.
    echo              Ensure Oracle 21c XE is started for database queries.
)
echo.

:: -----------------------------------------------------------
:: STEP 3: START FASTAPI BACKEND
:: -----------------------------------------------------------
echo [3/4] Launching FastAPI Backend on http://localhost:8000...
start "OrbitalEye Backend (FastAPI)" /min cmd /k "cd /d "%~dp0backend" && python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload"
echo       [OK] Backend started in background.
echo.

:: -----------------------------------------------------------
:: STEP 4: START REACT VITE FRONTEND
:: -----------------------------------------------------------
echo [4/4] Launching React Vite Frontend on http://localhost:3000...
start "OrbitalEye Frontend (Vite)" /min cmd /k "cd /d "%~dp0frontend" && npm run dev"
echo       [OK] Frontend started in background.
echo.

echo =========================================================================
echo   OrbitalEye Mission Control is running!
echo   - Backend API Docs (Swagger): http://localhost:8000/docs
echo   - Mission Control Dashboard:  http://localhost:3000
echo =========================================================================
echo.
echo   Waiting 5 seconds for web servers to initialize...

timeout /t 5 /nobreak >nul
start http://localhost:3000

echo.
echo   Browser opened! This launcher will close in 3 seconds.
timeout /t 3 /nobreak >nul
exit

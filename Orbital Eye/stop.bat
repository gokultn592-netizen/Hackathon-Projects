@echo off
title OrbitalEye Mission Control Shutdown
color 0C

echo =========================================================================
echo               ORBITALEYE DBMS EDITION -- CLEAN SHUTDOWN
echo =========================================================================
echo.

echo [1/2] Stopping Vite frontend process on port 3000...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000" ^| findstr "LISTENING"') do (
    taskkill /PID %%a /F >nul 2>&1
)

echo [2/2] Stopping FastAPI backend process on port 8000...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8000" ^| findstr "LISTENING"') do (
    taskkill /PID %%a /F >nul 2>&1
)

echo.
echo =========================================================================
echo   [OK] OrbitalEye services stopped cleanly.
echo =========================================================================
echo.
timeout /t 2 >nul
exit

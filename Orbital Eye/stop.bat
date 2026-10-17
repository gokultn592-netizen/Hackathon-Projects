@echo off
title OrbitalEye -- Stop All Services
color 0C

echo =========================================================================
echo               ORBITALEYE DBMS EDITION -- STOP ALL SERVICES
echo =========================================================================
echo.

echo [1/2] Stopping Backend (port 8000)...
for /f "tokens=5" %%p in ('netstat -aon ^| findstr ":8000.*LISTENING"') do (
    echo       Killing PID %%p...
    taskkill /PID %%p /F >nul 2>&1
)
echo       [OK] Backend stopped.
echo.

echo [2/2] Stopping Frontend (port 3000)...
for /f "tokens=5" %%p in ('netstat -aon ^| findstr ":3000.*LISTENING"') do (
    echo       Killing PID %%p...
    taskkill /PID %%p /F >nul 2>&1
)
echo       [OK] Frontend stopped.
echo.

:: Also kill any orphan node/python processes with our titles
taskkill /FI "WINDOWTITLE eq OrbitalEye Backend*" /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq OrbitalEye Frontend*" /F >nul 2>&1

echo =========================================================================
echo   All OrbitalEye services have been stopped.
echo =========================================================================
echo.
timeout /t 3 >nul
exit

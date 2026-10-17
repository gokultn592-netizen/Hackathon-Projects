@echo off
title OrbitalEye DBMS Edition -- Database Table Viewer
color 0B

echo =========================================================================
echo             ORBITALEYE DBMS EDITION -- QUICK TABLE VIEWER
echo =========================================================================
echo.

:: 1. Locate SQL*Plus executable
set "SQLPLUS_BIN="
where sqlplus >nul 2>&1
if %errorlevel% equ 0 (
    set "SQLPLUS_BIN=sqlplus"
) else (
    if exist "D:\Apps\SQL\ExpressEditionExe\dbhomeXE\bin\sqlplus.exe" (
        set "SQLPLUS_BIN=D:\Apps\SQL\ExpressEditionExe\dbhomeXE\bin\sqlplus.exe"
    ) else (
        echo [ERROR] Could not locate sqlplus.exe!
        pause
        exit /b 1
    )
)

:: 2. Execute quick view query script
"%SQLPLUS_BIN%" -S ORBITAL_EYE/OrbitalEye_2026@localhost:1521/XEPDB1 @"%~dp0database\quick_view.sql"

echo.
pause

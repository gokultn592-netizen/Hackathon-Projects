@echo off
title OrbitalEye DBMS Edition -- SQL*Plus Console
color 0B

echo =========================================================================
echo               ORBITALEYE DBMS EDITION -- SQL*PLUS TERMINAL
echo =========================================================================
echo.

:: 1. Check if Oracle Database Service is running
echo [1/3] Checking OracleServiceXE status...
sc query OracleServiceXE 2>nul | findstr /I "RUNNING" >nul
if %errorlevel% equ 0 (
    echo       [OK] OracleServiceXE is RUNNING.
) else (
    echo       [WARN] OracleServiceXE is not currently running.
    echo              Attempting to start OracleServiceXE...
    net start OracleServiceXE >nul 2>&1
)
echo.

:: 2. Locate SQL*Plus executable
echo [2/3] Locating SQL*Plus executable...
set "SQLPLUS_BIN="

where sqlplus >nul 2>&1
if %errorlevel% equ 0 (
    set "SQLPLUS_BIN=sqlplus"
    echo       [OK] Found sqlplus in system PATH.
) else (
    if exist "D:\Apps\SQL\ExpressEditionExe\dbhomeXE\bin\sqlplus.exe" (
        set "SQLPLUS_BIN=D:\Apps\SQL\ExpressEditionExe\dbhomeXE\bin\sqlplus.exe"
        echo       [OK] Found sqlplus at D:\Apps\SQL\ExpressEditionExe\dbhomeXE\bin\sqlplus.exe
    ) else (
        echo       [ERROR] Could not locate sqlplus.exe!
        echo       Please ensure Oracle 21c XE client or dbhomeXE is installed.
        echo.
        pause
        exit /b 1
    )
)
echo.

:: 3. Launch SQL*Plus in Interactive Mode
echo [3/3] Connecting to Oracle Database (ORBITAL_EYE@localhost:1521/XEPDB1)...
echo.
echo -------------------------------------------------------------------------
echo Tip: Type EXIT and press Enter whenever you want to close SQL*Plus.
echo -------------------------------------------------------------------------
echo.

"%SQLPLUS_BIN%" ORBITAL_EYE/OrbitalEye_2026@localhost:1521/XEPDB1 @"%~dp0database\sqlplus_init.sql"

echo.
echo =========================================================================
echo               SQL*Plus Session Disconnected
echo =========================================================================
echo.
pause

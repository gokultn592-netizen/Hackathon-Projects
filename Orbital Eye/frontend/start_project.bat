@echo off
REM Orbital Eye DBMS — One-Command Starter (Windows)
REM Loads .env, runs deploy, starts backend + frontend.
echo ========================================
echo Orbital Eye — One-Command Starter
REM Load .env (set commands, no hardcoding)
if exist .env (
    echo [1/4] Loading .env ...
    for /f "tokens=1,2 delims==" %%a in (.env) do (
        if not "%%a"=="" if not "%%b"=="" set %%a=%%b
    )
) else (
    echo (No .env found — create one with ORACLE_USER, ORACLE_PASS, ORACLE_HOST, ORACLE_PORT, ORACLE_SERVICE)
)

echo [2/4] Running database deploy ...
cd database
call deploy.bat
cd ..

echo [3/4] Starting backend ...
start "OrbitalEye Backend" python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload > backend_server.log 2>&1
echo   Backend started (check backend.pid for PID)

echo [4/4] Starting frontend ...
cd frontend
npm start

# Orbital Eye — Live Demo Script (Phase 3 Verified)

## Prerequisites
1. Oracle listener active: `lsnrctl status` → XEPDB1 READY
2. `ORACLE_USER`, `ORACLE_PASSWORD`, `ORACLE_DSN` set in environment
3. Deploy completed: `bash ../database/deploy.sh` → exit 0
4. Backend running: `python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000`
5. Frontend running: `npm start`

## Demo Flow (No Manual Intervention Required)

1. **Health Check**
   `curl http://localhost:8000/api/health` → `{"status":"ok"}`

2. **DB Connectivity**
   `curl http://localhost:8000/api/db-test` → `{"container":"XEPDB1","user":"ORBITAL_EYE"}`

3. **Encounter Endpoint (Pydantic Response)**
   `curl "http://localhost:8000/api/encounters?dataset=REALTIME&limit=5"`
   → JSON array; each item has 7 fields (`id`, `satA`, `satB`, `missDistance`, `relVelocity`, `tcaFormatted`, `collisionProbPct`)

4. **Dataset Toggle (React)**
   Click ACCIDENT (amber) → URL updates to `?dataset=ACCIDENT`; table refreshes; back button restores REALTIME.

5. **Pagination / Debounce**
   Slider + number input stay synchronized; debounce 300ms; clamped [1, 200]; amber warning > 100.

6. **Table Features**
   - Virtualized scroll (`@tanstack/react-virtual`)
   - Skeleton loader → data rows
   - Color coding: `<5km` red, `5-20km` amber, `>20km` green
   - Copy-to-clipboard on row click
   - Responsive scroll container

7. **CSV Export**
   Click Export → downloads `orbital-eye-encounters-[timestamp].csv`; disabled when empty; success toast.

8. **Error Resilience**
   - Stop backend → ErrorBoundary displays user-friendly message; "Reload Data" resets; stack trace collapsible; console logs error.
   - Restart backend → reload → data returns.

9. **URL Sync**
   Change dataset/limit → URL params update (replaceState); back/forward navigates history without reload.

10. **No Mock Data / Security**
    All SQL uses bind variables (`:dataset_tag`, `:limit`); no string concatenation; credentials from `.env` only; no mock data in frontend files.

## Sign-Off
- [ ] Sections 1-6 verified
- [ ] Zero backend/DB/ETL/deploy modifications in this phase
- [ ] All TypeScript files compile without errors

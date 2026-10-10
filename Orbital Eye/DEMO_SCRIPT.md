# Orbital Eye End-to-End Demo Script

This document provides step-by-step instructions for demonstrating the Orbital Eye DBMS Edition project from Oracle seeding through FastAPI endpoint to React frontend.

---

## Step 1: Start Oracle Services and Verify Listener

```bash
# Check listener status
lsnrctl status
# Verify XEPDB1 service is registered
```
Expected output includes `XEPDB1` service and `READY` status.

---

## Step 2: Run Database Deployment Script

```bash
# Set environment variables
export ORACLE_USER=ORBITAL_EYE
export ORACLE_PASS=your_password
export ORACLE_HOST=localhost
export ORACLE_PORT=1521
export ORACLE_SERVICE=XEPDB1

# Execute deployment
bash database/deploy.sh
```

This executes in dependency order:
- `01_create_operators.sql`
- `02_create_satellites.sql`
- `03_create_tle_sets.sql`
- `04_create_encounter_pairs.sql`
- `05_create_encounter_events.sql`
- `06_create_debris.sql`

Then loads:
- `output/seed_realtime.sql`
- `output/seed_accident.sql`

Verification queries show row counts for all 6 tables. If any table has 0 rows, deployment exits with non-zero status.

---

## Step 3: Confirm SQL*Plus Spool Log (Proof of Constraint Enforcement)

```bash
cat database/deploy.log
```
Look for:
- `CREATE TABLE` statements with `CHECK (dataset_tag IN ...)` constraints
- `FOREIGN KEY` definitions linking tables
- `COMMIT;` lines from PL/SQL seed blocks
- Row count verification results

---

## Step 4: Start FastAPI Backend

```bash
# From project root
cd backend
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

---

## Step 5: Confirm `/api/db-test`

```bash
curl http://localhost:8000/api/db-test
```
Expected response:
```json
{"container":"XEPDB1","user":"ORBITAL_EYE"}
```

---

## Step 6: Verify API Endpoint Returns Live Oracle Data

### Real-time dataset (default)
```bash
curl "http://localhost:8000/api/encounters?dataset=REALTIME&limit=50"
```

### Accident dataset
```bash
curl "http://localhost:8000/api/encounters?dataset=ACCIDENT&limit=10"
```

Response structure:
```json
[
  {
    "pair_id": 1,
    "sat_a_name": "LEO-DEMO-25544",
    "sat_b_name": "LEO-DEMO-25546",
    "miss_distance_km": 18.53,
    "rel_velocity_kms": 7.55,
    "tca_utc": "2026-10-03T12:00:00",
    "collision_prob": 0.0
  }
]
```

---

## Step 7: Start React Frontend

```bash
# From project root (assuming standard React setup)
cd frontend
npm install
npm start
```

Navigate to: `http://localhost:3000` (or configured port)

---

## Step 8: Demonstrate Dataset Toggle in UI

1. Load the encounters page.
2. Select **REALTIME** from the dataset dropdown — observe table updates via `fetch()`.
3. Select **ACCIDENT** — observe different pair IDs and satellite names (Iridium 33 / Cosmos 2251) with different miss distances and collision probability near `1.0`.
4. Adjust the **Limit** input (1-200) and observe debounced refresh.
5. Use the **Filter** input above the table to search satellite names (e.g., `Iridium` or `Cosmos`) and observe filtered results.
6. Click any column header (Pair ID, Miss Distance, TCA, etc.) to sort ascending/descending (▲/▼ indicator).

---

## Step 9: Show OpenAPI Auto-Generated Schema

Navigate to:
```
http://localhost:8000/docs
```
Observe the `/api/encounters` endpoint with:
- Auto-generated request parameters (`dataset`, `limit`)
- Response schema derived from the Pydantic `EncounterPairResponse` model (`pair_id`, `sat_a_name`, `sat_b_name`, `miss_distance_km`, `rel_velocity_kms`, `tca_utc`, `collision_prob`)
- OpenAPI tags (`encounters`)

---

## Step 10: Verify Error Handling

### Network error simulation:
Temporarily stop the FastAPI server and observe the React component shows the Error Boundary message: "Something went wrong displaying encounter data."

### Invalid query params:
```bash
curl "http://localhost:8000/api/encounters?limit=500"
```
Expect HTTP 422 validation error (limit > 200 rejected by Pydantic `conint`).

---

## Verification Checklist (Post-Demo)

- [ ] Oracle listener registered `XEPDB1` service
- [ ] `database/deploy.sh` completed with exit code 0
- [ ] `database/deploy.log` contains `COMMIT` entries and row counts > 0 for all 6 tables
- [ ] `/api/db-test` returns `{"container":"XEPDB1","user":"ORBITAL_EYE"}`
- [ ] `/api/encounters?dataset=REALTIME&limit=50` returns JSON array with `pair_id`, `sat_a_name`, `sat_b_name`, etc.
- [ ] `/api/encounters?dataset=ACCIDENT` returns different dataset results
- [ ] React component `EncounterList.jsx` renders live data from `/api/encounters`
- [ ] Dataset toggle switches between `REALTIME` and `ACCIDENT`
- [ ] Limit input works (1-200) with debounced refresh
- [ ] `ErrorBoundary.jsx` displays user-friendly message on failure
- [ ] `/docs` shows OpenAPI schema with `EncounterPairResponse` fields
- [ ] No console errors in browser when endpoint is accessible
- [ ] Adapter function (`encounterAdapter.js`) maps backend fields without modifying backend

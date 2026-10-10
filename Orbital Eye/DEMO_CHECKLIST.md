# Orbital Eye — Demo Readiness Checklist (Phase 3)

> This checklist verifies resilience, polish, and demo-readiness features added in Phase 3. All items must pass without manual intervention.

---

## 1. Oracle Services & Database
- [ ] Oracle listener registered (`lsnrctl status`) shows `XEPDB1` service
- [ ] `bash database/deploy.sh` completes with exit code 0 (clean seed load)
- [ ] `database/deploy.log` contains `COMMIT` markers and verification row counts > 0
- [ ] `database/deploy.bat` available for Windows deployments (env-only credentials)

---

## 2. FastAPI Backend
- [ ] `python -m uvicorn main:app --host 0.0.0.0 --port 8000` starts cleanly
- [ ] `/api/db-test` returns `{container:"XEPDB1",user:"ORBITAL_EYE"}`
- [ ] `/api/encounters?dataset=REALTIME&limit=5` returns JSON array with 7 fields
- [ ] `bind variables` only (`:dataset_tag`, `:limit`) — no SQL concatenation
- [ ] `clean_float()` applies to float results; `round(x,2)` at query time
- [ ] `/docs` shows OpenAPI schema derived from `EncounterPairResponse`

---

## 3. React Frontend Components (New in Phase 3)
- [ ] `DatasetToggle.tsx` — segmented control: REALTIME (cyan) / ACCIDENT (amber); keyboard arrow navigation; `aria-checked`
- [ ] `LimitControl.tsx` — range slider + numeric input synchronized; clamps [1, 200]; 300ms debounce; amber warning >100
- [ ] `EncounterTable.tsx` — virtualized (`@tanstack/react-virtual`); skeleton loader; empty state; retry button; color coding (`<5km` red, `5-20km` amber, `>20km` green); copy-to-clipboard; responsive
- [ ] `ExportButton.tsx` — generates `orbital-eye-encounters-[timestamp].csv`; disabled when empty; success toast

---

## 4. Resilience Features
- [ ] `ErrorBoundary.tsx` (updated) — class-based; catches render errors; shows user-friendly message; "Reload Data" resets internal state; logs stack to console; styled dark theme
- [ ] `ToastProvider.tsx` — global context; `useToast()` hook; bottom-right stacked; auto-dismiss 5s; `aria-live="polite"`; supports info/success/error types
- [ ] `useUrlSync.ts` — reads `dataset` + `limit` from URL; updates without reload; supports browser back/forward; graceful defaults (`REALTIME`, 50)

---

## 5. Integration (App.tsx)
- [ ] `ErrorBoundary` wraps encounter display section
- [ ] `ToastProvider` at root level (provides context to all children)
- [ ] `useUrlSync` manages dataset/limit state for entire dashboard
- [ ] `DatasetToggle`, `LimitControl`, `EncounterTable`, `ExportButton` composed in responsive layout
- [ ] Mobile/tablet/desktop responsive design verified

---

## 6. Feature Verification (No Manual Intervention Required)
- [ ] REALTIME ↔ ACCIDENT toggle switches datasets and updates URL params
- [ ] Limit slider and input stay synchronized; debounced; value clamped [1, 200]
- [ ] Color coding applies: `<5km` red, `5-20km` amber, `>20km` green
- [ ] CSV export generates valid file that opens in Excel / Sheets
- [ ] Artificial error (stop backend temporarily) → `ErrorBoundary` shows message; "Reload Data" resets
- [ ] Changing filters updates URL query params; back/forward navigation restores previous state
- [ ] No console errors or warnings during normal operation
- [ ] Zero backend / database / ETL / deploy modifications made in this phase

---

## Post-Demo Sign-Off
- [ ] All 6 sections above verified automatically or by inspection
- [ ] No mock/hardcoded data present in any frontend file
- [ ] All new files (`App.tsx`, `ErrorBoundary.tsx`, `ToastProvider.tsx`, `useUrlSync.ts`, 4 presentation components) compile without TypeScript errors
- [ ] Dashboard loads at configured React URL with live data visible

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
- [ ] `DatasetToggle.tsx` — segmented control: REALTIME (cyan) / ACCIDENT (amber) — **present but not yet mounted in `App.tsx`** (dataset switch is currently a toolbar button + hotkeys `1`/`2`)
- [ ] `LimitControl.tsx` — range slider + numeric input synchronized; clamps `[min, max]` (default 1–500); 250 ms debounce — **present but not yet mounted in `App.tsx`**
- [ ] `EncounterTable.tsx` — search bar; risk-filter tabs (ALL/CRITICAL/CAUTION/NOMINAL) with counts; color coding (`<2 km` red, `2–10 km` amber, `>=10 km` cyan); slide transition; **not virtualized** (plain `divide-y` list)
- [ ] `ExportButton.tsx` — generates `orbital-eye-encounters-[timestamp].csv`; disabled when empty — **present but not yet mounted in `App.tsx`**
- [ ] `EncounterDetailModal.tsx` — conjunction telemetry bottom sheet with B-plane geometry canvas — **mounted** and opened by clicking a catalog row

---

## 4. Resilience Features
- [ ] `ErrorBoundary.tsx` (updated) — class-based; catches render errors; shows user-friendly message; "Reload Data" resets internal state; logs stack to console; styled dark theme
- [ ] `ToastProvider.tsx` — global context; `useToast()` hook; bottom-right stacked; auto-dismiss 5s; `aria-live="polite"`; supports info/success/error/warning types
- [ ] `useUrlSync.ts` — reads `dataset` + `limit` from URL; updates without reload; supports browser back/forward; graceful defaults (`REALTIME`, limit clamped to `[10, 1000]`)

---

## 5. Integration (App.tsx)
- [ ] `ErrorBoundary` wraps the entire app at the root
- [ ] `ToastProvider` at root level (provides context to all children)
- [ ] `useUrlSync` manages dataset/limit state for entire dashboard
- [ ] `EncounterTable` and `EncounterDetailModal` composed in the responsive layout
- [ ] Mobile/tablet/desktop responsive design verified

---

## 6. Feature Verification (No Manual Intervention Required)
- [ ] REALTIME ↔ ACCIDENT toggle switches datasets and updates URL params
- [ ] Limit input is debounced and clamped to `[10, 1000]`
- [ ] Color coding applies: `<2 km` red, `2–10 km` amber, `>=10 km` cyan
- [ ] Artificial error (stop backend temporarily) → `ErrorBoundary` shows message; "Reload Data" resets
- [ ] Changing filters updates URL query params; back/forward navigation restores previous state
- [ ] No console errors or warnings during normal operation
- [ ] `npm run build` passes — this now runs `tsc --noEmit` before `vite build`, so type errors fail the build

---

## Post-Demo Sign-Off
- [ ] All 6 sections above verified automatically or by inspection
- [ ] No mock/hardcoded data present in any frontend file
- [ ] All frontend files compile without TypeScript errors (`npm run typecheck`)
- [ ] Dashboard loads at configured React URL with live data visible

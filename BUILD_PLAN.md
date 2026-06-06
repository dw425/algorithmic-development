# Build Plan — Algorithmic Development Forecast Platform

**Status:** living plan. Do NOT lose this. Last updated 2026-06-06.
**Repo target:** new PUBLIC github repo `algorithmic-development` (correct spelling),
cloned to a local folder so all work lives in one place (stop scattering it).
**Current app location (to be moved into the repo):** `~/Desktop/forecast-app`
**Design doc:** `~/Desktop/algo_testing.md` (the full algorithm design + §1D implementation status)

---

## 0. Current state (already built & verified)

- Python (FastAPI) backend + React/TS (Vite) frontend in `~/Desktop/forecast-app`.
- **Full 1,980-vector engine** (`engine_vectors.py`): 11 models × 12 lookbacks × 5 scales × 3 points
  → 3D embed → 3 clusterings (KMeans/DBSCAN/GMM) + consensus → Mahalanobis → constellation MST →
  CQR bands → debias → ACI → drift (Page-Hinkley) → PSI → mixture → exogenous (SPY) →
  Lyapunov (Rosenstein) → bootstrap stability → O6/O7/O8 audits → rho/eff-N → THieF → signal decomp.
- **Data layer Steps 1–3** (`prep.py`): validate/Benford, impute/Hampel, ADF/KPSS/STL, purge/embargo.
- **Generic runner** (`runner.py`): ANY source (ticker/CSV), ANY size, ANY time window, full/fast
  engine, parallel, resumable, self-plotting (accuracy + drift line vectors).
- **Existing UI tabs:** Forecast (range + accuracy + 90-day series) · Full engine (all 10) ·
  Step-by-step walkthrough (13 phases incl. 3D clustering) · Baseline.
- Endpoints: `/api/forecast` `/api/horizons` `/api/run_vectors` `/api/walkthrough`
  `/api/run_all` `/api/run_all_vectors`.

**Honest findings to remember:** ρ=0.655 → effective models ≈ 1.46 of 11 (vectors are
correlated; count ≠ information). Purge/embargo dropped 90-day coverage 65%→48% (leakage was
inflating it). Mean 1-day coverage ≈ 70% across stocks.

**Background job RUNNING:** `runner.py` full engine, all 2025, targeting 1,000 valid stocks,
10 workers, resumable → `full_run.json`, auto-plots `full_run_top.png` when done.

---

## 1. Repo + infra (Phase 1 — ✅ DONE 2026-06-06)

- [x] gh account confirmed: **dw425**.
- [x] Found & cloned viz repo: **`dw425/etl-dep-viz`** (rich; `project-rose` is a sibling).
- [x] Created **public** repo **https://github.com/dw425/algorithmic-development**.
- [x] Local clone: `~/Documents/Github Project/algorithmic-development`; `forecast-app/` copied in;
      docs in; initial commit pushed (49 files).

### Viz integration spec (etl-dep-viz = D3 v7 + HTML5 Canvas)
- `ConstellationCanvas.tsx` (1456 ln) — force-directed scatter + convex-hull clusters + KDE heat
  overlay + edge bundling + LOD + D3 quadtree hit-testing. `GalaxyMapCanvas.tsx` orbital view.
- `VectorControlPanel.tsx`, `AIChat.tsx` (415 ln — reuse for agentic Scenario Planner).
- Adapt: each STOCK → constellation point; position by PCA/UMAP of returns or (accuracy,drift);
  cluster by correlation; animate over time; reuse hull/KDE/LOD render.
- ⚠️ Integrate ONLY the viz layer into the PUBLIC repo — do NOT republish etl-dep-viz private ETL logic.

## 2. Automated stock pipeline (backend)

- [ ] **Granularity** (1d / 1wk / 1mo) — `data.fetch(interval=...)` drafted; finish + wire to runner/endpoints.
- [ ] **Repository** endpoint — list/load saved experiment runs from `cache/`.
- [ ] **Bundled metrics** endpoint — one call returns all metrics for selected stocks/window.
- [ ] Automation: scheduled/triggerable pipeline runs (background runner already supports this).

## 3. TypeScript app — multi-page (Phase 3)

Multi-page nav (router). Pages:

- [ ] **Stock Pipeline page** — full stock picker (search + select up to 10), granularity selector,
  repository (saved runs), time-series + range controls, run/launch controls, other metrics.
- [ ] **Data Measurements page (its OWN page)** — data quality (quarantine/Benford/Hampel),
  stationarity (ADF/KPSS/STL), Hurst + Lyapunov, ρ + effective-N, drift flags, PSI, calibration.
- [ ] **Scenario Planner page (agentic)** — user enters **vectors + prompts**; an LLM adjusts the
  scenario being tested (assumptions, regime, shocks, which vectors to emphasize). DECISION: wire
  **Claude API** (Anthropic) — needs `ANTHROPIC_API_KEY` in backend env. (Default unless told otherwise.)
- [ ] **Telemetry page** — results in **snapshot form for each key step**, so the user can WALK the
  experiment + analysis (built on the 13 walkthrough phases; one snapshot card per phase).
- [ ] **Results page (MAJOR upgrade)** — bundled end-to-end metrics with **overlays**:
  - compare forecast vs actual vs range across selections
  - clustering + the 3D cluster models → through to final analysis, all overlaid
  - **dropdown selectors**, **time-range adjustment**, **up to 10 stocks at once**
  - **constellation clustering diagram** showing how all stocks perform over time
    (model on the user's `etl-dep-visualizer` repo representation).

## 4. Visualization integration + finish

- [ ] Pull the entire `etl-dep-visualizer` repo into the new repo; integrate its viz components.
- [ ] Build the constellation clustering diagram in that style.
- [ ] Test every page (headless render + screenshots), then commit + push.

---

## Decisions needed (can proceed on everything else without waiting)

1. **Agentic Scenario Planner LLM** → default to **Claude API (Anthropic)**; user supplies `ANTHROPIC_API_KEY`.
2. **Confirm GitHub username** for the public repo.

## Known blocker (transient)

The command-safety classifier model (`claude-opus-4-8[1m]`) was temporarily unavailable, which
blocked Bash/Edit/Write under auto-approve mode. Read-only worked. When it recovers, execute
Phase 1 → 4 in order. The background full run is unaffected (detached process).

# Dashboard Rebuild Plan — full spec (do NOT lose). 2026-06-06

The current app is a flat tab-bar of single-stock panels. This is the plan to rebuild it as a
real **etl-dep-viz-style dashboard**: top tab strip + **left control/vector panel per page** +
main viz area, **every visual its own page**, **multi-stock**, with fine-grain controls that
**post changes** to re-render. Engine is done; this is a FRONTEND + control-wiring rebuild.

---

## A. Architecture (learned from etl-dep-viz DependencyApp)

- **Top bar:** grouped tab strip — sections: **Pipeline | Forecast | Vectors | Spatial | Experiments**.
  Each tab = its own page/view component. View history (back/forward), global search.
- **Left panel (per page):** ALL controls for that page + that page's **vector controls**.
- **Main area:** the visual, fully reactive; an **Apply / Post** action re-fetches + re-renders.
- **Shared global state** (persists across pages): selected stocks, date range, granularity,
  horizon, target/range. Each page adds its own page-specific knobs on the left.
- **Stats bar:** counts/status (n stocks, window, run id) like etl-viz.

### Global controls (left panel, shared)
- **Stock picker** — searchable, **multi-select up to 10** (chips), select/clear all.
- **Date range** — start/end (any period; backend already lexical-date based).
- **Granularity** — 1d / 1wk / 1mo (NEEDS backend wire).
- **Horizon / time-series** — 1 / 7 / 30 / 90-day, toggle point vs series.
- **Range** — target coverage %, and per-viz range knobs.
- **# stocks** — derived from picker; all multi-stock visuals honor it.
- **Apply** button — posts the control state, re-runs, updates the page.

---

## B. Pages (each its OWN page, left controls + main viz)

| # | Page (tab) | Main viz | Left controls (page + vector) |
|---|---|---|---|
| 1 | **Pipeline / Overview** | run launcher + repository table of saved runs | source, picker, granularity, date range, engine(full/fast), workers, run/launch |
| 2 | **Forecast** | range band + actual, **multi-stock overlay** | picker(≤10), target, horizon, date range, granularity, overlay on/off |
| 3 | **Multi-horizon** | 7/30/90 coverage + per-horizon series | picker, horizons, target |
| 4 | **Data Measurements** | metric cards/series per stock | picker, which metrics, date range |
| 5 | **Spatial Constellation** | **D3 ConstellationCanvas** (hulls + KDE heat + LOD), animated over time | picker(≤10+), algorithm (louvain/gravity/label_prop/greedy_mod), corr threshold, time window, play/scrub |
| 6 | **Dependency Mapper** | cluster-to-cluster + node-node dependency graph | picker, threshold, community resolution (macro/meso/micro), weight cutoff |
| 7 | **Funnel** | vector drop-off funnel | picker/stock, m/c, stage toggles |
| 8 | **TPA (Threaded Pt Analysis)** | 3D threaded deviation paths | stock, m, c, τ, train/forward split, range adapt |
| 9 | **Results Overlays** | bundled end-to-end: clusters → 3D → final, **overlaid, up to 10 stocks** | picker(≤10), dropdown(metric), time-range slider, overlay layers toggles |
| 10 | **Telemetry** | per-step experiment snapshots (walk the 13 phases + run history) | run/stock selector, step scrubber |
| 11 | **Scenario Planner** | parametric (NO LLM): enter vectors/params → re-run → compare to baseline | shock %, regime, drive, m/c, target, horizon, "run scenario", diff vs base |

---

## C. Backend work required (engine exists; these are wiring/new endpoints)

- [ ] **Granularity** end-to-end — finish `data.fetch(interval=…, y0,y1)`, thread through all engines/endpoints.
- [ ] **Multi-stock + date-range + granularity params** on forecast/measurements/results endpoints.
- [ ] **Repository** endpoints — list saved runs (cache + full_run.json), load run detail.
- [ ] **Constellation algorithm selector** — louvain / table_gravity / label_prop / greedy_mod;
      multi-resolution communities (macro/meso/micro); **time-windowed** snapshots for animation.
- [ ] **Scenario re-run** endpoint — apply parametric overrides (shock/regime/drive/m/c) → forecast + diff vs baseline.
- [ ] **Telemetry snapshots** endpoint — per-step artifacts for a run (extend walkthrough to series of runs).

---

## D. Frontend rebuild — port etl-dep-viz shell

- [ ] **AppShell**: top grouped tab strip + left `ControlPanel` + main view router + stats bar + view history.
- [ ] **GlobalControls context** (selected stocks, dates, granularity, horizon, target) shared across pages.
- [ ] **ControlPanel** component: renders global controls + page-specific control schema.
- [ ] Port **ConstellationCanvas** (D3 + Canvas: convex hulls, KDE heat, LOD, quadtree) — adapt points = stocks.
- [ ] Each page consumes global state + its own left controls; **Apply** posts + re-renders.
- [ ] Dark theme matching etl-viz.

---

## E. PHASES (build order — push each phase)

- **Phase 1 — Shell:** AppShell (top tabs + left ControlPanel + router + global state). Migrate existing
  Forecast/Measurements/Funnel/TPA/Constellation into pages under the shell. *Verify render.*
- **Phase 2 — Global controls wired:** granularity (backend+UI), date range, multi-stock picker(≤10),
  horizon — all posting to backend. Forecast page becomes **multi-stock overlay**.
- **Phase 3 — Spatial Constellation page (D3 canvas):** port ConstellationCanvas; algorithm selector;
  time animation/scrub; left controls.
- **Phase 4 — Dependency Mapper page:** cluster-to-cluster + node-node; resolution + threshold controls.
- **Phase 5 — Results Overlays page:** up-to-10-stock overlay, metric dropdown, time-range slider,
  layer toggles (clusters → 3D → final analysis overlaid).
- **Phase 6 — Telemetry page:** per-step snapshots; run history scrubber.
- **Phase 7 — Scenario Planner (parametric):** vector/param controls → re-run → baseline diff.
- **Phase 8 — Pipeline/Repository page:** run launcher + browse saved runs (incl. 1,000-stock run).
- **Phase 9 — Polish/compat:** every page honors global controls; headless-render test each; push.

---

## F. Honest status going in (what exists vs rebuild)
- ✅ Engine + all algorithms (1,980-vector, clustering, conformal, TPA, Louvain gravity, funnel) — DONE.
- ✅ Generic runner, 1,000-stock run, repo+local clone — DONE.
- ⚠️ Constellation/dependency exist as **Plotly** — to be **replaced** by D3 canvas on their own pages.
- ❌ Dashboard SHELL, left control panel, multi-stock UI, granularity UI, Results overlays, Telemetry,
  Scenario Planner, Repository UI — all to be BUILT in this rebuild.

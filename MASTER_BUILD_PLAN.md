# MASTER BUILD PLAN — Algorithmic Forecasting Platform (from scratch, gated)

**132 phases.** Every phase is a closed cycle with a hard gate. You do NOT advance until the
gate passes. No trusting prior docs, prior code, or samples — **each phase re-proves itself on
real data with a real test and a real screenshot.** Evidence is logged per phase.

---

## 0. Anti-bullshit rules (apply to EVERY phase)

1. **No mocks, no synthetic-only.** Tests run on real fetched data (or a real CSV the user gives).
2. **Two proofs per phase, always:** a **mathematical** proof (numbers, independently recomputed
   or checked against a known property / held-out outcome) AND a **visual** proof (headless
   screenshot of the rendered page, inspected).
3. **Don't trust existing code.** Treat current `forecast-app` as *unverified*; a component is
   "real" only after it passes this plan's gate, even if it already exists.
4. **One component at a time.** No moving on with a failing or unproven gate.
5. **Log evidence** to `/evidence/phase_NNN/` : test output, numbers, screenshot, verdict.

---

## 1. The Phase Gate Protocol (the cycle every phase runs)

```
G1 BUILD     implement the component or page (small, single responsibility)
G2 TEST      pytest (backend) / runtime call on REAL data — assert it runs + shape/range
G3 VALIDATE  MATH gate: recompute independently OR check a known property OR held-out truth;
             record the actual numbers; must match within tolerance
G4 RENDER    Playwright headless: load the page, capture console errors (must be zero),
             screenshot full page
G5 REVIEW    inspect the screenshot (visual correctness) AND the numbers (math correctness);
             write a one-line PASS/FAIL verdict with the evidence path
G6 GATE      PASS → commit + push + advance.  FAIL → fix, re-run G2–G5. Never skip.
```

A phase is DONE only when G3 (math) and G5 (visual) both PASS and it's committed.

---

## 2. The 4-page archetype (every algorithm step gets all four)

Each algorithm step/component exposes four pages under the shell (this is why the app reaches
50–100 pages):

| Page | Purpose | Gate emphasis |
|---|---|---|
| **CONTROL** | parameters/knobs for this step (left panel + step-specific) | changing a knob provably changes the engine output |
| **VISUALIZATION** | the chart/graphic of this step's output | visual review of the screenshot |
| **DATA** | raw + tabular values in/out of this step | numbers match the engine exactly |
| **ADJUSTMENT** | live re-run with adjusted params, before/after diff | the delta is mathematically correct |

Per component → 1 ENGINE phase + 4 PAGE phases = **5 phases/component**.

---

## 3. TIER 0 — Foundation & harnesses (Phases 1–12)

| P | Build | Math gate (G3) | Visual gate (G5) |
|---|---|---|---|
| 1 | Clean repo scaffold (FastAPI backend, Vite/React/TS frontend), CI script | `pytest` + `tsc` + `vite build` all green | app boots, blank shell screenshot |
| 2 | **pytest harness** (real-data fixtures, no mocks) | sample test asserts on real fetch | n/a |
| 3 | **Render harness** (Playwright: load+console-errors+screenshot) | n/a | produces a screenshot, 0 console errors |
| 4 | **Validation harness** (numeric assert utils + held-out splitter) | self-test on a known series | n/a |
| 5 | Data fetch + cache (any ticker/interval/range) | fetch real AAPL; assert ≥200 rows, monotonic dates, positive closes | n/a |
| 6 | `/api/universe` (all cached tickers) | count matches cache dir | n/a |
| 7 | App shell: top grouped tabs + left control panel + router | n/a | shell renders, tabs clickable (screenshot) |
| 8 | Global controls context (stocks/date/granularity/horizon/target/apply) | changing state bumps runKey; unit test | controls render on left (screenshot) |
| 9 | Theme + layout + stats bar | n/a | dark theme matches spec (screenshot) |
| 10 | Page archetype template (Control/Viz/Data/Adjustment skeleton) | n/a | 4 empty sub-pages render |
| 11 | FE↔BE contract test (CORS, every endpoint reachable headless) | headless fetch each endpoint → 200 | n/a |
| 12 | "All gates" runner (`make verify`: pytest + tsc + render-all + numbers) | exits 0 only if all pass | screenshots saved for all pages |

---

## 4. TIERS 1–6 — Algorithm components (Phases 13–122)

**5 phases per component:** `.E` engine+math · `.D` data page · `.V` viz page · `.C` control page
· `.A` adjustment page. Each runs the full G1–G6 cycle. 22 components × 5 = 110 phases.

### Component → math-validation method (G3) it MUST pass

| # | Component | Engine math gate (the real validation) |
|---|---|---|
| 13–17 | **Data validate/clean** | Benford dev vs theoretical; quarantine count exact; Hampel flags vs hand-computed MAD |
| 18–22 | **Stationarity/transform** | ADF & KPSS p-values vs statsmodels reference; STL recomposes to original within ε |
| 23–27 | **Multi-scale aggregation** | block-means equal manual aggregation; counts exact |
| 28–32 | **Predictability (Hurst+Lyapunov+Takens)** | Hurst≈0.5 on synthetic GBM; Lyapunov>0 on logistic-map chaos, ≈0 on AR(1); known-system check |
| 33–37 | **Base model pool** | each model's 1-step forecast recomputed by hand on a 5-point series |
| 38–42 | **Ensemble combination (error-cov+shrink)** | weights sum to 1; inverse-cov matches closed form; shrinkage bounds |
| 43–47 | **Conformal + ACI bands** | empirical coverage on held-out ≈ target ±tolerance; ACI converges |
| 48–52 | **Debiasing (Mincer–Zarnowitz)** | α,β from regression match numpy lstsq; bias removed on held-out |
| 53–57 | **Multi-horizon (7/30/90)** | h-ahead residuals leakage-free (purge/embargo unit test); coverage per h |
| 58–62 | **Vector grid (1,800/1,980)** | exact count = models×lookbacks×scales×points; all finite |
| 63–67 | **3D embed + standardize** | each axis mean≈0 std≈1 post-scale; no NaN |
| 68–72 | **Clustering (KMeans/DBSCAN/GMM)** | labels stable across seeds (ARI); k matches; silhouette > 0 |
| 73–77 | **Consensus clustering** | consensus⊆each method's densest; fraction in [0,1] |
| 78–82 | **Mahalanobis concentration** | distances vs scipy reference; ~68% within 1σ on Gaussian |
| 83–87 | **Constellation MST + Davies–Bouldin** | MST length vs scipy; DB vs sklearn |
| 88–92 | **Louvain data-gravity + dependency** | modularity vs networkx; dependency matrix symmetric, ≥0 |
| 93–97 | **Inverse-drift + Net results** | dissent coherence in [0,1]; mode/robust/consensus recomputed by hand |
| 98–102 | **Funnel + Wave refinement (stability)** | funnel monotonic; bootstrap stability variance check |
| 103–107 | **Model Confidence Set** | survivors ⊆ pool; eliminated have sig-worse loss (t-test) |
| 108–112 | **Calibration (isotonic/CQR/Brier)** | post-calibration coverage→target; Brier improves; monotone map |
| 113–117 | **TPA (threaded point analysis)** | fan count=2m+1; winner=argmin verified; modifier shipped only if forward-lift>0 & autocorr sig |

### Outward-eye & adaptivity components (Phases 118–122 cluster + folded above)
- Exogenous market regime · Drift (Page-Hinkley/ADWIN) · PSI sentinel · Risk gates (overlap/MAD/SPC)
  · Confidence O6 audit · Triangulation O7 · Continual/Kalman online update.
  (Each: engine math gate = behaves correctly on injected drift/shift; pages render.)

> Each component's **.D/.V/.C/.A** pages gate on: Data = table equals engine output;
> Viz = screenshot shows the correct shape; Control = knob change alters output (asserted);
> Adjustment = before/after numeric delta is correct.

---

## 5. TIER 7 — Integration, scale & end-to-end truth (Phases 123–132)

| P | Build | Gate |
|---|---|---|
| 123 | Wire full pipeline (data→engine→all components) | end-to-end run on 1 stock; every stage's numbers logged |
| 124 | Multi-stock (≤10) across all pages | 10-stock run; all pages render with 10; perf budget |
| 125 | Granularity 1d/1wk/1mo end-to-end | weekly/monthly coverage sane; pages render |
| 126 | Performance budget (every interactive call <2s) | timed test; FAIL if any page >2s |
| 127 | Repository: browse the full 1,000-stock run | 1,000 rows render; sortable; click→picker |
| 128 | 1,000-stock batch (full engine, resumable) | 1,000 valid; mean coverage logged; artifact saved |
| 129 | **End-to-end held-out validation** | forward-test: does the stack beat naive OOS, after costs? record lift |
| 130 | Cross-page consistency | same stock shows same numbers on every page (assert identical) |
| 131 | Regression suite (`make verify` green across all 132) | all tests + all renders pass in one run |
| 132 | Final review: every page screenshot + every math gate in one report | human-readable evidence index |

---

## 6. Page count (why 50–100 pages)

22 components × 4 pages = **88 step-pages** + shell pages (Repository, Overview, Results
Overlays, end-to-end) ≈ **92–96 pages**. Matches the 50–100 target.

---

## 7. Execution rules

- **Sequential.** One phase at a time; commit + push each; `/evidence/phase_NNN/` holds proof.
- **No advance on FAIL.** A red math gate or a blank/erroring screenshot stops the line.
- **Re-validate existing code** rather than assume it works (Phases 13+ re-prove current engine).
- **Status is the evidence**, not my word: each phase = test output + screenshot + verdict, in-repo.

---

## 8. Start condition

Begin at Phase 1 only after this plan is approved. Then execute strictly in order, posting the
evidence (numbers + screenshot) for each phase so progress is independently verifiable.

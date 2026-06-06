# MASTER BUILD PLAN — Algorithmic Forecasting Platform (from scratch, gated, detailed)

**132 phases.** Each phase = a closed cycle with a hard gate and a **goal-met check**. You do
NOT advance until every gate AND the phase's stated goal pass, proven by real numbers + a real
screenshot. Nothing is trusted from prior code/docs. If a critical goal is unmet, the section
**fails and is redone** — cycle until 100% accuracy & completeness.

---

## 0. OVERALL GOALS (the master success criteria)

The whole build FAILS unless ALL of these hold at the end (and each is re-checked as phases land):

- **OG1 — Correctness.** Every algorithm component matches its mathematical definition, verified
  by independent recomputation or a known property (not by assertion).
- **OG2 — Honesty/calibration.** Predicted ranges are calibrated: on held-out data, the X%
  range contains the actual ~X% of the time. No metric is reported without its out-of-sample value.
- **OG3 — Out-of-sample lift.** The full stack beats the naive baseline on held-out data, after
  costs, OR the system honestly says "no edge here" (wide band / abstain). Measured, not assumed.
- **OG4 — Completeness.** Every algorithm step exists and is wired into the live pipeline
  (grep-proven called), with its 4 pages (control/viz/data/adjustment) rendering real data.
- **OG5 — Visual truth.** Every page renders with zero console errors and shows correct data,
  proven by a committed screenshot.
- **OG6 — Performance.** Every interactive page responds < 2 s; batch runs are resumable.
- **OG7 — Multi-scale & multi-stock.** Works for any ticker/CSV, any date range, granularity
  (1d/1wk/1mo), and up to 10 stocks at once.
- **OG8 — Reproducibility.** `make verify` re-runs all tests + all renders + all math gates and
  exits 0; evidence for every phase lives in `/evidence/phase_NNN/`.

**Goal-Met Gate (G7, added to every phase):** before advancing, confirm the phase advances ≥1
Overall Goal and violates none. If it touches a *critical* goal (OG1, OG2, OG5) and that goal is
not met, the phase FAILS regardless of other gates — fix and re-cycle.

---

## 1. THE PHASE GATE PROTOCOL (required steps, every phase)

```
G1 BUILD      Implement ONE component/page, single responsibility. Write the code.
G2 TEST       Run it on REAL data (pytest/runtime). Assert: runs, output shape, value ranges,
              no NaN/inf. Record raw output.
G3 VALIDATE   MATH gate. Prove correctness one of three ways:
                (a) recompute independently (numpy/hand) and assert equal within tol, OR
                (b) check a known property (e.g. weights sum to 1; Hurst≈0.5 on RW), OR
                (c) held-out truth (coverage→target; lift vs naive).
              Record the actual numbers in evidence.
G4 RENDER     Playwright headless: load the page, assert 0 console errors, screenshot full page.
G5 REVIEW     Inspect screenshot (visual correctness) AND numbers (math correctness). Write a
              PASS/FAIL verdict with evidence path.
G6 INTEGRATE  Confirm it's wired into the live pipeline (grep the call site) and existing phases
              still pass (no regression: re-run `make verify`).
G7 GOAL-MET   Confirm the phase meets its stated Goal and advances ≥1 Overall Goal, violates none.
              Critical-goal miss ⇒ FAIL ⇒ redo.
GATE          All of G2–G7 PASS → commit + push + advance. Any FAIL → fix, re-run. Never skip.
```

Evidence per phase (`/evidence/phase_NNN/`): `test.txt` (G2/G3 output + numbers), `page.png`
(G4), `verdict.md` (G5/G7 with the goal-met checklist).

---

## 2. THE 4-PAGE ARCHETYPE (required steps per page type)

Every algorithm component exposes 4 pages. Required build steps + goal-met criteria per type:

### CONTROL page
- **Goal:** expose every knob for this step; changing a knob provably changes the engine output.
- **Steps:** (1) enumerate the step's parameters; (2) render them as left-panel inputs bound to
  state; (3) wire an Apply that re-runs the step; (4) test: change each knob → assert engine
  output changes in the expected direction.
- **Goal-met:** each knob has a verified effect (logged before/after numbers).

### VISUALIZATION page
- **Goal:** show this step's output as the correct chart/graphic for its data type.
- **Steps:** (1) pick the right chart (line/band/3D/heatmap/funnel/network per step);
  (2) bind to engine output; (3) render headless + screenshot; (4) review the screenshot shows
  the expected shape (e.g. band brackets actual; clusters separate; funnel narrows).
- **Goal-met:** screenshot visually correct, 0 console errors.

### DATA page
- **Goal:** show the raw + tabular values in/out of this step; numbers must equal the engine.
- **Steps:** (1) table of inputs and outputs (sortable/searchable for large); (2) assert a sample
  of table cells equals the engine's returned values exactly.
- **Goal-met:** table values == engine values (asserted), not approximated.

### ADJUSTMENT page
- **Goal:** live re-run with adjusted params, before/after diff, with the delta proven correct.
- **Steps:** (1) baseline vs scenario side-by-side; (2) apply a parameter delta; (3) compute the
  resulting change; (4) assert the change matches the analytic expectation (e.g. +5% shift moves
  the band center +5%; widening +10% scales half-width ×1.1).
- **Goal-met:** the numeric delta matches the analytic expectation within tol.

---

## 3. MODELS CATALOG (every model — used by the engine phases)

### 3.1 Base forecasting models (the pool — Phases 33–37)
| Model | Formula (1-step from window a, last = aₙ) | Intent |
|---|---|---|
| naive | F = aₙ | random-walk baseline (must-beat) |
| drift | F = aₙ + (aₙ−a₀)/(n−1) | linear extrapolation of level |
| ses | EWMA level, α=0.3 | smooth recent level |
| holt | level+trend double-exp (α,β) | trend-aware smoothing |
| linear | OLS slope·(n)+intercept | local linear trend |
| ar1 | aₙ·exp(μ+φ(rₙ−μ)) on log-returns r | mean-reverting return autocorrelation |
| momentum | aₙ·exp(mean recent log-returns) | trend continuation |
| meanrev | aₙ + 0.3(MA−aₙ) | reversion to moving average |
| theta | 0.5(linear+ses) | classic Theta decomposition |
| median | 0.5aₙ+0.5·median(recent) | robust to outliers |
| kalman | local-level Kalman recursion | optimal level under noise; continual update |

### 3.2 Combination / selection
- **Error-covariance (Bates–Granger) + shrinkage** (P38–42): w = Σ⁻¹1 / 1ᵀΣ⁻¹1, shrunk 50% to
  equal weights (combination-puzzle guard). Σ = covariance of model errors.
- **FFORMA regime weighting** (P-cluster): weight models by predicted competence given features.
- **Model Confidence Set** (P103–107): iteratively drop sig-worse models; keep the tied-best set.

### 3.3 Uncertainty / calibration
- **Split conformal** (P43–47): band = pred·(1+quantile of relative residuals).
- **Adaptive Conformal Inference (ACI)**: αₜ₊₁ = αₜ + γ(α_target − miss) → drives coverage to target.
- **Conformalized Quantile Regression (CQR)** (P108–112): cloud quantiles + conformity correction.
- **Isotonic / Brier** calibration: monotone map nominal→empirical; proper-score check.

### 3.4 Bias (outward eye)
- **Mincer–Zarnowitz debiasing** (P48–52): regress actual on forecast; correct α≠0, β≠1.
- **2-regime Bayesian mixture** band (GMM on residuals): normal + tail regime.
- **Exogenous market regime** (SPY): drift tilt + band vol-scale (preventive, no lookahead).

### 3.5 Drift / shift
- **Page-Hinkley** + **ADWIN**: concept-drift detectors → widen band / re-estimate.
- **PSI / KL** distribution-shift sentinel.

### 3.6 Predictability / chaos
- **Hurst (R/S)**, **Lyapunov (Rosenstein)**, **Takens embedding** → predictability horizon.

### 3.7 Spatial / clustering
- **3D embed** (reach/value/drift) + standardize; **KMeans/DBSCAN/GMM** + consensus;
  **Mahalanobis** concentration; **MST + Davies–Bouldin** constellation; **Louvain** data-gravity
  + cluster-to-cluster dependency.

### 3.8 Refinement
- **Bootstrap stability selection**, **27-point (3×3×3) enclosure**, **wave refinement** (bootstrap
  + OOS scoring), **funnel** (drop-off through stages).

### 3.9 TPA (Threaded Point Analysis) — P113–117
- Fan 2m+1 % offsets from the refined cluster center; forecast each; winner = argmin|F−actual|;
  thread of winners → modifier M (ship only if forward-lift>0 AND thread-autocorrelation sig);
  breach detection → adaptive range.

### 3.10 Decomposition
- **STL / SSA / wavelet / EMD** → forecast components, recombine (causal only).

---

## 4. TIER 0 — Foundation & harnesses (Phases 1–12, fully detailed)

> Format per phase: **Goal · Intent · Overview · Required steps · Goal-met gate.**

### Phase 1 — Repo scaffold
- **Goal:** a clean, building, empty app (backend boots, frontend renders blank shell).
- **Intent:** a known-good baseline so every later phase's change is isolated.
- **Overview:** FastAPI backend + Vite/React/TS frontend in the repo; `make verify` skeleton.
- **Steps:** init backend (FastAPI, uvicorn, requirements), frontend (vite react-ts), a `/health`
  endpoint, a blank shell; wire `make verify` = pytest + tsc + vite build.
- **Goal-met:** `make verify` exits 0; blank shell screenshot committed. (OG8)

### Phase 2 — pytest harness (real data)
- **Goal:** a test runner that exercises code on REAL fetched data, no mocks.
- **Intent:** make G2/G3 enforceable from phase 1.
- **Overview:** fixtures that fetch a real ticker once and cache; assertion helpers.
- **Steps:** build fixture `real_series(ticker)`; sample test asserts ≥200 rows, positive, dated.
- **Goal-met:** sample test passes on live data; fails loudly if data is malformed. (OG1)

### Phase 3 — Render/screenshot harness
- **Goal:** headless page render + console-error capture + full-page screenshot.
- **Intent:** make the visual gate (G4/G5) mechanical and unfakeable.
- **Overview:** Playwright script: load URL, collect console errors, screenshot to evidence dir.
- **Steps:** install Playwright+chromium; `render(url, name)` → returns {errors[], pngPath}.
- **Goal-met:** returns a real PNG + asserts 0 console errors on the blank shell. (OG5)

### Phase 4 — Validation harness (math gate utils)
- **Goal:** reusable numeric-assert + held-out-split utilities.
- **Intent:** standardize G3 so every component proves itself the same rigorous way.
- **Overview:** `assert_close`, `coverage(actuals, lo, hi)`, `rolling_origin_split`, `beats_naive`.
- **Steps:** implement + self-test each on a known series (e.g. coverage of a known band).
- **Goal-met:** self-tests pass with exact expected numbers. (OG1, OG2)

### Phase 5 — Data fetch + cache (any ticker/interval/range)
- **Goal:** robust loader for Yahoo tickers AND generic CSV, any interval (1d/1wk/1mo), any years.
- **Intent:** OG7 (multi-scale, any dataset) starts here.
- **Overview:** `fetch(ticker, interval, y0, y1)` + `load_csv_series(path)`; disk cache.
- **Steps:** implement; test on AAPL daily/weekly/monthly + a CSV; assert schema + date filtering.
- **Goal-met:** all three intervals + CSV return valid, monotonic, positive series. (OG1, OG7)

### Phase 6 — Universe endpoint
- **Goal:** list every ticker we have data for (the picker's universe).
- **Steps:** scan cache; return sorted alpha tickers; test count vs cache.
- **Goal-met:** count exact; endpoint reachable headless. (OG4)

### Phase 7 — App shell (top tabs + left control panel + router)
- **Goal:** the dashboard skeleton: grouped top tabs, left control panel slot, main view router.
- **Intent:** the etl-viz layout that every page lives in.
- **Steps:** build shell; render; click each tab group; screenshot.
- **Goal-met:** shell renders, tabs switch views, 0 errors (screenshot). (OG5)

### Phase 8 — Global controls context
- **Goal:** shared stocks/date/granularity/horizon/target + Apply that re-runs pages.
- **Steps:** context + ControlPanel; test that Apply bumps runKey and pages re-fetch.
- **Goal-met:** changing a control + Apply triggers a re-fetch (asserted). (OG7)

### Phase 9 — Theme + stats bar
- **Goal:** consistent dark theme + a context/stats bar (n stocks, window, run id).
- **Goal-met:** matches spec visually (screenshot). (OG5)

### Phase 10 — Page archetype template
- **Goal:** a reusable Control/Viz/Data/Adjustment 4-sub-page template.
- **Steps:** build template with 4 routed sub-pages; render each empty.
- **Goal-met:** 4 sub-pages render and route. (OG4)

### Phase 11 — FE↔BE contract test
- **Goal:** every endpoint reachable from the headless browser (CORS correct).
- **Goal-met:** headless fetch of each endpoint returns 200. (OG5, OG6)

### Phase 12 — `make verify` (all gates runner)
- **Goal:** one command runs pytest + tsc + all renders + all math gates, exits 0 only if all pass.
- **Goal-met:** runs green on the foundation; produces the evidence index. (OG8)

---

## 5. TIERS 1–6 — Algorithm components (Phases 13–122)

Each component = **5 phases**: `.E` engine+math · `.D` data page · `.V` viz page · `.C` control
page · `.A` adjustment page. Each runs the full G1–G7 cycle. Below: per-component Goal/Intent/
Overview/Model-math/the-5-phases.

### C1 — Data validate & clean · Phases 13–17
- **Goal:** raw series → validated, gap-filled, outlier-FLAGGED series with an audit trail.
- **Intent:** garbage in = confident garbage out; quantify data quality before any forecast.
- **Overview:** schema/range/integrity checks + Benford first-digit sanity + linear-interp gaps +
  Hampel (rolling median ± k·MAD) outlier flags (flag, never delete).
- **Math gate:** Benford deviation vs theoretical log10(1+1/d); quarantine count exact;
  Hampel flags equal hand-computed MAD flags on a seeded series.
- **13 .E** build validate()+impute_and_flag(); test counts/flags exact. **14 .D** table of
  rows + flags; cells == engine. **15 .V** price line with flagged points marked; screenshot.
  **16 .C** knobs: Hampel k, interp method; changing k changes flag count (asserted).
  **17 .A** before/after cleaning diff; assert imputed points fill exactly the gaps.

### C2 — Stationarity & transform · Phases 18–22
- **Goal:** decide stationarity and produce the modeling target (returns/detrended).
- **Intent:** the math assumes stationarity; prove it and transform if not.
- **Overview:** ADF + KPSS tests; STL decomposition (trend/seasonal/resid); Box-Cox option.
- **Math gate:** ADF/KPSS p-values match statsmodels reference exactly; STL components sum to
  the original within ε; on a known random walk ADF says non-stationary.
- **18 .E** adf/kpss/stl; test vs statsmodels + recompose. **19 .D** test stats + recommendation
  table. **20 .V** STL trend/seasonal/resid panels; screenshot. **21 .C** transform selector
  (level/return/log); changing it changes the target series. **22 .A** raw vs transformed +
  re-test; assert transformed series passes stationarity.

### C3 — Multi-scale aggregation · Phases 23–27
- **Goal:** build the resolution ladder (1d→1wk→1mo or block-means) for cross-scale views.
- **Intent:** signal/structure differs by scale; the engine forecasts across scales.
- **Overview:** block-mean aggregation to S∈{1,2,5,10,21}; align back to target resolution.
- **Math gate:** each aggregated point equals the manual mean of its block; counts exact.
- **23 .E** aggregate(); test block-means. **24 .D** per-scale tables. **25 .V** overlaid
  multi-scale lines; screenshot. **26 .C** scale-ladder selector. **27 .A** add/remove a scale,
  assert the ladder recomputes correctly.

### C4 — Predictability ceiling (Hurst + Lyapunov + Takens) · Phases 28–32
- **Goal:** quantify how forecastable the series is and the horizon beyond which it isn't.
- **Intent:** cap claims; OG2/OG3 honesty — don't pretend to predict noise.
- **Overview:** Hurst (R/S), Lyapunov (Rosenstein), Takens embedding (attractor reconstruction).
- **Math gate:** Hurst≈0.5 on synthetic GBM (random walk), >0.5 on a trending series, <0.5 on
  mean-reverting; Lyapunov>0 on the logistic map (chaos), ≈0 on AR(1). Known-system checks.
- **28 .E** the three estimators + known-system tests. **29 .D** values + horizon table.
  **30 .V** Hurst/Lyapunov gauges + Takens 3D attractor; screenshot. **31 .C** embedding dim/lag
  knobs; effect on Lyapunov asserted. **32 .A** compare two series' predictability side-by-side.

### C5 — Base model pool · Phases 33–37
- **Goal:** the 11 base forecasters, each individually correct (see §3.1).
- **Intent:** diverse, decorrelated opinions; the raw material of the ensemble.
- **Overview:** naive, drift, ses, holt, linear, ar1, momentum, meanrev, theta, median, kalman.
- **Math gate:** each model's 1-step forecast recomputed by hand on a fixed 5-point series and
  asserted equal; measure pairwise error-correlation ρ (the diversity lever).
- **33 .E** all 11 + per-model unit tests + ρ matrix. **34 .D** per-model forecast table +
  ρ matrix table. **35 .V** all model forecasts overlaid vs actual; ρ heatmap; screenshot.
  **36 .C** enable/disable models, model params; effect asserted. **37 .A** add/remove a model,
  show the effect on ρ and ensemble.

### C6 — Ensemble combination (error-cov + shrinkage) · Phases 38–42
- **Goal:** combine survivors via inverse error-covariance, shrunk to equal weights.
- **Intent:** minimize ensemble variance given correlation (the ρσ² floor); dodge the
  combination puzzle via shrinkage.
- **Overview:** Σ=cov(errors); w=Σ⁻¹1/1ᵀΣ⁻¹1; w_final=0.5·w_eq+0.5·w_opt.
- **Math gate:** weights sum to 1; w matches closed-form on a 2-model toy; ensemble error ≤ mean
  member error (ambiguity identity) on held-out.
- **38 .E** combine() + tests. **39 .D** weights + per-model error table. **40 .V** weight bars +
  ensemble vs members; screenshot. **41 .C** shrinkage λ knob; effect on weights asserted.
  **42 .A** λ=0 (optimal) vs λ=1 (equal) vs 0.5; show OOS error of each.

### C7 — Conformal + ACI bands · Phases 43–47
- **Goal:** prediction ranges with calibrated coverage that adapts to drift.
- **Intent:** OG2 — the X% band must contain actual ~X% out-of-sample.
- **Overview:** split conformal (relative-residual quantiles) + Adaptive Conformal Inference.
- **Math gate:** on held-out, empirical coverage → target ±tolerance; ACI α-sequence converges;
  widening the target widens the band monotonically.
- **43 .E** conformal+ACI + coverage test. **44 .D** per-day lo/hi/actual/hit table. **45 .V**
  band + actual line; coverage badge; screenshot (band must bracket ~target% of points).
  **46 .C** target-coverage + window knobs; coverage moves with target. **47 .A** target 70 vs
  90 side-by-side; assert higher target → wider band → higher coverage.

### C8 — Debiasing (Mincer–Zarnowitz) · Phases 48–52
- **Goal:** remove systematic forecast bias the outward eye detects.
- **Intent:** OG2/OG3 — bias is untouched by averaging; correct it against truth.
- **Overview:** regress actual = α + β·forecast; unbiased iff α=0,β=1; shrink+rolling correction.
- **Math gate:** α,β equal numpy lstsq; on a deliberately +5% biased forecaster the correction
  removes the bias on held-out (mean signed error → ~0).
- **48 .E** MZ + correction + test. **49 .D** α,β + bias table. **50 .V** raw vs debiased
  forecast vs actual; screenshot. **51 .C** rolling-window + shrink knobs. **52 .A** biased vs
  debiased; assert OOS bias reduced.

### C9 — Multi-horizon (7/30/90) · Phases 53–57
- **Goal:** forecast & calibrate ranges 7, 30, 90 steps ahead, leakage-free.
- **Intent:** OG2/OG7 — the user explicitly wants 7/30/90-out with accuracy each.
- **Overview:** vol-scaled bands + reversion tilt + horizon bias + purge/embargo split.
- **Math gate:** purge/embargo unit test (no calibration row's target overlaps the eval point);
  removing the guard inflates coverage (prove the leakage effect numerically); per-h coverage.
- **53 .E** horizon forecaster + purge/embargo test. **54 .D** per-h made-on→target rows.
  **55 .V** per-h band vs eventual actual; screenshot. **56 .C** horizon set knob. **57 .A**
  with vs without purge/embargo — show the (honest, lower) coverage difference.

### C10 — Vector grid (1,980) · Phases 58–62
- **Goal:** the cloud of forecasts: 11 models × 12 lookbacks × 5 scales × 3 points.
- **Intent:** the multi-faceted basis for clustering/consensus.
- **Overview:** build_cloud → (value, reach, drift) per vector.
- **Math gate:** exact count = 11·12·5·3 = 1,980 (pre-clip); all finite; clip bounds respected.
- **58 .E** build_cloud + count test. **59 .D** vector table (sampled) + counts. **60 .V**
  value histogram of the 1,980; screenshot. **61 .C** lookbacks/scales/points knobs; count
  changes accordingly. **62 .A** coarse vs fine grid; show spread effect.

### C11 — 3D embedding + standardization · Phases 63–67
- **Goal:** place vectors in standardized (reach, value, drift) space for geometry.
- **Intent:** mixed-unit axes must be comparable before any distance (the §6B fix).
- **Overview:** z-score each axis (zero-variance floor); Mahalanobis-ready.
- **Math gate:** each axis post-scale mean≈0, std≈1; no NaN/inf; raw vs standardized distinct.
- **63 .E** embed+standardize+test. **64 .D** raw + standardized coord table. **65 .V** rotatable
  3D scatter; screenshot. **66 .C** axis on/off, scaling method. **67 .A** raw-Euclidean vs
  standardized-Mahalanobis distance — show why standardization matters numerically.

### C12 — Clustering (KMeans/DBSCAN/GMM) · Phases 68–72
- **Goal:** cluster the cloud three mechanically-different ways. **Intent:** mechanism diversity
  makes consensus meaningful (real clusterers, not KNN/GBM).
- **Math gate:** labels stable across seeds (Adjusted Rand Index high); k matches; silhouette>0.
- **68 .E** 3 clusterers+tests. **69 .D** label tables. **70 .V** 3D scatter colored by cluster,
  method toggle; screenshot. **71 .C** k/eps/min_samples. **72 .A** compare partitions.

### C13 — Consensus clustering · Phases 73–77
- **Goal:** vectors in the densest cluster of ≥2 of 3 methods → consensus forecast.
- **Math gate:** consensus ⊆ each densest; fraction∈[0,1]; forecast=mean(consensus) hand-checked.
- **73 .E**+tests. **74 .D** membership table. **75 .V** consensus highlighted in 3D; screenshot.
  **76 .C** vote threshold. **77 .A** ≥2 vs ≥3.

### C14 — Mahalanobis concentration · Phases 78–82
- **Goal:** covariance-aware concentration. **Math gate:** distances == scipy; ~68% within 1σ on Gaussian.
- **78 .E**+tests. **79 .D** distances. **80 .V** ellipsoid coloring; screenshot. **81 .C** σ. **82 .A** Euclid vs Mahalanobis.

### C15 — Constellation MST + Davies–Bouldin · Phases 83–87
- **Goal:** cluster-separation geometry. **Math gate:** MST==scipy; DB==sklearn.
- **83 .E**+tests. **84 .D** centroid/edge table. **85 .V** D3 canvas (hulls+glow+MST); screenshot.
  **86 .C** threshold/algorithm. **87 .A** tight vs sprawling.

### C16 — Louvain data-gravity + dependency · Phases 88–92
- **Goal:** community detection on return-correlation + cluster-to-cluster dependency.
- **Math gate:** modularity==networkx; dependency matrix symmetric & ≥0; defensive names separate (sanity).
- **88 .E**+tests. **89 .D** membership + dependency matrix. **90 .V** constellation canvas +
  dependency heatmap; screenshot. **91 .C** corr threshold, resolution. **92 .A** threshold sweep.

### C17 — Inverse-drift + Net results · Phases 93–97
- **Goal:** dissent-direction bias flag + 3 net results (mode/robust/consensus) + convergence.
- **Math gate:** coherence∈[0,1]; mode/trimmed/consensus hand-checked; convergence=1−spread.
- **93 .E**+tests. **94 .D** table. **95 .V** convergence viz; screenshot. **96 .C** threshold. **97 .A** scattered vs coherent dissent.

### C18 — Funnel + Wave refinement (stability) · Phases 98–102
- **Goal:** vector drop-off funnel + bootstrap stability-selection refinement.
- **Math gate:** funnel monotonic (nested); refinement improves OOS error OR is rejected (anti-circularity).
- **98 .E**+tests (incl OOS-validation of refinement). **99 .D** stage table. **100 .V** funnel chart;
  screenshot. **101 .C** thresholds, B. **102 .A** refined vs unrefined OOS error.

### C19 — Model Confidence Set · Phases 103–107
- **Goal:** keep models statistically tied for best (royal rumble).
- **Math gate:** survivors⊆pool; eliminated sig-worse (t-test); dominant-model toy → only it survives.
- **103 .E**+tests. **104 .D** survivor/loss table. **105 .V** elimination bracket; screenshot. **106 .C** α. **107 .A** α sweep.

### C20 — Calibration (isotonic / CQR / Brier) · Phases 108–112
- **Goal:** fix band-level miscalibration (the O6 narrow/wide gap). **Intent:** OG2 per-confidence calibration.
- **Math gate:** post-cal coverage→nominal across reliability curve; Brier improves; isotonic monotone.
- **108 .E** CQR+isotonic+reliability test. **109 .D** reliability table. **110 .V** reliability diagram;
  screenshot. **111 .C** method. **112 .A** uncalibrated vs calibrated narrow/wide hit (must close O6 gap).

### C21 — TPA (Threaded Point Analysis) · Phases 113–117
- **Goal:** post-base refinement — fan, thread, modifier, breach (Threaded_Point_Analysis spec).
- **Math gate:** fan=2m+1; winner=argmin verified; **modifier shipped only if forward-lift>0 AND
  thread-autocorrelation significant** (withheld where it's noise — proven, e.g. MSFT daily); breach correct.
- **113 .E** TPA+significance/lift tests. **114 .D** thread/winner/breach table. **115 .V** 3D threaded
  paths (winner bold, breaches red); screenshot. **116 .C** m,c,τ. **117 .A** modifier on/off OOS lift.

### C22 — Outward eye & adaptivity · Phases 118–122
- **Goal:** exogenous market regime, drift (Page-Hinkley/ADWIN), PSI sentinel, risk gates
  (overlap/MAD/SPC), O6 confidence audit, O7 triangulation, Kalman/continual update.
- **Math gate:** injected drift → Page-Hinkley fires; injected shift → PSI exceeds threshold; injected
  outlier → risk flag; exogenous uses only past market (no lookahead); O6 reports narrow/wide honestly.
- **118 .E** detectors+injection tests. **119 .D** flags/scores. **120 .V** drift/PSI/risk timeline +
  O6/O7 cards; screenshot. **121 .C** thresholds. **122 .A** with vs without outward eye on drifting series.

---

## 6. TIER 7 — Integration, scale & end-to-end truth (Phases 123–132)

| P | Goal | Required steps | Goal-met gate |
|---|---|---|---|
| 123 | Wire full pipeline (1 stock) | chain data→C1..C22; log every stage | every stage validated; final range calibrated (OG1,OG2) |
| 124 | Multi-stock ≤10 all pages | run 10; render every page | all render, <2s each (OG6,OG7) |
| 125 | Granularity 1d/1wk/1mo e2e | run weekly/monthly | coverage sane per granularity (OG7) |
| 126 | Performance budget | time every endpoint | FAIL if any >2s → optimize (OG6) |
| 127 | Repository: 1,000-stock run page | 1,000-row sortable + click→picker | renders; click loads stock (OG4) |
| 128 | 1,000-stock batch (resumable) | run; save artifact | 1,000 valid; mean coverage logged (OG2,OG3) |
| 129 | **End-to-end held-out validation** | forward-test stack vs naive, after costs | record lift; honest "no edge" if none (OG3) |
| 130 | Cross-page consistency | same stock everywhere | identical numbers (asserted) (OG1) |
| 131 | Full regression `make verify` | all tests+renders+math gates | exits 0 across 132 (OG8) |
| 132 | Final evidence report | compile /evidence/* | index: every math gate + screenshot (OG1–8) |

---

## 7. Cycle-to-100% rule (completeness gate)
- After each TIER, run the **Overall-Goals audit** (OG1–OG8) against everything built.
- If a **critical goal (OG1 correctness, OG2 calibration, OG5 visual truth)** is unmet for a
  component, reopen and **redo that section** — do not patch around it.
- "Complete" = all 132 phases PASS + `make verify` green + OG1–OG8 audit 100%. Keep cycling until then.
- No phase is "done" on my word — only on committed evidence (numbers + screenshot + goal-met verdict).

## 8. Start condition
Begin Phase 1 on approval; execute strictly in order; post each phase's evidence. Re-validate
existing code from Phase 13 — assume nothing works until its gate passes.

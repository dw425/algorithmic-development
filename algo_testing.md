# Algo Testing — Multi-Model Consensus Forecasting Framework

**Status:** Living design doc — refine & update iteratively.
**Last updated:** 2026-06-05

---

## 1. The Goal

Build a forecasting framework that attacks a prediction from many *different* angles
("royal rumble" the data), finds where independent methods overlap, and uses that
overlap — validated against reality — to identify the most trustworthy forecast for a
given dataset, along with honest uncertainty bands.

Core principle: **use cross-method agreement as a *selection signal* for which models
fit this data — not as a truth claim by itself.**

---

## 1B. MASTER ALGORITHM PLAN (unified — all layers combined)

**15 CRITICAL STEPS** — Pre (prep) → Core (engine) → Post (synthesis).

| # | Stage | Step | What it does | Method | Guardrail |
|---|---|---|---|---|---|
| | **PRE — DATA PREPARATION** | | | | |
| 1 | Pre | Ingest & validate | Load; schema/type/range/integrity checks; quarantine bad rows | Schema validation, range/Benford checks | Bad data quarantined & logged, never silently dropped |
| 2 | Pre | Clean & impute | Missing values, dedup, error correction | Interpolation / KNN-impute / MICE; Hampel filter | Flag outliers, don't blind-delete |
| 3 | Pre | Transform & structure | Stationarity (detrend/deseasonalize/Box-Cox), scaling, resolution ladder (5 scales × 3 points), time-aware split | ADF/KPSS, STL, robust scaling, purged CV | No leakage: purge/embargo across split (López de Prado) |
| 4 | Pre | Predictability ceiling | Lyapunov horizon → how far forecastable at all | Chaos theory, Takens' embedding | Past horizon → "unpredictable", not a number |
| | **CORE — MULTI-VECTOR ENGINE** | | | | |
| 5 | Core | Build model pool | 10×12 decorrelated clock + random subspace; measure ρ | Ensemble, bagging / random subspace | Only admit models that LOWER ρ |
| 6 | Core | Generate grid | All models × grid → 1,800 preds (value/null); cross-scale reconcile | MAPA + THieF | Cross-scale disagreement = a feature, kept |
| 7 | Core | Spatial embed | Standardized 3D field (x=pos, y=value, z=drift) | Feature-based forecasting (FFORMA) | Standardize axes; Mahalanobis not Euclidean |
| 8 | Core | Cluster & gravity | 3 clusterings + consensus; mean-shift → 12 centerpoints | Consensus clustering, mean-shift / KDE | Real clusterers (not KNN/GBM); iterative center |
| 9 | Core | Enclose & refine | 27-pt ellipsoid + 3 waves of refinement | Stability selection | Each wave: bootstrap resamples + OOS scoring |
| 10 | Core | Select survivors | Royal rumble — keep set statistically tied for best | Model Confidence Set | Survivors win by OOS error, not agreement |
| 11 | Core | Score & inject | Calibrated confidence + data-derived Bayesian priors | Brier/CRPS + isotonic; Bayesian priors / mixtures | Confidence CALIBRATED; priors overrideable, reweight |
| 12 | Core | Risk gates | Overlap gate / deviation (MAD) / SPC control charts | Reject option, outlier detection, control charts | Escalate to analysis, never suppress; fail-safe default |
| | **POST — SYNTHESIS & PRESENTATION** | | | | |
| 13 | Post | Extrapolate waves | Project refined waves forward + calibrated bands | Conformal prediction | Bands carry verified coverage |
| 14 | Post | Aggregate & net-out | All vectors → complex grid + 3D overview; largest cluster + robust average + consensus = "what makes most sense" | Mean-shift mode, robust central tendency, fan chart | Report cluster, average AND spread — never a lone number |
| 15 | Post | Validate & learn | Rolling-origin funnel; continual update (posterior→prior + drift); final result set | Rolling-origin backtest, sequential Bayes / Kalman, ADWIN | Every number paired to held-out accuracy; verify learning helps |

**Three spines running through every phase:**
1. **Lower ρ** (decorrelation) — the only lever that improves consensus (phases 1–3).
2. **Validate against held-out reality, never against your own consensus** — keeps the
   three refinement loops from self-confirming (phases 5–7).
3. **Every guardrail ESCALATES to investigation, never silently suppresses** — a tripped
   control means "stop and analyze deeper," not "delete." Protects against noise without
   going blind to rare-but-real events. Fail-safe default = abstain / widen band / fall
   back to naive baseline; NEVER default to a confident guess (see §6E).

---

## 1C. FULLY INTEGRATED PIPELINE — every mechanism placed

The complete model: all layers, both eyes (👁️IN = variance/ρ, 👁️OUT = bias), and all 10
accuracy improvements (#) assigned to their step. Cross-cutting spines apply to ALL steps.

**4 CROSS-CUTTING SPINES (every step obeys these):**
1. **Lower ρ** — decorrelation is the only lever on the variance floor.
2. **Validate against held-out reality** — never against your own consensus.
3. **Guardrails ESCALATE, never suppress** — fail-safe default = abstain/widen/baseline.
4. **Both eyes open** — inward (agreement) kills variance; outward (reality) kills bias.

### PRE — DATA PREPARATION
- **Step 1 — Ingest & validate.** Schema/type/range/integrity, Benford; quarantine bad
  rows (logged, never silent-drop).
- **Step 2 — Clean & impute.** Interpolation / KNN / MICE (never zero-fill); Hampel filter;
  flag outliers, don't blind-delete.
- **Step 3 — Transform & structure.** Stationarity (ADF/KPSS, STL, Box-Cox); robust
  scaling; resolution ladder (5 scales × 3 points); purge+embargo time split (top leakage
  guard). **+#7** signal decomposition (SSA/wavelet/EMD, causal). **+👁️OUT/O3** ingest
  exogenous leading indicators here.
- **Step 4 — Predictability ceiling.** Lyapunov horizon + Takens embedding → cap range.

### CORE — MULTI-VECTOR ENGINE
- **Step 5 — Build model pool.** 10×12 decorrelated clock; random subspace/bagging; measure
  ρ matrix, prune redundant; opposing assumptions (mean-rev vs trend). **+#9** per-model
  Bayesian hyperparameter opt. **+#10** negative-correlation learning. **+#1/O3** global
  cross-series models.
- **Step 6 — Generate grid.** All models × grid → 1,800 preds (value/null); cross-scale
  reconcile (THieF) + cross-sectional MinT. **+#6** direct multi-horizon strategy.
  **+#1** exogenous covariates fed to models.
- **Step 7 — Spatial embed.** Standardized 3D field (x/y/z); Mahalanobis distance.
- **Step 8 — Cluster & gravity.** 3 mechanism-diverse clusterings + consensus clustering;
  mean-shift → 12 centerpoints. **+👁️IN** cascading multi-cluster (top-3 modes);
  constellation geometry (MST + validity index).
- **Step 9 — Enclose & refine.** 27-pt ellipsoid; 3 waves (bootstrap resamples + OOS
  scoring = stability selection). **+👁️IN** inverse-drift analysis of out-of-scope vectors
  (dissent coherence × dissenter OOS-reliability).
- **Step 10 — Select survivors.** Model Confidence Set (royal rumble). **+#3**
  error-covariance-optimal combination + shrinkage. **+#5** hybrid residual modeling.
- **Step 11 — Score, inject & DEBIAS.** Calibrated confidence (Brier/CRPS + isotonic);
  Bayesian prior injection (data-derived, overrideable, mixture/regime). **+#4** FFORMA
  feature-based adaptive weighting. **+#8** native probabilistic + CQR bands.
  **+👁️OUT/O1+O2** Mincer–Zarnowitz bias measurement → shrunk rolling debiasing.
- **Step 12 — Risk gates.** Overlap gate (reject option); deviation (MAD); SPC control
  charts; multi-cluster split → flag. **+👁️OUT/O5** distribution-shift sentinel
  (adversarial validation / PSI / KL). Escalate-not-suppress; fail-safe default.

### POST — SYNTHESIS & PRESENTATION
- **Step 13 — Extrapolate waves.** Project refined waves + conformal/CQR bands.
  **+👁️OUT/O6** confidence-conditional accuracy audit.
- **Step 14 — Aggregate & net-out.** All vectors → complex grid + 3D overview + fan chart;
  3 net results (largest cluster / robust avg / consensus) + convergence test (divergence =
  risk flag). **+👁️OUT/O7** external triangulation vs independent forecasts.
- **Step 15 — Validate & learn.** Rolling-origin funnel (band vs OOS error); **+👁️OUT/O4**
  reality feedback loop + bias dashboard; continual update (posterior→prior, ADWIN drift,
  forgetting). Final result set: value + OOS accuracy + confidence + risk flags + horizon +
  bias-correction applied.

**Inward FLAGS → Outward RESOLVES:** §6J flags (inverse-drift / multi-cluster / constellation)
route to §6K resolvers (O1+O3 / O7+O5 / O4). Smoke detector → fire extinguisher.

---

## 1D. IMPLEMENTATION STATUS (~/Desktop/forecast-app — running)

Python (FastAPI) + React/TS app. `backend/` (engine.py, engine_vectors.py, data.py) +
`frontend/`. 3 tabs: Baseline · Full engine (all 10) · 13-phase visual walkthrough w/ 3D.

**BUILT & verified on 2024→2025 first-90-days, 10 stocks:**
- ✅ Data ingest (Yahoo, daily close, cached) · log-returns · multi-scale aggregation
- ✅ Chaos ceiling (Hurst exponent) · ✅ 1,800-vector cloud (10×12×5×3)
- ✅ 3D embed (reach/value/drift) + standardize · ✅ 3 clusterings (KMeans/DBSCAN/GMM) + consensus
- ✅ Mahalanobis concentration · ✅ Constellation (MST + Davies–Bouldin)
- ✅ Inverse-drift bias flag · ✅ Net results (mode/robust/consensus + convergence)
- ✅ Debiasing (Mincer-Zarnowitz-lite, O1/O2) · ✅ Adaptive Conformal (ACI) → hits ~70%
- ✅ Risk gates (SPC 3σ) · ✅ Multi-horizon (day/week/month) · ✅ walk-forward coverage+width

**RESULT:** baseline 7-model mean coverage 59.2% → full engine ~66.5% (MSFT/JNJ = 70.0%).
ACI + debiasing closed most of the gap to the 70% target.

**ALSO NOW WIRED (audit 2026-06-06, verified live):**
- ✅ Exogenous O3 (SPY market regime → drift tilt + band vol-scale)
- ✅ Model Confidence Set (royal rumble — drops models, e.g. keeps naive/drift/ar1)
- ✅ Drift detection (Page-Hinkley → widens band) · ✅ O5 PSI shift sentinel
- ✅ Bayesian 2-regime mixture band · ✅ 10 study-derived vectors (7/30/90 forecaster)

**DATA LAYER NOW BUILT (Steps 1–3, verified, grep-proven called):** schema/Benford validate
+ quarantine · linear-interp impute + Hampel outlier FLAGGING · ADF/KPSS stationarity + STL ·
**purge/embargo leakage guard**. ⚠️ FINDING: the leakage fix dropped 90-day coverage 65%→48%
— the prior long-horizon number was INFLATED by calibration leakage. Now honest.

**FULL BUILD COMPLETE (2026-06-06, all grep-verified called):** CQR cloud-spread bands
(#8 — fixed calibration to exactly 70%) · FFORMA regime tilt (#4) · hybrid-residual (#5) ·
error-cov combination (#3) · ρ-matrix + effective-N · THieF/MinT reconciliation ·
signal decomposition (STL) · Kalman model (pool now 11, N_VECTORS=1980) · true Lyapunov
(Rosenstein) · bootstrap stability selection · O6 confidence audit · O7 triangulation ·
O8 calibration · data layer Steps 1–3 + purge/embargo · MCS · drift (Page-Hinkley) · PSI · mixture.

**⚠️ BIGGEST HONEST FINDING — ρ = 0.655, EFFECTIVE MODELS = 1.46 of 11.** The math in §3
predicted it: the 1,980 vectors are highly correlated, so they carry ~1.5 independent
opinions, NOT 1,980. Massive vector count ≠ massive information. The error floor ρσ²
dominates. This is THE truth about the approach — more vectors barely helps; only genuine
decorrelation (or exogenous signal) lowers the floor.

**ONLY 2 ITEMS REMAIN:** hyperparameter optimization (HPO) of base models · active
negative-correlation LEARNING (we MEASURE ρ=0.66 but don't yet train models to decorrelate —
which the ρ finding shows is the highest-value remaining work).

**STILL NOT BUILT (superseded):** ρ-matrix +
negative-correlation learning + HPO · THieF/MinT reconciliation · 27-point + 3-wave
stability-selection refinement · error-covariance combination · hybrid-residual · FFORMA ·
isotonic/Brier/CRPS + CQR calibration · signal decomposition (SSA/wavelet/EMD) · O6
confidence-conditional audit · O7 external triangulation · Kalman/continual posterior→prior ·
true Lyapunov/Takens (only Hurst proxy today).

---

## 2. Validated Ideas (keep these)

- **Ensemble / multi-method combination.** Combining many models beats any single
  model. Proven by every M-competition (M4, M5 won by ensembles/hybrids).
- **Multi-scale temporal aggregation.** Forecast at multiple time granularities
  (min → hour → day → week → month) and reconcile. Your original "5 intervals" idea.
- **"Clock from 12 directions" = decorrelation.** Approaching from genuinely different
  angles is the right instinct — different assumptions = uncorrelated errors = lower
  error floor.
- **Consilience / triangulation.** Agreement among *independent* methods (that share no
  blind spot) is genuinely informative. Three different model families landing in the
  same place means more than 50 near-identical models agreeing.
- **Overlap / cluster detection.** Finding where 2+ decorrelated methods intersect is a
  valid candidate-generation step.
- **Funnel visualization.** Watching the prediction cloud narrow across stages is a good
  diagnostic — *as long as* it's plotted against out-of-sample error, not alone.
- **Drift / transition tracking.** When the consensus cluster starts splitting, the
  future is getting less predictable — a valuable signal on its own.

---

## 3. Hard Constraints (the math — these cannot be engineered away)

- **Ensemble error floor:** `Var(ensemble) = (1-ρ)/M · σ² + ρσ²`.
  - More models (M) only shrink the first term. The `ρσ²` floor never goes away.
  - **The lever is ρ (error correlation), NOT M (model count).**
- **Effective number of models:** `M_eff ≈ 1/ρ`. 100 correlated models can behave like
  ~2–10 independent ones. Adding redundant models buys almost nothing.
- **Bias is untouched by averaging.** `E[ensemble] = b`. A shared blind spot survives
  averaging 1500 models intact → tight cluster, confidently wrong (precision ≠ accuracy).
- **No Free Lunch theorem.** No algorithm is universally most accurate across all
  datasets. "Handles any dataset optimally" is provably false. It can be *excellent on
  structured data*; it cannot be universally optimal.
- **Iterated ±10% pruning is circular.** Repeatedly discarding disagreement is a
  contraction toward the consensus mode — it converges regardless of truth and
  manufactures false confidence. Will produce a tight funnel on pure noise.
- **Precision vs accuracy.** Internal agreement measures precision. Accuracy can ONLY be
  measured against held-out truth. This gap is the central risk of the whole approach.

---

## 4. The Non-Negotiable Rule

> **Every agreement is a hypothesis, not a verdict. Validate the agreeing subset on
> held-out data the selection process never touched.**

If the agreeing models also score well out-of-sample → real signal, trust them for this
data. If they agree but score badly OOS → shared blind spot, false consensus. The
held-out check is what separates the two, and it's cheap (you're backtesting anyway).

---

## 5. Existing Techniques to Leverage (don't reinvent)

| Idea in our design | Established method | What it gives us |
|---|---|---|
| Royal rumble — fight, eliminate losers, keep survivors | **Model Confidence Set (MCS)** — Hansen, Lunde & Nason 2011 | Formal procedure: returns the subset of models statistically tied for best at confidence α. Replaces hand-picked ±10%. |
| Find the subset worth combining | **Forecast pooling** — Kourentzes, Barrow & Petropoulos | Select a *pool* of forecasts, discard the rest. |
| Overlay/overlap → combine the dense cluster | **Cluster-based forecast combination** | Cluster forecasts, combine within the dense cluster. |
| Multi-scale (min→month) | **MAPA** (Multiple Aggregation Prediction Algorithm) | Forecast at several temporal aggregations, combine. |
| Multi-scale, made consistent | **Temporal Hierarchies / THieF** — Athanasopoulos, Hyndman, Kourentzes | Reconcile across granularities so levels agree. |
| Combine model outputs | **Stacking / super learner**, **Bayesian Model Averaging** | Learned/probabilistic blend weights. |
| The ±10% bands, done right | **Conformal prediction**, quantile regression | Bands with *guaranteed* coverage rate, distribution-free. |
| Inflate the cloud robustly | **Bagging / bootstrap aggregation** | Perturb data, forecast each, cluster results. |
| Honest evaluation | **Rolling-origin (walk-forward) backtest**; MASE, sMAPE, pinball loss, empirical coverage | Out-of-sample truth, never a single split. |

---

## 6. Proposed Architecture (current best version)

**Stage 0 — Data & resolution ladder**
- Ingest series at native interval. Build aggregation ladder (min → hour → day → week →
  month). Aggregate to each level.

**Stage 1 — Diverse base models ("the clock")**
- ~15–25 *deliberately decorrelated* model families (NOT 100 redundant ones):
  ARIMA, ETS, Theta, gradient-boosted trees, N-BEATS/LSTM, Fourier/spectral, Gaussian
  Process, Prophet-style decomposition, + naive/seasonal-naive baseline (always — if you
  can't beat it, stop).
- **Measure the pairwise error-correlation (ρ) matrix.** Only keep adding models that
  *decorrelate* the pool. Confirm the 12 clock-hands actually point different directions.
- Run all models at every level of the ladder.

**Stage 2 — Cross-scale reconciliation**
- Bring all forecasts to the target resolution; reconcile across scales (THieF-style).
- Cross-scale disagreement is itself a feature — flag it.

**Stage 3 — Overlap / consensus by density**
- Per future timestamp: density-estimate (KDE) or cluster (DBSCAN/mean-shift) the cloud
  of forecasts.
- Mode of densest cluster = consensus point. Cluster spread = honest uncertainty.
  Bimodal cloud = models disagree → report both.

**Stage 4 — Royal rumble survivor selection**
- **Model Confidence Set** to formally eliminate inferior models and return the surviving
  set statistically tied for best.
- Survivors that agree (your "3–4–5 vectors in the cluster") = candidate best models.

**Stage 5 — Calibrated bands**
- Wrap in **conformal prediction** (held-out calibration window) → bands with verified
  coverage. Replaces fixed ±10%.

**Stage 6 — Validation harness (the part that makes it honest)**
- Rolling-origin backtest scores every model + every combination out-of-sample.
- Funnel plot: band width AND out-of-sample error together. Stop refining when band keeps
  shrinking but error stops dropping (= overfitting).
- Log every run → each "hypothesis" (e.g. "adding spectral model helps day-level") is a
  recorded, reproducible experiment.

**Output:** consensus value + WHICH models formed it + their held-out accuracy + drift
signal → so you know whether to trust it *for this data*.

---

## 6B. Spatial / 3D Consensus Layer (positional analysis)

Goal: compare the forecast vectors **positionally in a 3D field**, not just as flat
values — so overlap is judged by geometry, not raw number proximity.

**The prediction grid**
- Clock: 10 models × 12 vectors = **120 predictions**.
- × 5 time-series scales × 3 indication points = **1,800 predictions**.
- Each lands on a **value or null** (null = method not applicable / missing).

**The 3 axes (must be standardized first — see traps below)**
- **x = absolute position** (time index / where in the series).
- **y = vector value attribution** (the predicted value — the axis we care most about).
- **z = gravity / drift from center** (distance from the density mode — an *output* of the
  gravity step, refined iteratively, NOT a fixed input).

**The pipeline**
1. Place all 1,800 predictions into the standardized 3D field.
2. Run **3 different clustering algorithms** → 3 partitions of the 1,800 points.
3. **Cross-compare the 3 clusterings** (consensus clustering) → keep points the clusterers
   *agree* belong together.
4. Pick **12 centerpoints** (clock hands) — where each primary vector has the highest
   concentration of similar values.
5. Around each centerpoint, a **Mahalanobis ellipsoid** (the proper "±10% sphere") captures
   nearby points; compare them in 3D, not flat.
6. **Data gravity:** align to the absolute density mode (mean-shift), capture values within
   ~±30% of that absolute point, inspect the concentration.
7. Highest-concentration region = the vectors that genuinely overlap → candidate forecast.

**Established methods this maps to**
| Our idea | Real method |
|---|---|
| 3D positional / feature-space analysis | Feature-based forecasting, **FFORMA**, `tsfeatures` |
| Cross-compare 3 clusterings | **Consensus clustering / cluster ensembles** (Strehl & Ghosh) |
| Data gravity → centerpoint → radius capture | **Mean-shift clustering** / KDE mode-finding |
| Proper "sphere" in mixed-unit space | **Mahalanobis distance** (covariance-aware ellipsoid) |

**TRAPS — fix before building:**
- ⚠️ **KNN and gradient boosting are NOT clustering algorithms** (they're supervised).
  Use actual clusterers: k-means, DBSCAN/HDBSCAN, GMM, hierarchical, spectral, mean-shift.
  Pick 3 that disagree in *mechanism* (centroid vs density vs distribution) so consensus
  means something. Use KNN/GBM instead as the **meta-learner** in Stage 6.
- ⚠️ **Axes are different units — standardize (z-score/min-max) every axis before ANY
  distance.** Otherwise the largest-range axis dominates and the "sphere" is meaningless.
  Then use **Mahalanobis distance**, not raw Euclidean, for the capture regions.
- ⚠️ **z = drift-from-center is circular** — solve iteratively (mean-shift does exactly
  this); treat z as a refined output, not a fixed input.
- ⚠️ **Fixed ±10% / ±30% radii are arbitrary** — set radius by **density quantile
  (adaptive bandwidth)**; keep the fixed numbers only as starting defaults.

---

## 6C. Chaos, Random Sampling & Wave Refinement

**Chaos element — use the rigorous version, not noise-for-noise's-sake**
- ✅ **Lyapunov exponent → predictability horizon.** Measures how far out the system is
  forecastable before error grows exponentially. Beyond it, NO model/ensemble/cluster can
  predict. This sets the *ceiling* on the whole framework — tells us where to stop trusting.
- ✅ **Takens' embedding theorem → attractor reconstruction.** Principled version of the 3D
  spatial field; reconstructs system dynamics from a single series.
- ✅ **Stochastic perturbation testing.** Inject small input noise; does the consensus
  survive? = robustness check.
- ❌ Random perturbation "because more = better" → just dilutes signal. Randomness must do
  a job.

**Random sample vectoring — yes, and it lowers ρ (the one lever that matters)**
- Maps to **random subspace method / bagging / Monte Carlo**. Randomly varying data &
  features per model *decorrelates errors* → lowers the `ρσ²` floor. This is a real way to
  drive ρ down, not a side feature.
- Rigorous form: **stability selection** (Meinshausen & Bühlmann) — keep only vectors that
  survive across MANY random resamples. Robust by construction.

**27-point enclosing shape — fine as geometry**
- 27 = 3×3×3 voxel grid around the center. Adaptive "other shape" = **convex hull**,
  **alpha shape**, or (best, ties to our Mahalanobis choice) a **confidence ellipsoid**.

**3-wave refinement — ⚠️ CIRCULAR unless the referee points outward**
- The loop "pull inside box → recluster survivors → shrink → repeat" is the SAME
  contraction-toward-consensus as the ±10% pruning. It converges regardless of truth →
  confident funnel on pure noise.
- ✅ **Legitimate version:** (a) run each wave across **bootstrap resamples**, keep only
  vectors stable across draws (stability selection); AND (b) **score each wave against
  held-out data**. Lower OOS error wave-over-wave = real refinement. Box shrinks but OOS
  error flattens/rises = self-confirming → stop at that wave.
- The user's own "compare 3 waves against original scoring" IS the fix — *if* "scoring"
  means out-of-sample accuracy, not tightness.

**Established methods:**
| Our idea | Real method |
|---|---|
| Chaos / predictability ceiling | Lyapunov exponent, **Takens' embedding**, recurrence quantification |
| Random sample vectoring | **Random subspace / bagging / Monte Carlo**, **stability selection** |
| Enclosing shape from boundary points | Convex hull / alpha shape / **confidence ellipsoid** |
| Wave refinement (done right) | Stability selection + rolling-origin OOS validation |

---

## 6D. Confidence Scoring, Bayesian Injection & Continual Learning

**Unifying insight:** confidence scoring + logical injection + continual learning are all
facets of **ONE framework — Bayesian inference**:
- Logical injection = the **prior**
- Model predictions = the **likelihood**
- Confidence score = the **posterior** (+ credible interval)
- Continual learning = **sequential updating** (today's posterior → tomorrow's prior)
- Bonus property: strong evidence **automatically overrides** the prior.

**Confidence scoring**
- Combine: cluster density + cross-method agreement (post-decorrelation) + OOS track record
  of contributing models + Mahalanobis distance from center + stability across resamples.
- ⚠️ **MUST be calibrated** — "0.8 confidence" must be right 80% of the time. Measure with
  **proper scoring rules** (Brier, log-loss, CRPS); fix with **isotonic regression / Platt
  scaling**; check on a **reliability diagram**. Uncalibrated confidence is just a
  feel-good number.

**Logical injection — GOOD version vs FOOTGUN**
- ✅ **GOOD:** inject domain knowledge as a **data-derived prior** (e.g. empirical return
  distribution says >5% moves are rare → down-weight a 10% prediction). Principled Bayes.
- ⚠️ **FOOTGUN:** "artificially boost confidence for vectors we like" = hardcoded
  **confirmation bias**. The system confirms beliefs instead of learning.
- **Rules for safe injection:**
  1. **Data-derived, not opinion** (the 5% bound comes from the return distribution).
  2. **Overrideable by strong evidence** (Bayes does this; a real regime shift must win).
  3. **Validated** — does the injection improve OOS accuracy? If not, it's bias — remove it.
  4. **Reweight, don't exclude** — lower confidence, don't zero it.
- ⚠️ **Tail-risk trap (the stock example):** days a stock moves >5% are crashes / earnings
  shocks — the highest-impact days you MOST need to catch. A flat 5% guillotine is right
  95% of the time and catastrophically wrong on the 5% that matter (cf. 2008 risk models).
  Fix: **mixture model** (normal regime + tail regime); let strong evidence override.

**Continual learning ("roll data in to keep improving")**
- = **online / incremental learning**; recursive form = **Kalman filter / state-space**.
- ⚠️ **More data ≠ monotonically better on a changing world.** Old data hurts after a
  regime shift (concept drift, catastrophic forgetting). Required companions:
  - **Drift detection** (ADWIN, Page-Hinkley) — notice when the world changed.
  - **Adaptive forgetting** (exponential discounting) — weight recent data more.
  - **Verify** OOS accuracy keeps improving — plateau/decay means stop accumulating.
- Honest framing: *constant learning + constant forgetting of what's no longer true.*

**Established methods:**
| Our idea | Real method |
|---|---|
| Confidence scoring | Proper scoring rules (Brier/CRPS/log-loss), isotonic/Platt calibration |
| Logical injection | **Bayesian priors**, soft constraints, **mixture models** (regime-switching) |
| Continual learning | Online/incremental learning, **Kalman filter / state-space**, sequential Bayes |
| Drift handling | **ADWIN / Page-Hinkley** drift detection, exponential forgetting |

---

## 6E. Risk Control, Acceptance Gates & Circuit Breakers

**Core principle:** every phase has acceptance criteria; failing them raises a flag that
**escalates to deeper analysis — never silent suppression.** A breaching vector may be a
bug OR the one model catching a regime change. Escalate, investigate, then decide.

**The three control mechanisms (all map to established methods):**

| Control | Mechanism | Established method | Done right |
|---|---|---|---|
| **Overlap gate** | If <X% of primary vectors (clock hands) overlap → halt, deeper analysis | Selective prediction / reject option (Chow's rule); epistemic uncertainty | X% **validated** against held-out data, not guessed. Best overfitting guard. |
| **Deviation flag** | Vectors far from robust center → raise risk flag | Outlier detection via **MAD** units / **Mahalanobis** distance | Adaptive distance (data's own spread), NOT fixed 90%. Flag ≠ delete. |
| **Variance-to-normality** | Prediction breaches historical change limits → out-of-control | **Statistical Process Control** (Shewhart / CUSUM / EWMA control charts) | Limits **adaptive** (rolling/EWMA), tied to drift detector — not static. |

**Aggregation & fail-safe:**
- All phase flags → **one risk score + go/no-go**, with reasons attached (auditable, not a
  black box). e.g. "halted: overlap 12% < 40%; 2 vectors breach control limits."
- **Fail-safe default:** when controls trip and can't resolve → **abstain / widen band /
  fall back to naive baseline.** NEVER default to a confident guess. Fail loud, fail safe.

**⚠️ Two caveats so controls help, not hurt:**
1. **Thresholds are hyperparameters, not constants.** Each guardrail must be validated:
   does tripping it actually correlate with bad outcomes on held-out data? An unvalidated
   guardrail adds false confidence that you're "controlled."
2. **Controls must separate "wrong" from "rare-but-real."** That's WHY every gate escalates
   to analysis instead of deleting — the mechanism that filters noise must not blind you to
   the 2008-type event. Same tail-risk discipline as §6D.

**Worked examples (user's):**
- Center 100, nominal ±30, but vectors at 190 / 10 → >3 MAD from robust center → flag,
  investigate (regime change? bug? data error?), don't auto-trust the consensus.
- Historic change 25% (dev to 50%), but a vector predicts >60% → breaches EWMA control
  limit → out-of-control signal → deeper analysis before the forecast is allowed out.

---

## 6F. PRE-STEPS — Data Cleaning & Preparation (Steps 1–4)

Garbage in → confident garbage out. The engine is only as good as what feeds it.

**Step 1 — Ingest & validate**
- Schema / type / range / integrity checks; timestamp continuity; unit consistency.
- **Benford's law / range checks** flag suspect values. Quarantine bad rows (logged), don't
  silently drop — a dropped row is a decision, and decisions get audited.

**Step 2 — Clean & impute**
- Missing values: interpolation (linear/spline), **KNN-imputation**, or **MICE** (multiple
  imputation) — never just zero-fill (biases everything downstream).
- Dedup; correct obvious errors. Outliers handled by **Hampel filter** — but **flag, don't
  blind-delete** (same discipline as risk gates: an outlier may be a real event).

**Step 3 — Transform & structure**
- **Stationarity:** test (ADF, KPSS), then differencing / detrend / deseasonalize (**STL**),
  **Box-Cox / log** for variance stabilization. Most forecasting math assumes stationarity.
- **Scaling:** robust scaling (median/IQR) so outliers don't dominate.
- Build the **resolution ladder** (5 scales × 3 indication points).
- **Time-aware split** with **purge + embargo** between train/val/test (López de Prado) —
  the single most important leakage guard; random shuffling here silently inflates accuracy.

**Step 4 — Predictability ceiling**
- Lyapunov horizon (see §6C) — gate the forecastable range before spending compute.

---

## 6G. POST-STEPS — Extrapolation, Grid Synthesis & Net Results (Steps 13–15)

Turn the cloud of refined vectors into one defensible answer + a readable overview.

**Step 13 — Extrapolate the refined waves forward**
- Project the surviving (wave-refined) vectors across the forecast horizon.
- Attach **conformal bands** so every extrapolated path carries calibrated uncertainty.
- Keep the *distribution of paths*, not just one line — the spread IS the information.

**Step 14 — Aggregate & net-out (the "what makes most sense" step)**
- Pour ALL surviving vectors into:
  - a **complex grid** (heatmap: scale × indication-point × value-density), and
  - the **3D overview** (the spatial field from §6B, now showing the final cloud).
- Compute the **net result** three ways and show all three (never collapse to one number):
  1. **Largest cluster** — mean-shift mode = where prediction mass concentrates.
  2. **Robust average** — Huber M-estimator / trimmed mean / confidence-weighted mean
     (NOT plain mean — outliers and tails would drag it).
  3. **Consensus** — MCS-survivor weighted blend (weight = OOS accuracy × confidence).
- "What makes most sense" = where these three converge. If they DON'T converge → that's a
  risk flag (§6E), escalate, don't paper over it with an average.
- Present as a **fan chart** (median path + widening uncertainty cone) — the standard,
  honest way to show a probabilistic forecast.

**Step 15 — Validate & learn**
- Rolling-origin funnel (band width vs OOS error); continual update (posterior→prior, with
  drift detection); emit the final **result set**: every value paired with its held-out
  accuracy, confidence, contributing models, risk flags, and horizon.

---

## 6H. Accuracy Improvements (end-to-end review)

Ranked by expected accuracy payoff. Several directly attack ρ (error correlation) or b
(bias) — the only two quantities the math proved matter.

| # | Improvement | Step | Method | Why accuracy ↑ | Caveat |
|---|---|---|---|---|---|
| 1 | Exogenous vars + global cross-series learning | 3,5,6 | Global models (M5 winner), covariates | More *signal*, not cleverer models — biggest real lever | Needs related series/covariates; gate by importance |
| 2 | Explicit bias correction (debiasing) | 10,11 | Subtract each model's mean signed error | Removes bias `b` — untouchable by averaging | Estimate on rolling window (bias drifts) |
| 3 | Error-covariance-optimal combination + shrinkage | 10 | Inverse error-cov (Bates–Granger / MinT) | Minimizes ensemble variance given ρ | Combination puzzle → SHRINK toward equal weights |
| 4 | Feature-based adaptive weighting | 11 | FFORMA (M4 winner) | Context-aware weights; right model per regime | Needs history to learn the mapping |
| 5 | Hybrid residual modeling | 9,10 | ES-RNN style (M4 winner) | Captures structure left in residuals | Overfits easily → keep only if OOS error drops |
| 6 | Direct multi-horizon forecasting | 6,13 | Direct / DirRec strategy | Stops recursive error accumulation at long horizons | One model per horizon (more training) |
| 7 | Signal decomposition before forecasting | 3 | STL / SSA / wavelet / EMD | Raises signal-to-noise per component | Edge decomposition can LEAK → do causally |
| 8 | Native probabilistic + CQR bands | 11,13 | Quantile/distributional, conformalized QR | Optimizes the metric judged on; sharper calibrated bands | — |
| 9 | Per-model hyperparameter optimization | 5 | Bayesian opt (Optuna) | Lifts every contributor's floor | Tune on val folds, not test |
| 10 | Negative-correlation learning | 5 | Diversity engineering | Directly drives down ρ → lowers error floor ρσ² | More complex training loop |

**If only three:** #1 (most signal) + #2 (kills bias term) + #3 (kills variance term
correctly). Together they hit both halves of the error decomposition `(1-ρ)/M·σ² + ρσ² + b²`.

---

## 6I. Balancing the Three Error Sources (the path to "awesome")

**Forecast error has THREE independent parts (dartboard analogy):**

$$error = \underbrace{(1-\rho)/M \cdot \sigma^2}_{scatter} + \underbrace{\rho\sigma^2}_{shared\ drift} + \underbrace{b^2}_{aim\ is\ off}$$

1. **Variance (scatter)** — darts scattered *around* the bullseye. Averaging cancels it.
2. **Correlation floor (shared drift)** — a crosswind pushes all darts the same way; they
   scatter *together*. Fixed only by making throwers genuinely different (lower ρ).
3. **Bias (aim is off)** — every thrower aims 6" left. Darts cluster *tight* but in the
   WRONG place. Averaging does NOTHING. Fixed only by correcting aim or new throwers.

**The core realization — INWARD vs OUTWARD eye:**

| Error term | Fixed by | Eye | Status |
|---|---|---|---|
| Variance | Averaging / clustering | 👁️ Inward (compare models to each other) | ✅ Excellent |
| Correlation ρ | Genuine model diversity | 👁️ Inward-ish (make models differ) | ⚠️ Partial |
| Bias b | External truth + external data | 👁️ Outward (compare to reality & world) | ❌ Missing |

> **Everything the framework does internally (clustering, consensus, refinement) fixes
> SCATTER. But agreement is BLIND to bias** — if every model aims 6" left, they agree 6"
> left, and the tight high-confidence cluster forms around the WRONG answer. An
> inward-looking system cannot detect that everyone is wrong in the same direction.

**Fix per term so all three are equally strong:**
- **Variance** ✅ — keep current machine; past diminishing returns, don't add more.
- **ρ** ⚠️ — diverse model FAMILIES; different data/features per model; negative-correlation
  learning; prune redundant models; include OPPOSING assumptions (mean-reversion vs trend).
- **Bias** ❌→✅ (the missing OUTWARD eye):
  - Debiasing (#2): subtract each model's mean signed error vs held-out truth.
  - Exogenous data (#1): external inputs break shared blind spots internal diversity can't.
  - Held-out validation everywhere = the ONLY instrument that can SEE bias.
  - Diverse training windows so models don't share one historical blind spot.

**SPINE #4:** *Look inward AND outward.* Inward eye (clustering/consensus) kills variance;
outward eye (debiasing/exogenous/held-out truth) kills bias. Awesome = both eyes open.
Current state: world-class right eye, closed left eye → open the left eye next.

---

## 6J. Multi-Cluster, Inverse-Drift & Constellation Analysis

Three mechanisms that make the INWARD eye smarter at detecting ρ and FLAGGING bias.
(They detect/characterize — confirming & correcting bias still needs the OUTWARD eye.)

**1. Inverse analysis of out-of-scope vectors → BIAS DETECTOR (sharpest)**
- Key insight: the *DIRECTION* of dissent is the signal.
  - Dissenters scattered randomly → just variance/noise, ignore.
  - Dissenters lean coherently one way → majority shares a DRIFT the other way (bias flag).
- **Inverse score** = directional coherence of the out-of-scope vectors.
- **Correction score** = how far the consensus shifts when dissenters are folded back in.
- ⚠️ **REFINEMENT:** weight dissent by reliability → `drift score = dissent coherence ×
  dissenter OOS-reliability`. A reliable model breaking from the herd = loud drift signal;
  an unreliable one = noise. Position alone can't tell them apart — track record can.
- Maps to: query-by-committee; trimmed-mean-vs-full-mean bias diagnostic.
- Honest: FLAGS bias from inside; confirming needs held-out truth (outward eye).

**2. Cascading multi-cluster (primary + next 2 + cross-analysis) → disagreement STRUCTURE**
- Find top-3 modes, compare them (multimodal forecasting / GMM / scenario analysis).
- 2–3 real camps (e.g. "crash" vs "continue") = genuine shape of uncertainty, not noise.
- ⚠️ Multiple strong clusters = RISK signal → feeds §6E gate (abstain / report both).
- ⚠️ Characterizes disagreement; does NOT say which camp is right. Cross-analysis scoring
  must be **OOS-accuracy-weighted**, not size-weighted — else you pick the larger-but-wrong
  camp.

**3. Constellation forming → cluster-separation geometry (DIAGNOSTIC)**
- Inter-centroid path length = **minimum spanning tree over cluster centroids**; formally
  **cluster validity indices** (Davies–Bouldin, Dunn, silhouette, Calinski–Harabasz).
- Tight constellation = agreement; sprawling = high disagreement.
- ⚠️ Use **standardized / Mahalanobis distance**, NOT raw Euclidean (mixed-unit axes — §6B).
- ⚠️ Primarily a DIAGNOSTIC / uncertainty-quantification tool feeding confidence & risk —
  it does not directly lower error the way debiasing does.

**Big picture:** #1–3 = a smart *smoke detector* for bias (detect/characterize). The
outward-eye items (debiasing, exogenous data, held-out truth) = the *fire extinguisher*
(confirm/correct). Complementary, not substitutes.

| Mechanism | Real method | Touches | Role |
|---|---|---|---|
| Inverse-drift analysis | Query-by-committee, trimmed-vs-full bias diagnostic | ρ + bias FLAG | Detect shared drift |
| Cascading multi-cluster | GMM, multimodal/scenario analysis | Variance + risk | Characterize camps |
| Constellation geometry | MST + cluster validity indices | Diagnostic | Quantify disagreement |

---

## 6K. THE OUTWARD EYE — Bias Detection & Correction (full design)

The symmetric half of §6I/§6J. Inward eye asks "where do models agree?" (kills variance).
Outward eye asks "are they all wrong in the same direction, and what are they all missing?"
(kills bias). Bias is only SEEN by comparing forecasts to REALITY.

**Organizing principle — two timing modes:**
- **A PRIORI (preventive):** remove the blind spot BEFORE forecasting → exogenous data (O3).
- **A POSTERIORI (corrective):** measure the offset AFTER the outcome → debiasing (O1/O2).

### Group A — Measure & correct the aim (a posteriori)
**O1. Bias measurement — Mincer–Zarnowitz regression.** `actual = α + β·forecast + ε`;
unbiased iff α=0, β=1. α≠0 = level bias; β≠1 = over/under-reaction. Regression gives the
correction directly. Run per-model AND on the ensemble.
**O2. Debiasing — subtract the offset, carefully.**
- Only if **statistically significant** (correcting noise ADDS error).
- **Shrink** the correction (estimation noise).
- **Rolling window** re-estimation (bias drifts).
- Conditional: model bias as f(regime/level/horizon) — bias is often not constant.

### Group B — Prevent the blind spot (a priori)
**O3. Exogenous signal discovery.** The ONLY way to fix bias before the outcome — removes
the shared blind spot itself.
- Find leading indicators: **Granger causality, transfer entropy, lagged cross-correlation**.
- Validate they genuinely lead (causal, no lookahead, not spurious).
- **Global cross-series learning** (borrow signal from related series).
- Feature-select hard — irrelevant vars add noise & overfit.

### Group C — Close the loop & watch for staleness
**O4. Reality feedback loop.** `predict → observe actual → measure bias (O1) → correct (O2)
→ update → repeat`. The §6D continual loop aimed at bias. Maintain a **bias dashboard**
(running signed error, per model & overall).
**O5. Distribution-shift sentinel.** Debiasing assumes yesterday's bias predicts tomorrow's
— breaks when the world moves. Detect via **adversarial validation, Population Stability
Index, KL divergence** on feature distributions. On shift → corrections are stale → widen
bands / re-estimate / abstain.

### Group D — Challenge the consensus
**O6. Adversarial falsification.** Try to BREAK the consensus, not confirm it.
- **Confidence-conditional audit:** when most confident, was it actually right? (else
  confidence = miscalibrated bias.)
- Devil's-advocate model; OOD detection on the forecast.
**O7. External triangulation.** Compare to genuinely INDEPENDENT external forecasts
(analyst consensus, prediction markets, benchmarks) — independent = doesn't share your
blind spot. Divergence from all = strong bias flag.

### Wiring: inward FLAGS → outward RESOLVES
- Inverse-drift flag (§6J #1) → O1+O3: test direction vs truth; does an exogenous var
  explain it? → confirm & correct, or dismiss as noise.
- Multi-cluster split (§6J #2) → O7+O5: is one camp aligned with external signal / regime shift?
- Constellation sprawl (§6J #3) → O4: does disagreement geometry track realized error?

### Honest traps
1. **Truth arrives with a lag** — always correcting yesterday's bias; reduces
   asymptotically; O5 flags when corrections go stale.
2. **Don't double-correct** — if O3 removed a blind spot, don't also debias for it.
3. **Correcting noise > not correcting is FALSE** — significance + shrinkage on every fix.
4. **Preventive beats corrective** — O3 (better inputs) fixes bias before it costs you;
   O1/O2 only after. Prioritize real exogenous signal over fancier debiasing.

| Pillar | Real method | Timing | Role |
|---|---|---|---|
| O1 Bias measurement | Mincer–Zarnowitz regression | a posteriori | See the offset |
| O2 Debiasing | Shrunk rolling bias subtraction | a posteriori | Correct the offset |
| O3 Exogenous discovery | Granger / transfer entropy / global models | a priori | Remove blind spot |
| O4 Feedback loop | Online learning / bias dashboard | continuous | Close the loop |
| O5 Shift sentinel | Adversarial validation / PSI / KL | continuous | Flag stale corrections |
| O6 Falsification | Confidence-conditional audit / OOD | continuous | Challenge consensus |
| O7 Triangulation | Independent external forecasts | per-cycle | Cross-check vs world |

---

## 7. Corrections to Carry Forward

- **Replace "p-value frequency"** with: dispersion/stability score + persistence across
  stages + empirical coverage. (P-values misused here — no defined null hypothesis;
  10 stages × 1500 vectors = severe multiple-comparisons problem.)
- **Replace hard ±10% pruning** with soft reweighting (IRLS / robust estimators / Bayesian
  update) so a correct-but-outlier model can recover instead of being killed in round 1.
- **"Before & after" layers:** use the "after" point in TRAINING only, never as a live
  forecast input → otherwise lookahead bias / data leakage. (Most common way forecasting
  projects fool themselves.)
- **Diversity over count:** optimize ρ, not M. 25 diverse + bagging beats 100 redundant.

---

## 8. Build Order — the staged PATH to "everything in the model"

GOAL = the full §1C pipeline. But building all 15 steps at once, untested, is how ambitious
models die (untestable, unattributable errors). Each tier adds capability ONLY after the
prior tier proves out on real/synthetic data. This is how you GET to everything safely.

**Tier 0 — Measuring stick (do first, always).**
- Seasonal-naive baseline + 1 good model + rolling-origin backtest. If you can't beat naive,
  stop and rethink. Everything else is judged against this.

**Tier 1 — Core consensus (the inward eye, minimal).**
- Steps 5–10 minimal: ~10 diverse models → grid → density/overlap consensus → MCS survivors.
- Test: does consensus pick good models? Does it refuse to narrow on noise?

**Tier 2 — Honesty layer.**
- Steps 3 (leakage-safe split), 9 (refinement done right: bootstrap + OOS), 11 (conformal +
  calibration), 15 (validation funnel). Now numbers are trustworthy.

**Tier 3 — The outward eye (bias).**
- Step 11 O1/O2 (Mincer–Zarnowitz + debiasing), Step 3/5 O3 (exogenous data — biggest lever),
  Step 15 O4 + Step 12 O5 (feedback loop + shift sentinel).

**Tier 4 — Accuracy improvements.**
- #1 exogenous/global, #2 debias (in Tier 3), #3 covariance-combine, #4 FFORMA, then #5–10.

**Tier 5 — Spatial + advanced inward.**
- Steps 7–8 full 3D/Mahalanobis, §6J multi-cluster + inverse-drift + constellation.

**Tier 6 — Risk, chaos, presentation, continual learning.**
- Steps 4 (Lyapunov), 12 (full risk gates), 13–14 (grid/3D/fan-chart outputs), 15 (online).

**Suggested stack:** Nixtla (`statsforecast` / `mlforecast` / `hierarchicalforecast`),
`sktime`, `darts`, `crepes`/`MAPIE` (conformal), `river` (online/drift), `Optuna` (HPO).
Prototype on Nixtla rather than hand-writing estimators.

---

## 9. Open Questions / To Refine Next

- [ ] **What are we forecasting?** Determines where on the "consensus-predicts-accuracy"
      spectrum the data sits (demand/traffic = good; asset prices = near-random).
- [ ] Add more forecasting techniques to the model pool (user wants to expand the clock).
- [ ] Decide ρ threshold for admitting a new model to the pool.
- [ ] Decide MCS confidence level (α) and backtest window sizes.
- [ ] Build the "royal rumble" prototype + ρ-matrix / M_eff visualization.
- [ ] Demo: run the ±10% loop on signal vs noise to see the false-funnel effect first-hand.
- [ ] Pick the 3 clustering algorithms for the spatial layer (must differ in mechanism).
- [ ] Confirm axis standardization + Mahalanobis distance for the 3D capture regions.
- [ ] Decide adaptive-bandwidth rule to replace fixed ±10% / ±30% radii.
- [ ] Define the 3 "indication points" precisely (what they measure).
- [ ] Add Lyapunov horizon estimator — caps the forecast range up front.
- [ ] Wire wave-refinement to bootstrap resamples + OOS scoring (avoid the circular loop).
- [ ] Decide # of bootstrap resamples for stability selection.
- [ ] Choose calibration method (isotonic vs Platt) + which proper scoring rule.
- [ ] Build the empirical-prior store for logical injection (data-derived, not opinion).
- [ ] Decide regime-switching / mixture model for tail events (avoid the 5% guillotine).
- [ ] Pick drift detector (ADWIN/Page-Hinkley) + forgetting factor for continual learning.
- [ ] Validate the overlap-gate % threshold against held-out data (not a guess).
- [ ] Choose control-chart type (Shewhart/CUSUM/EWMA) + window for adaptive limits.
- [ ] Define the aggregate risk score + go/no-go logic and its abstain fallback.
- [ ] Validate every guardrail threshold: does tripping it correlate with bad OOS outcomes?
- [ ] Pick imputation method (interpolation / KNN / MICE) + stationarity transforms.
- [ ] Set purge/embargo gap for the leakage-safe time split.
- [ ] Design the complex grid + 3D overview + fan-chart outputs.
- [ ] Define the convergence test for the 3 net-results (cluster / robust-avg / consensus).
- [ ] Build inverse-drift scoring (dissent coherence × dissenter OOS-reliability).
- [ ] Set top-K for cascading multi-cluster + OOS-weighted cross-analysis scoring.
- [ ] Pick cluster-validity index (Davies–Bouldin/Dunn/silhouette) for constellation metric.
- [ ] Build Mincer–Zarnowitz bias test + shrunk rolling debiasing (O1/O2).
- [ ] Source & causally-validate exogenous leading indicators (O3) — the preventive lever.
- [ ] Stand up bias dashboard + distribution-shift sentinel (O4/O5).
- [ ] Define confidence-conditional accuracy audit (O6) + external benchmarks (O7).

---

## 11. EXPERIMENT 1 — Single-Stock Range Forecasting

**Objective:** stress-test the FULL §1C pipeline, learn which components carry weight,
refine a few times, then change datasets.

**Target metric — interval coverage at useful width (NOT point/direction):**
- WIN = actual price falls INSIDE the predicted range.
  - e.g. predict $4–5, actual $4.25 → WIN. Predict $20, actual $4.25 → LOSS.
- **Success condition:** ≥70% coverage, OUT-OF-SAMPLE, at avg band half-width ≤ ~12% of
  price (tighten the % as we refine).
- **"Refinement" = shrink band width while HOLDING ≥70% coverage.** Clean single objective.

**⚠️ The core trap:** coverage alone is trivial (predict $0–1000 → 100% coverage, useless).
ALWAYS track TWO numbers together: (1) coverage/hit-rate, (2) width/sharpness.

**Optimize the combined metric:** **interval score (Winkler) / pinball loss** — rewards
tight bands, penalizes misses, in ONE number → ranks every refinement honestly + tells us
which components (ablation) actually help.

**Horizons (report SEPARATELY — don't blend):**
- Next-day: ±12% likely hits >70% → game is to TIGHTEN (±3–5%?) holding 70%.
- Next-week: ±12% at ~70% realistic.
- Next-month: bigger swings; ±12% at 70% plausible but tighter to hold.

**Rigor rules (so 70% is real, not gamed):**
1. Coverage measured OUT-OF-SAMPLE (bands not calibrated on that data).
2. Width target FIXED up front (else model "wins" by widening).
3. Confirm on OTHER stocks/periods (one tuned stock = possible luck).

**Data:** start single stock. ⚠️ Use 5–10 yrs (2024 alone = ~252 daily / ~52 weekly /
~12 monthly pts — far too few for week/month). Forecast RETURNS not raw price (stationarity).

**Honesty check (the real value on near-random data):** a good framework produces WIDE
bands / low confidence where price is unpredictable, and its confidence is CALIBRATED. If it
gives confident-but-wrong narrow bands, it's fooling itself — and this experiment catches it.

**Build path:** Tier 0 (naive-baseline band + 1 model + rolling backtest) FIRST — establishes
"can anything beat naive at this width?" — then add tiers per §8.

---

## 10. One-Line Summary

A diverse, decorrelated model pool forecasts at multiple time scales; overlap detection
plus a Model Confidence Set picks the survivors; conformal bands quantify uncertainty;
and a held-out validation harness proves whether the agreement is real signal or shared
blind spot — *for this specific dataset.*

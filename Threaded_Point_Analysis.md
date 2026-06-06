# Threaded Point Analysis (TPA) — v2
### Threaded Deviation Paths for Forecast Refinement
*Draft concept spec — updated 2026-06-06*

---

## 0. One-line summary

Instead of forecasting from a stock's single current price, **explode that point into a fan of perturbed starting points expressed as % of price**, forecast from every one, and after the real value lands, record **which perturbation forecast best**. Tracked over time, the sequence of winners is a **threaded deviation path**; its statistics become a **modifier** that shifts future forecasts toward the offset that has historically been most accurate. When the real value escapes the whole fan (a **breach**), that itself is a signal — and it drives the fan to widen.

---

## 1. Intuition

Normal forecaster: `price_now → forecast` (one input, one output).

TPA: `{2m+1 candidate "price_now" values, each a % offset} → {forecasts} → keep the winner`, because the printed price is a fuzzy basis (bid/ask, stale ticks, microstructure) and a forecaster launched from a slightly-off basis is *systematically* off. TPA learns that bias and threads it through time. When even the best candidate can't reach reality, the move exceeded the fan — log it and adapt.

---

## 1.5 Pipeline position — TPA runs *after* the base algorithm

TPA is a **refinement layer, not a forecaster.** It runs at the **end** of the existing algorithm's pass: the base algorithm produces its predictions → those collapse into **refined cluster ranges** → **TPA fans and threads from those clusters, not from the raw price.** So the basis `P_t` in §2 is really *"the base algorithm's refined cluster center,"* and the fan perturbs *that*. The point is to squeeze the last bit of accuracy out of predictions the base model already made — and to measure whether those refined ranges are actually as accurate as they claim.

### The three-cluster basis & overlap analysis

The base algorithm emits **3 refined clusters.** TPA establishes the fan **range from the span of all three** (the fan covers the full refined region), and runs a per-cluster layer on top:

- **Cluster accuracy race** — score each of the 3 clusters against the realized value every cycle → learn *which cluster is most accurate*, and whether that leadership is **stable or rotates by regime**.
- **Range decomposition** — decompose each cluster's predicted range separately, then **map the overlap** between the three ranges.
- **Overlap insight (novel feature)** — where the three clusters *agree* (overlap) is a candidate **high-confidence zone**; where they *diverge* flags uncertainty. Track how the overlap pattern moves, tightens, and widens **by range and by vector** over time — the *behaviour of the overlap itself* may predict accuracy. Give it its own vector set.

---

## 2. Definitions & notation

| Symbol | Meaning |
|---|---|
| `P_t` | printed price at step `t` |
| `c` | **chunk size as a fraction of price** (granularity). e.g. `0.001` = 0.1% |
| `m` | **chunks per side** (range knob). Range = `±m·c`. e.g. `m=100, c=0.001` → ±10% |
| `k` | chunk index, `k ∈ {−m … 0 … +m}` → **`2m+1` points** |
| `S_{t,k}` | **fan point** (% of price): `S_{t,k} = P_t · (1 + k · c)` |
| `D_t` | **drive** — directional/velocity term in the forecast (EMA of returns, or model momentum) |
| `F_{t,k}` | forecast of `P_{t+1}` launched from `S_{t,k}` |
| `k*_t` | **winning chunk**: `argmin_k |F_{t,k} − P_{t+1}|` |
| `o*_t` | **winning offset (%)**: `o*_t = k*_t · c` (e.g. `+0.004` = +0.4%) |
| **thread** | time series `{o*_t}` = the **threaded deviation path** |
| **vector** | a traced statistic of the thread over a window |
| `τ` | **off-threshold** (% error that counts a forecast as "off"), e.g. 1% |

**All offsets, the modifier, and the thread are in % terms** — portable across price levels and stocks.

---

## 3. Building the fan (% chunks) + resolution

The fan is multiplicative around the price:

```
k:   -m        ...   -1      0      +1   ...        +m
S :  P(1-mc)   ...  P(1-c)   P      P(1+c)  ...     P(1+mc)
```

→ `m` points below + center + `m` points above = **`2m+1` points**, current value at center.

### Two independent knobs

| Knob | Controls | Effect |
|---|---|---|
| **`c` (chunk size)** | granularity / resolution | smaller `c` → finer winner, smoother modifier |
| **`m` (chunks/side)** | the **range** (`±m·c`) | larger range → catches bigger moves, fewer breaches |

| Config | Points | Range | Notes |
|---|---|---|---|
| `m=10, c=0.01` | 21 | ±10% | coarse (original) |
| **`m=100, c=0.001`** | **201** | **±10%** | **recommended default** — 10× finer, same reach |
| `m=200, c=0.001` | 401 | ±20% | wider reach for volatile names |

**Recommendation:** default **201 @ 0.001** (±10%, 0.1% steps). Set the **range** from recent volatility so it covers ~95% of next-step moves (see breach/adaptive, §6); set **granularity** to your price/tick precision. Optionally make `c` itself volatility-scaled (chunk = `c · V_t/V̄`) so the fan breathes with the regime.

> Resolution caveat: more candidates ⇒ the "there's always a winner" trap (A2) is stronger. Finer chunking **requires** the significance guard, not just nicer numbers.

---

## 4. The method (per step)

1. **Fan out** the `2m+1` points `S_{t,k}` from `P_t`.
2. **Forecast center first** → `F_{t,0}` (the baseline a normal model would print).
3. **Forecast the fan** → `F_{t,k}` for all `k`, same drive `D_t`.
4. **Wait for truth:** `P_{t+1}` prints.
5. **Cross-check:** `k*_t = argmin_k |F_{t,k} − P_{t+1}|` → closest deviation path.
6. **Record:** append `o*_t = k*_t·c` to the thread; log the **error edge** `|F_{t,0}−P_{t+1}| − |F_{t,k*}−P_{t+1}|` (how much the winner beat center); and run the **breach check** (§6).

`100 steps × 201 points = 20,100` data points per thread window; `100,000 × 201 = 20.1M`.

---

## 5. Traced vectors (each a time series)

| Vector | Definition | What it tells you |
|---|---|---|
| **Avg change** | mean of per-step price change | baseline drift of the series |
| **Mean change (range)** | mean of `F_{t,k}` across the whole fan, per step | the fan's collective forecast |
| **Mode** | most-frequent winning chunk `k*` | the habitual best offset |
| **Std** | std-dev of `{o*_t}` | thread concentration → is the modifier trustworthy or scattered? |
| **Drift score** | `mean(|o*_t|)` (magnitude) + `mean(o*_t)` (signed) | **how far, and which way, center is wrong on average** |
| **Breach rate** | fraction of steps where actual escaped the fan | regime-shift / range-too-narrow signal (§6) |
| **Overshoot** | `% by which actual exceeded the fan edge` on breaches | "x% above the normalized range" |
| **Off-count** | # of forecasts with `|F_{t,k}−P_{t+1}| > τ` | inverse view — how much of the fan missed (§6) |

The **modifier** `M_t` = windowed mean (or median) of `o*_t`. Headline example: `M = +0.456%`.

### Make many sets (combinations)

Compute these vectors under **multiple parameterizations** and keep them all as named sets, so we can compare combinations and find the winning recipe:

- **Recency-decay variants** — flat-mean vs **EMA-decayed** (recent cycles weighted more) for *every* vector (regimes drift, so the decayed set usually wins).
- **Effective-range variants** — define the effective range three ways and trace each as its own vector set: (a) realized window high/low, (b) realized next-step move, (c) a quantile band. The remapping math (§6) differs per definition; let the data pick.
- **Window variants** — short / medium / long lookback for each vector.

→ a library of vector *sets*; the validation step (§11) ranks which combination lifts accuracy.

### Exact-match confidence & vector tagging

- **Exact-match score weighting** — the range vector closest on the next pass earns a **confidence attribute** for that prediction; a near-exact match scores higher than a loose one.
- **Vector tagging** — tag individual offset vectors and **count how many times a given vector hits accuracy** (within `τ`). A vector that hits *X* times becomes a **reliable vector** — a tagged, trusted offset for that stock/regime.
- **Multi-vector reliability** — test whether **several vectors** can be driven to hit the accuracy bar *together* (a reliable *band*, not one point) — more robust than a single offset.
- **Surface it** — the confidence attribute goes in the final readout **and is highlighted in the 3D graphic** as confidence / variable-range indicators (see §8).

---

## 6. The inverse / breach view + adaptive range

The winner view asks *"which candidate was closest?"* — always answerable. The **inverse view** asks *"how many were badly off, and did reality escape the fan entirely?"* — and that's where the real regime signal lives.

**Per step:**
- **Off-count** = number of `k` with `|F_{t,k} − P_{t+1}| > τ`. If this = `2m+1` (all of them), the actual was unreachable by *any* candidate.
- **Breach** = `P_{t+1} ∉ [ min_k F_{t,k} , max_k F_{t,k} ]` (actual outside the forecast envelope).
- **Overshoot %** = how far beyond the nearest fan edge the actual landed, normalized to price → *"the change was x% above the normalized range."*

> Worked example (yours): center 1.00, 201 points (±100), center forecast 1.50, actual 1.75. Every candidate that forecast ≤ ~1.74 is "off" by > τ; the actual is **0.25 above** the center forecast and beyond the fan's top edge → **breach**, overshoot ≈ +`(1.75 − fan_top)/1.00`%. The *inverse* set (all the vectors that fell short) quantifies how far past the normalized range the move went.

**Adaptive range (the feedback loop):**
```
if breach_events in last W steps > E_max:
    widen the fan   (increase m, or scale c by volatility)
    refit the modifier on the wider fan
    compare accuracy before vs after  →  keep if it helps ("refactor")
```
So persistent breaches *expand the deviation range automatically*, and you measure whether the wider fan actually buys accuracy. Conversely, if breaches ≈ 0 and most candidates cluster near the winner, you can **narrow** the fan to sharpen resolution.

### Always a winner — by design, corrected by the next cycle

There is *always* a closest candidate, and **that's fine.** Its value isn't the single win — it's the **connection across cycles** (the thread). A fluke winner is self-correcting because cycle `t`'s winner (and any breach) feeds cycle `t+1`, where the **effective range** absorbs it:

- On a breach, **don't discard** the out-of-scope result — **remap it through the effective (realized) range**: rescale the overshoot onto `[actual_low … actual_high]` so the next cycle's fan is re-centered/-scaled on what reality actually did, not on the stale fan. The breach becomes the next cycle's basis correction.
- Because the winner is accounted for *in the next cycle*, genuine signal shows up as **thread autocorrelation** — winners that *connect* cycle-to-cycle. That connection (not any one win) is the real test that the modifier is signal, not luck.

---

## 7. The output (results-page modifier)

```
Forecast (center):     142.30
Threaded modifier M:   +0.456%  (mean)  ·  +0.40% (median)
Drift score:           0.61% magnitude,  +0.456% signed (upward bias)
Refined forecast:      142.30 · (1 + M)  = 142.95
Threaded range:        [-10% … +10%] envelope  ·  201 points
Breach rate (100):     4%   (range adequate)
Overshoot (max):       +2.3% above normalized range
Off-count (avg):       38 / 201
```

---

## 8. 3D thread visualization

A 3D line graphic of **every** candidate path threading through time, with the winner and breaches surfaced.

| Axis | Maps to |
|---|---|
| **X** | time (the 100 → 100k steps) |
| **Y** | deviation offset `k·c` (% from center), `−m·c … +m·c` |
| **Z** | forecast value `F_{t,k}` (or, toggle: signed error `F − actual`) |

- **One line per candidate `k`** → `2m+1` semi-transparent threads forming a ribbon/tube that weaves over time.
- **Winning thread** `k*_t` drawn bold/bright — this is the *threaded change path* snaking through the band.
- **Actual price** overlaid as a solid contrasting line on the `Z` surface.
- **Breaches** marked where the actual line punches outside the ribbon (red nodes) — visually obvious regime escapes.
- **Color** = error magnitude (green near-zero → red large) so accurate regions glow and misses flare.
- **Confidence indicators** — tagged **reliable vectors** glow/thicken; each prediction's confidence attribute drives the brightness of its winner node, so high-confidence stretches of the threaded path stand out and the variable-range confidence band is readable at a glance. The three-cluster **overlap zones** can be drawn as a translucent volume.
- Interactions: rotate/zoom, scrub time, isolate the winner thread, heat-map the breach zones.

**Implementation:** Plotly `Scatter3d`/`Surface` for a quick interactive HTML; **three.js** (instanced line segments) if you want 20k+ threads at 100k steps to stay smooth. Down-sample threads for the full 20.1M view (render the winner + envelope + breaches; lazy-load the full fan on zoom).

---

## 9. Refinements & open questions (still to close)

- **A2 — "always a winner" is intended, not a bug.** There's always a closest candidate; the signal lives in the **connection across cycles** (§6), not any single win. The guard is therefore **thread autocorrelation + a positive, significant error edge** — if winners don't connect cycle-to-cycle the thread is noise. Flukes are absorbed by next-cycle effective-range remapping.
- **A3 — look-ahead.** `k*` is chosen after seeing truth — fine for *learning* `M`, but apply it **out-of-sample** (train → forward-test) and prove it still lifts accuracy.
- **A4 — define the base forecaster + drive.** TPA wraps some `F(start, drive)` (random walk + drift, AR, or a model). Gains stack on the base.
- **A5 — regime / "vector" dependence.** Best offset is probably **not** one global number — condition `M` (and the range) on regime (trend/chop, vol bucket, time-of-day).
- **A6 — persistence.** Modifier only works if `o*_t` is autocorrelated. Measure it; if ~0, the thread can't be projected.
- **A7 — tie-breaks + interpolation.** Define a tie rule; interpolate the true optimum between chunks for sub-`c` precision.
- **A8 — costs.** Accuracy gains must clear spread + fees at the forecast horizon.

---

## 10. Minimal build plan

```
fan(P, m, c)            -> [P*(1+k*c) for k in -m..+m]
forecast(S, drive)      -> F                              # A4
step(P_t, P_next, m, c, drive, τ):
    fcst   = [forecast(S, drive) for S in fan(P_t,m,c)]
    kstar  = argmin(|f-P_next| for f in fcst)
    edge   = |fcst[center]-P_next| - |fcst[kstar]-P_next|
    breach = not (min(fcst) <= P_next <= max(fcst))
    off    = count(|f-P_next| > τ*P_t for f in fcst)
    return o*=kstar*c, edge, breach, off, overshoot

run N steps -> thread, edges, breaches, offs
vectors = {avg, mean_range, mode, std, drift_score, breach_rate, overshoot, off_count}
modifier = windowed_mean(thread) if significance_test(edges) else None   # A2/A3
adapt_range(breaches, W, E_max)                                          # §6
```

Backtest: **train window** learns `M` and the range; **forward window** applies them and reports realized accuracy lift vs the raw center forecast, after costs. Ship the modifier only if the forward lift is positive.

---

## 11. Working set & validation against the 2025 datasets

Threading the fan over the cycle window — from the base algorithm's **refined cluster ranges**, not raw price — yields the analysis working set: on the order of **~21,000–22,000 threads** (≈ 201 fan points × ~105 cycles) to run the original vector analysis against. That's enough resolution to see whether the refined ranges are *highly accurate* and exactly where they break.

**Validation plan — run TPA over the existing 2025 datasets already processed by the base algorithm.** For each dataset:

1. Rebuild the refined cluster ranges from the base predictions.
2. Fan + thread; learn the modifier `M` and range on a **train split**.
3. Apply forward on the held-out split.
4. Report, per regime:
   - realized **accuracy lift vs the raw base prediction** (after costs) — the whole game;
   - **thread autocorrelation** — is the connection real?
   - **breach rate** + whether **effective-range remapping** recovered the breaches;
   - the threaded **vectors** (drift score, mode, std, overshoot, off-count).

If the modifier lifts accuracy out-of-sample on 2025 data, it's real. If not, the thread is noise → widen/refactor the range (§6) or stop. **The 2025 runs are the ground truth for this whole idea** — everything else is hypothesis until it clears them.

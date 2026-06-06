"""10K-run study: forecast every stock at 7/30/90-day horizons across all origins,
record error + candidate features, and find which features PREDICT error.
Features that predict |error| -> band-width vectors. Features that predict signed
error -> bias-correction vectors. Output = 10 data-derived improvements.
"""
import json
import numpy as np
import data

HORIZONS = [7, 30, 90]
MINH = 60

records = []  # each: dict of features + errors


def feats(p, t):
    """Candidate feature vectors computed from prices[:t] (no lookahead)."""
    lr = np.diff(np.log(p[:t]))
    last = p[t - 1]
    f = {}
    f["vol5"] = float(np.std(lr[-5:])) if len(lr) >= 5 else 0.0
    f["vol20"] = float(np.std(lr[-20:])) if len(lr) >= 20 else 0.0
    f["vol60"] = float(np.std(lr[-60:])) if len(lr) >= 60 else f["vol20"]
    f["vol_ratio"] = f["vol5"] / (f["vol20"] + 1e-9)
    f["vol_accel"] = f["vol20"] - (float(np.std(lr[-40:-20])) if len(lr) >= 40 else f["vol20"])
    f["mom3"] = float(np.mean(lr[-3:])) if len(lr) >= 3 else 0.0
    f["mom10"] = float(np.mean(lr[-10:])) if len(lr) >= 10 else 0.0
    f["abs_last"] = abs(float(lr[-1])) if len(lr) else 0.0
    ma20 = float(np.mean(p[t - 20:t])) if t >= 20 else last
    ma50 = float(np.mean(p[t - 50:t])) if t >= 50 else last
    f["dist_ma20"] = (last - ma20) / ma20
    f["dist_ma50"] = (last - ma50) / ma50
    w = p[t - 20:t] if t >= 20 else p[:t]
    f["trend"] = float(np.polyfit(np.arange(len(w)), w, 1)[0]) / last
    f["range5"] = (float(np.max(p[t - 5:t])) - float(np.min(p[t - 5:t]))) / last if t >= 5 else 0.0
    return f


def point_forecast(p, t, h):
    """Simple damped-drift anchor (the thing whose error we study)."""
    lr = np.diff(np.log(p[:t]))
    drift = float(np.clip(np.mean(lr[-20:]) if len(lr) >= 20 else 0.0, -0.01, 0.01))
    return p[t - 1] * np.exp(drift * h * 0.5)


for tk in data.TICKERS:
    d = data.fetch(tk)
    p = np.array([r["close"] for r in d["rows"]], float)
    n = len(p)
    for h in HORIZONS:
        for t in range(MINH, n - h):
            pred = point_forecast(p, t, h)
            actual = p[t + h - 1]
            err = (actual - pred) / pred
            rec = feats(p, t)
            rec.update({"stock": tk, "h": h, "err": err, "abserr": abs(err)})
            records.append(rec)

print(f"TOTAL FORECAST RUNS: {len(records)}")

FCOLS = ["vol5", "vol20", "vol60", "vol_ratio", "vol_accel", "mom3", "mom10",
         "abs_last", "dist_ma20", "dist_ma50", "trend", "range5"]

for h in HORIZONS:
    sub = [r for r in records if r["h"] == h]
    abserr = np.array([r["abserr"] for r in sub])
    err = np.array([r["err"] for r in sub])
    print(f"\n=== HORIZON {h}d  (n={len(sub)})  mean|err|={abserr.mean()*100:.2f}%  bias={err.mean()*100:+.2f}% ===")
    rows = []
    for c in FCOLS:
        x = np.array([r[c] for r in sub])
        ca = float(np.corrcoef(x, abserr)[0, 1]) if x.std() > 0 else 0.0
        cs = float(np.corrcoef(x, err)[0, 1]) if x.std() > 0 else 0.0
        rows.append((c, ca, cs))
    rows.sort(key=lambda z: -abs(z[1]))
    print("  feature        corr|err|   corr(signed)")
    for c, ca, cs in rows:
        print(f"  {c:12} {ca:+.3f}      {cs:+.3f}")

# Does scaling the band by vol20 beat a constant band? (coverage stability test)
print("\n=== BAND TEST: constant vs vol-scaled (target 70%) ===")
for h in HORIZONS:
    sub = [r for r in records if r["h"] == h]
    err = np.array([r["err"] for r in sub])
    vol = np.array([r["vol20"] for r in sub]) * np.sqrt(h)
    q = np.quantile(np.abs(err), 0.70)                      # constant half-width
    cov_const = float(np.mean(np.abs(err) <= q))
    # vol-scaled: width proportional to vol, calibrated so median matches
    k = q / (np.median(vol) + 1e-9)
    cov_vol = float(np.mean(np.abs(err) <= k * vol))
    wstd_const = 0.0
    wstd_vol = float(np.std(k * vol) / (np.mean(k * vol) + 1e-9))
    print(f"  h={h}d  const cov={cov_const*100:.1f}%  vol-scaled cov={cov_vol*100:.1f}%  "
          f"(vol band adapts, width CV={wstd_vol:.2f})")

with open("study_records.json", "w") as f:
    json.dump({"n": len(records)}, f)

"""1000-stock sweep: forecast every 2025 trading day per stock (fast multi-model engine),
score accuracy (coverage) + drift. Saves incrementally so partial progress survives."""
import json
import os
import numpy as np
import data
from engine_vectors import MODELS

UNIV = json.load(open(os.path.join(os.path.dirname(__file__), "universe.json")))
OUT = os.path.join(os.path.dirname(__file__), "sweep_results.json")
TARGET = 0.70


def fast_forecast_2025(rows, min_hist=60, recent=120, win=100):
    dates = [r["date"] for r in rows]
    p = np.array([r["close"] for r in rows], float)
    n = len(p)
    if n < min_hist + 20:
        return None
    lr = np.diff(np.log(p), prepend=np.log(p[0]))
    ens = np.full(n, np.nan)
    fns = list(MODELS.values())
    for i in range(min_hist, n):
        w = p[max(0, i - win):i]
        ens[i] = float(np.mean([fn(w) for fn in fns]))
    rel = (p - ens) / ens
    alpha, a0 = 1 - TARGET, 1 - TARGET
    series = []
    for i in range(min_hist, n):
        if dates[i][:4] != "2025":
            continue
        cal = rel[max(min_hist, i - recent):i]
        cal = cal[~np.isnan(cal)]
        if len(cal) < 20:
            continue
        bias = float(np.mean(cal))
        pred = float(ens[i]) * (1 + bias)
        c = cal - bias
        vs = float(np.std(lr[max(0, i - 20):i]) / (np.median(np.abs(c)) + 1e-9)) if len(c) else 1.0
        vs = min(max(vs, 0.7), 1.6)
        qlo = float(np.quantile(c, alpha / 2)) * vs
        qhi = float(np.quantile(c, 1 - alpha / 2)) * vs
        lo, hi = pred * (1 + qlo), pred * (1 + qhi)
        actual = float(p[i])
        hit = bool(lo <= actual <= hi)
        series.append({"date": dates[i], "hit": hit,
                       "serr": (actual - pred) / pred, "width": (hi - lo) / pred})
        alpha = min(0.6, max(0.005, alpha + 0.05 * (a0 - (0 if hit else 1))))
    if len(series) < 80:
        return None
    hits = np.mean([s["hit"] for s in series])
    p2025 = [p[i] for i in range(n) if dates[i][:4] == "2025"]
    drift = (p2025[-1] - p2025[0]) / p2025[0] if len(p2025) > 1 else 0.0
    return {"coverage": round(float(hits) * 100, 1),
            "avg_width_pct": round(float(np.mean([s["width"] for s in series])) * 100, 2),
            "mae_pct": round(float(np.mean([abs(s["serr"]) for s in series])) * 100, 2),
            "bias_pct": round(float(np.mean([s["serr"] for s in series])) * 100, 2),
            "price_drift_pct": round(float(drift) * 100, 1),
            "n_2025": len(series)}


results = {}
done = 0
for tk in UNIV:
    try:
        d = data.fetch(tk)
        r = fast_forecast_2025(d["rows"])
        if r:
            results[tk] = r
    except Exception:  # noqa
        pass
    done += 1
    if done % 25 == 0:
        json.dump(results, open(OUT, "w"))
        print(f"{done}/{len(UNIV)} processed, {len(results)} valid", flush=True)

json.dump(results, open(OUT, "w"))
print(f"DONE: {done} processed, {len(results)} valid -> {OUT}", flush=True)

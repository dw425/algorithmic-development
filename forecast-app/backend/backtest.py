"""Multi-horizon backtest: anchor at a chosen origin date, forecast the close 1/7/30/90 trading
days ahead (leakage-free — only pre-origin data used to calibrate), then compare to the actual.
Same drift-extrapolation + vol-scaled conformal band as the multi-horizon engine (C9)."""
import numpy as np


def _origin_index(dates, origin_date):
    if origin_date in dates:
        return dates.index(origin_date)
    cand = [i for i, d in enumerate(dates) if d <= origin_date]   # nearest trading day on/before
    return cand[-1] if cand else None


def predict_from(rows, origin_date, horizons=(1, 7, 30, 90), target=0.70, cal=180, min_hist=40):
    dates = [r["date"] for r in rows]
    p = np.array([r["close"] for r in rows], float)
    n = len(p)
    lr = np.diff(np.log(np.maximum(p, 1e-9)), prepend=0.0)
    i0 = _origin_index(dates, origin_date)
    if i0 is None or i0 < min_hist:
        return None
    vol = np.array([np.std(lr[max(1, i - 20):i]) if i > 2 else 0.0 for i in range(n)])
    a0 = 1 - target
    out = []
    for h in horizons:
        tgt = i0 + h
        drift = float(np.clip(np.mean(lr[max(1, i0 - 20):i0 + 1]), -0.01, 0.01))
        pred = float(p[i0] * np.exp(drift * h * 0.5))
        scale = max(float(vol[i0]) * np.sqrt(h), 1e-4)
        # leakage-free calibration: residuals of the SAME method on pre-origin windows
        sres = []
        for j in range(max(min_hist, i0 - cal), i0 - h):
            dj = float(np.clip(np.mean(lr[max(1, j - 20):j + 1]), -0.01, 0.01))
            ptj = p[j] * np.exp(dj * h * 0.5)
            sj = max(float(vol[j]) * np.sqrt(h), 1e-4)
            sres.append((p[j + h] - ptj) / (ptj * sj))
        sres = np.array([x for x in sres if np.isfinite(x)])
        if len(sres) >= 20:
            q1, q2 = float(np.quantile(sres, a0 / 2)), float(np.quantile(sres, 1 - a0 / 2))
            lo, hi = pred + q1 * pred * scale, pred + q2 * pred * scale
        else:
            lo, hi = pred * 0.95, pred * 1.05
        rec = {"h": h, "origin_date": dates[i0], "pred": round(pred, 2),
               "lo": round(lo, 2), "hi": round(hi, 2), "naive": round(float(p[i0]), 2)}
        if tgt < n:
            actual = float(p[tgt])
            err = (pred - actual) / actual * 100
            nerr = (p[i0] - actual) / actual * 100
            rec.update({"target_date": dates[tgt], "actual": round(actual, 2),
                        "error_pct": round(err, 2), "abs_error_pct": round(abs(err), 2),
                        "accuracy_pct": round(max(0.0, 100 - abs(err)), 2),
                        "naive_abs_err": round(abs(nerr), 2),
                        "beats_naive": bool(abs(err) < abs(nerr)),
                        "hit": bool(lo <= actual <= hi), "available": True})
        else:
            rec.update({"target_date": None, "actual": None, "available": False})
        out.append(rec)
    return {"origin": dates[i0], "horizons": out}

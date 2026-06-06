"""Forecasting engine: diverse model ensemble + split-conformal prediction RANGES.

Pipeline (the functional core of algo_testing.md, Tiers 0-1 + conformal intervals):
  - 7 diverse base models produce 1-step-ahead point forecasts.
  - Performance-weighted ensemble (weights LEARNED on 2024 inverse-error).
  - Split-conformal intervals calibrated to a target coverage (default 70%).
  - Walk-forward evaluation over the first 90 days of 2025 (out-of-sample).
  - Reports coverage (hit-rate) AND width (sharpness) — never one without the other.
"""
import numpy as np

MODELS = ["naive", "drift", "ewma", "linear", "ar1", "momentum", "meanrev"]


def _ewma(prices, alpha=0.3):
    s = prices[0]
    for p in prices[1:]:
        s = alpha * p + (1 - alpha) * s
    return s


def model_preds(prices):
    """1-step-ahead point forecast of the next close, per model. Uses prices[:t]."""
    p = np.asarray(prices, float)
    last = p[-1]
    out = {}
    out["naive"] = last
    out["drift"] = last + (p[-1] - p[0]) / (len(p) - 1) if len(p) > 1 else last
    out["ewma"] = _ewma(p)

    w = p[-20:] if len(p) >= 20 else p
    x = np.arange(len(w))
    a, b = np.polyfit(x, w, 1)
    out["linear"] = a * len(w) + b

    r = np.diff(np.log(p))
    if len(r) >= 3 and np.std(r[:-1]) > 0 and np.std(r[1:]) > 0:
        phi = np.corrcoef(r[:-1], r[1:])[0, 1]
        mu = float(np.mean(r))
        out["ar1"] = last * np.exp(mu + phi * (r[-1] - mu))
    else:
        out["ar1"] = last

    rr = r[-10:] if len(r) >= 10 else r
    out["momentum"] = last * np.exp(float(np.mean(rr))) if len(rr) > 0 else last

    ma = float(np.mean(p[-20:])) if len(p) >= 20 else float(np.mean(p))
    out["meanrev"] = last + 0.2 * (ma - last)
    return out


def run_walkforward(rows, target=0.70, min_hist=40,
                    eval_start="2025-01-01", eval_end="2025-04-01"):
    dates = [r["date"] for r in rows]
    prices = np.array([r["close"] for r in rows], float)
    n = len(prices)
    idxs = list(range(min_hist, n))

    # 1) per-model 1-step forecasts for every index (pred at i uses prices[:i])
    per_model = {m: np.full(n, np.nan) for m in MODELS}
    for i in idxs:
        mp = model_preds(prices[:i])
        for m in MODELS:
            per_model[m][i] = mp[m]

    # 2) LEARN ensemble weights on 2024 (inverse relative-MAE)
    cal_mask = np.array([(dates[i] < "2025-01-01" and i >= min_hist) for i in range(n)])
    maes = {}
    for m in MODELS:
        err = np.abs((per_model[m][cal_mask] - prices[cal_mask]) / prices[cal_mask])
        maes[m] = float(np.nanmean(err)) if np.any(cal_mask) else 1.0

    # Model Confidence Set (royal rumble): keep only models tied for best on OOS loss
    from engine_vectors import model_confidence_set
    rel_err = {m: (per_model[m][cal_mask] - prices[cal_mask]) / prices[cal_mask] for m in MODELS}
    loss_by_model = {m: np.abs(rel_err[m]) for m in MODELS}
    survivors = model_confidence_set(loss_by_model, margin=1.5)

    # #3 Error-covariance-optimal combination (Bates-Granger) + shrinkage to equal weights
    weights = {m: 0.0 for m in MODELS}
    if len(survivors) == 1:
        weights[survivors[0]] = 1.0
    else:
        E = np.column_stack([rel_err[m] for m in survivors])
        Sigma = np.cov(E.T) + 1e-6 * np.eye(len(survivors))
        ones = np.ones(len(survivors))
        w_opt = np.clip(np.linalg.pinv(Sigma) @ ones, 0, None)
        w_opt = w_opt / (w_opt.sum() or 1.0)
        w_eq = ones / len(survivors)
        w_final = 0.5 * w_eq + 0.5 * w_opt              # shrink (combination-puzzle guard)
        for m, wv in zip(survivors, w_final):
            weights[m] = float(wv)

    # ensemble point forecast + relative residuals (for conformal)
    ens = np.full(n, np.nan)
    for i in idxs:
        ens[i] = sum(weights[m] * per_model[m][i] for m in MODELS)
    rel = (prices - ens) / ens

    # 3) walk-forward eval over first 90 days of 2025, expanding-window conformal
    lo_q, hi_q = (1 - target) / 2, 1 - (1 - target) / 2
    out_rows, widths, hits = [], [], 0
    for i in idxs:
        if not (eval_start <= dates[i] < eval_end):
            continue
        cal = rel[min_hist:i]
        cal = cal[~np.isnan(cal)]
        if len(cal) < 20:
            continue
        qlo, qhi = np.quantile(cal, lo_q), np.quantile(cal, hi_q)
        pred = float(ens[i])
        lo, hi = pred * (1 + qlo), pred * (1 + qhi)
        actual = float(prices[i])
        hit = bool(lo <= actual <= hi)
        width = (hi - lo) / pred
        hits += int(hit)
        widths.append(width)
        out_rows.append({
            "date": dates[i], "pred": round(pred, 2),
            "lo": round(float(lo), 2), "hi": round(float(hi), 2),
            "actual": round(actual, 2), "hit": hit,
            "width_pct": round(float(width) * 100, 2),
        })

    cov = hits / len(out_rows) if out_rows else 0.0
    avgw = float(np.mean(widths)) * 100 if widths else 0.0
    return {
        "n_eval": len(out_rows),
        "coverage": round(cov * 100, 1),
        "target": int(target * 100),
        "avg_width_pct": round(avgw, 2),
        "weights": {m: round(weights[m], 3) for m in MODELS},
        "cal_mae_pct": {m: round(maes[m] * 100, 2) for m in MODELS},
        "rows": out_rows,
    }

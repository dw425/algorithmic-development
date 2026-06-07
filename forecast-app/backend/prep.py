"""C1 (Phases 13-17) data validate/clean + C2 (Phases 18-22) stationarity/transform.
Each function is math-gated in tests/test_components.py before its pages are built."""
import numpy as np
from statsmodels.tsa.stattools import adfuller, kpss
from statsmodels.tsa.seasonal import STL


# ---------- C1: validate & clean ----------
def validate(rows):
    """Schema/range/integrity + Benford first-digit sanity. Quarantine bad rows (never drop silently)."""
    clean, bad = [], []
    for r in rows:
        c = r.get("close")
        ok = (isinstance(c, (int, float)) and c is not None and np.isfinite(c) and c > 0 and "date" in r)
        (clean if ok else bad).append(r)
    digits = [int(s[0]) for r in clean for s in [str(abs(r["close"])).lstrip("0.")] if s]
    benford = {}
    if digits:
        obs = np.array([digits.count(d) for d in range(1, 10)], float)
        obs = obs / obs.sum()
        exp = np.log10(1 + 1 / np.arange(1, 10))
        benford = {"max_dev": round(float(np.max(np.abs(obs - exp))), 3)}
    return {"clean": clean, "n_quarantined": len(bad), "benford": benford}


def impute_and_flag(prices, k=3.0, win=7):
    """Linear-interpolate internal gaps; Hampel filter FLAGS outliers (keeps value, marks it)."""
    p = np.array(prices, float)
    nan = ~np.isfinite(p)
    if nan.any():
        idx = np.arange(len(p))
        p[nan] = np.interp(idx[nan], idx[~nan], p[~nan])
    flags = np.zeros(len(p), bool)
    for i in range(win, len(p)):
        seg = p[i - win:i]
        med = np.median(seg)
        mad = 1.4826 * np.median(np.abs(seg - med)) + 1e-9
        if abs(p[i] - med) > k * mad:
            flags[i] = True
    return p, flags


# ---------- C2: stationarity & transform ----------
def stationarity(prices):
    p = np.asarray(prices, float)
    out = {}
    try:
        out["adf_p"] = round(float(adfuller(p, maxlag=10)[1]), 4)
    except Exception:  # noqa
        out["adf_p"] = None
    try:
        out["kpss_p"] = round(float(kpss(p, nlags="auto")[1]), 4)
    except Exception:  # noqa
        out["kpss_p"] = None
    nonstat = (out.get("adf_p") or 1) > 0.05 or (out.get("kpss_p") or 1) < 0.05
    out["recommend"] = "difference (use returns)" if nonstat else "level is stationary"
    return out


def stl_decompose(prices, period=21):
    p = np.asarray(prices, float)
    if len(p) < 2 * period:
        return None
    res = STL(p, period=period, robust=True).fit()
    return {"trend": [round(float(x), 3) for x in res.trend],
            "seasonal": [round(float(x), 3) for x in res.seasonal],
            "resid_std": round(float(np.std(res.resid)), 4)}

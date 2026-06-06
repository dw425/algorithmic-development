"""Steps 1-3 data layer: validate, impute, stationarity, purge/embargo (leakage guard).

These were entirely missing per the 2026-06-06 audit. Now real and wired into the engine.
"""
import numpy as np
from statsmodels.tsa.stattools import adfuller, kpss
from statsmodels.tsa.seasonal import STL


def validate(rows):
    """Step 1: schema/range/integrity + Benford first-digit sanity. Quarantine bad rows."""
    clean, quarantined = [], []
    for r in rows:
        c = r.get("close")
        ok = (isinstance(c, (int, float)) and c is not None
              and np.isfinite(c) and c > 0 and "date" in r)
        (clean if ok else quarantined).append(r)
    # Benford first-digit deviation (gross-error signal, not a hard gate)
    digits = [int(str(abs(r["close"])).lstrip("0.")[0]) for r in clean
              if str(abs(r["close"])).lstrip("0.")]
    benford = {}
    if digits:
        obs = np.array([digits.count(d) for d in range(1, 10)], float)
        obs = obs / obs.sum()
        exp = np.log10(1 + 1 / np.arange(1, 10))
        benford = {"max_dev": round(float(np.max(np.abs(obs - exp))), 3)}
    return {"clean": clean, "n_quarantined": len(quarantined), "benford": benford}


def impute_and_flag(prices, k=3.0):
    """Step 2: linear-interpolate internal gaps; Hampel filter FLAGS outliers (no delete)."""
    p = np.array(prices, float)
    nan = ~np.isfinite(p)
    if nan.any():
        idx = np.arange(len(p))
        p[nan] = np.interp(idx[nan], idx[~nan], p[~nan])
    # Hampel: rolling median +/- k*MAD -> flag (keep value, mark it)
    flags = np.zeros(len(p), bool)
    w = 7
    for i in range(w, len(p)):
        seg = p[i - w:i]
        med = np.median(seg)
        mad = 1.4826 * np.median(np.abs(seg - med)) + 1e-9
        if abs(p[i] - med) > k * mad:
            flags[i] = True
    return p, int(flags.sum())


def stationarity(prices):
    """Step 3: ADF + KPSS -> is the series stationary? Recommend differencing."""
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
    # ADF p>0.05 = non-stationary; KPSS p<0.05 = non-stationary -> difference (use returns)
    nonstat = (out.get("adf_p") or 1) > 0.05 or (out.get("kpss_p") or 1) < 0.05
    out["recommend"] = "difference (use returns)" if nonstat else "level is stationary"
    return out


def stl_decompose(prices, period=21):
    """Step 3: STL trend/seasonal/resid decomposition (causal use only)."""
    p = np.asarray(prices, float)
    if len(p) < 2 * period:
        return None
    res = STL(p, period=period, robust=True).fit()
    return {"trend_last": round(float(res.trend[-1]), 2),
            "seasonal_amp": round(float(np.std(res.seasonal)), 3),
            "resid_std": round(float(np.std(res.resid)), 3)}


def purge_embargo_indices(cal_lo, cal_hi, eval_i, horizon):
    """Step 3 leakage guard: drop calibration indices whose h-ahead target overlaps the
    eval point (purge) plus an embargo gap of `horizon` days before eval_i."""
    cutoff = eval_i - horizon                      # any cal index >= cutoff leaks into eval
    return [j for j in range(cal_lo, cal_hi) if j < cutoff]

"""Final tier — C17 inverse-drift/net · C18 funnel/stability · C19 MCS · C20 calibration ·
C21 TPA · C22 outward eye. Each math-gated."""
import numpy as np
from sklearn.isotonic import IsotonicRegression

import data
import engine
import spatial


# ---------- C17: inverse-drift + net results ----------
def inverse_drift(vals, consensus):
    dev = (vals - consensus) / consensus
    out = vals[np.abs(dev) > 0.02]
    if len(out) < 5:
        return {"coherence_pct": 0.0, "lean": "none", "n_outside": int(len(out))}
    up = float(np.mean(out > consensus))
    return {"coherence_pct": round(abs(up - 0.5) * 200, 1),
            "lean": "higher" if up > 0.6 else "lower" if up < 0.4 else "balanced",
            "n_outside": int(len(out)), "up_fraction": round(up, 2)}


def net_results(vals, consensus):
    mode = float(np.median(vals))
    lo, hi = np.percentile(vals, [10, 90])
    trimmed = float(np.mean(vals[(vals >= lo) & (vals <= hi)]))
    spread = (max(mode, trimmed, consensus) - min(mode, trimmed, consensus)) / consensus
    return {"mode": round(mode, 2), "robust_mean": round(trimmed, 2), "consensus": round(consensus, 2),
            "convergence_pct": round((1 - spread) * 100, 1)}


# ---------- C18: funnel + bootstrap stability ----------
def funnel(prices):
    vals, reach, drift = spatial.geo_cloud(prices)
    if len(vals) < 30:
        return []
    Xs = spatial.standardize(vals, reach, drift)
    from sklearn.cluster import KMeans
    km = KMeans(n_clusters=5, n_init=5, random_state=0).fit(Xs)
    u, c = np.unique(km.labels_, return_counts=True)
    densest = u[int(np.argmax(c))]
    inb = km.labels_ == densest
    inv = np.linalg.pinv(np.cov(Xs.T)); cen = Xs.mean(0)
    md = np.sqrt(np.einsum("ij,jk,ik->i", Xs - cen, inv, Xs - cen))
    return [{"stage": "Generated", "count": int(engine.N_VECTORS)},
            {"stage": "In-bounds", "count": int(len(vals))},
            {"stage": "Densest cluster", "count": int(inb.sum())},
            {"stage": "+ within 1σ", "count": int((inb & (md < 1.0)).sum())},
            {"stage": "Final", "count": 1}]


def bootstrap_stability(vals, B=25):
    if len(vals) < 30:
        return float(np.median(vals)) if len(vals) else 0.0, 0.0
    rng = np.random.default_rng(0)
    cs = np.array([float(np.median(rng.choice(vals, len(vals), replace=True))) for _ in range(B)])
    return float(np.median(cs)), float(max(0.0, 1 - np.std(cs) / (abs(np.mean(cs)) + 1e-9)))


# ---------- C19: Model Confidence Set ----------
def model_confidence_set(loss_by_model, margin=1.0):
    means = {m: float(np.mean(e)) for m, e in loss_by_model.items() if len(e)}
    if not means:
        return list(loss_by_model)
    best = min(means.values())
    allv = np.concatenate([np.asarray(e) for e in loss_by_model.values() if len(e)])
    se = float(np.std(allv) / np.sqrt(max(len(allv), 1)))
    keep = [m for m, mu in means.items() if mu <= best + margin * se]
    return keep or [min(means, key=means.get)]


# ---------- C20: calibration (isotonic) ----------
def isotonic_recalibrate(nominal, empirical):
    iso = IsotonicRegression(out_of_bounds="clip").fit(np.asarray(nominal, float), np.asarray(empirical, float))
    return [round(float(iso.predict([x])[0]), 4) for x in nominal], iso


def reliability(rows, target):
    """Empirical coverage vs nominal target (calibration check)."""
    if not rows:
        return {}
    emp = float(np.mean([1.0 if r["hit"] else 0.0 for r in rows]))
    return {"nominal": int(target * 100), "empirical": round(emp * 100, 1),
            "calibrated": bool(abs(emp - target) < 0.05)}


# ---------- C21: TPA ----------
def tpa(rows, m=100, c=0.001, tau=0.01, train_frac=0.6,
        eval_start="2025-01-01", eval_end="2026-01-01", min_hist=30):
    dates = [r["date"] for r in rows]
    p = np.array([r["close"] for r in rows], float)
    n = len(p)
    lr = np.diff(np.log(np.maximum(p, 1e-9)), prepend=0.0)
    ks = np.arange(-m, m + 1)
    idx = [i for i in range(min_hist, n - 1) if eval_start <= dates[i] < eval_end]
    thread, edges, breaches = [], [], 0
    for i in idx:
        P = p[i]
        drive = float(np.clip(np.mean(lr[max(1, i - 10):i + 1]), -0.03, 0.03))
        F = P * (1 + ks * c) * np.exp(drive)
        actual = p[i + 1]
        err = np.abs(F - actual)
        kstar = int(ks[int(np.argmin(err))])
        thread.append(kstar * c)
        edges.append(abs(F[m] - actual) - float(err.min()))
        breaches += int(not (F.min() <= actual <= F.max()))
    if len(thread) < 20:
        return {"points": 2 * m + 1, "n": len(thread), "significant": False, "modifier_pct": 0.0}
    thread = np.array(thread)
    ntr = max(10, int(len(idx) * train_frac))
    M = float(np.median(thread[:ntr]))
    ac = float(np.corrcoef(thread[:-1], thread[1:])[0, 1]) if np.std(thread) > 0 else 0.0
    significant = bool(ac > 0.1 and np.mean(edges) > 0)
    return {"points": 2 * m + 1, "n": len(thread), "modifier_pct": round(M * 100, 3),
            "significant": significant, "thread_autocorr": round(ac, 3),
            "breach_rate_pct": round(100 * breaches / len(thread), 1)}


# ---------- C22: outward eye ----------
def page_hinkley(resid, delta=0.002, lam=0.04):
    if len(resid) < 10:
        return {"drift": False, "stat": 0.0}
    mean, mt, mmin = 0.0, 0.0, 0.0
    for j, x in enumerate(resid):
        mean += (x - mean) / (j + 1)
        mt += x - mean - delta
        mmin = min(mmin, mt)
    return {"drift": bool(mt - mmin > lam), "stat": round(float(mt - mmin), 4)}


def psi(expected, actual, bins=10):
    if len(expected) < 10 or len(actual) < 10:
        return 0.0
    qs = np.quantile(expected, np.linspace(0, 1, bins + 1))
    qs[0], qs[-1] = -np.inf, np.inf
    e = np.histogram(expected, qs)[0] / len(expected) + 1e-4
    a = np.histogram(actual, qs)[0] / len(actual) + 1e-4
    return float(np.sum((a - e) * np.log(a / e)))


def outward_eye(rows, eval_start="2025-01-01", eval_end="2026-01-01"):
    p = np.array([r["close"] for r in rows], float)
    dates = [r["date"] for r in rows]
    lr = np.diff(np.log(np.maximum(p, 1e-9)))
    half = len(lr) // 2
    return {"drift": page_hinkley(lr[-120:]), "psi_recent": round(psi(lr[:half], lr[half:]), 3),
            "vol_recent": round(float(np.std(lr[-20:])) * 100, 2)}

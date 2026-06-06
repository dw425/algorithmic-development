"""Threaded Point Analysis (TPA) — the post-base refinement layer (Threaded_Point_Analysis.md).

Explode the base forecast basis into a fan of 2m+1 % offsets, forecast from each, and after
truth lands record the winning offset. The thread of winners → a modifier M that shifts future
forecasts. Breach detection drives adaptive range. Train/forward split proves out-of-sample lift.
"""
import numpy as np
import data


def tpa_run(rows, m=100, c=0.001, tau=0.01, train_frac=0.6,
            eval_start="2025-01-01", eval_end="2026-01-01", min_hist=30):
    dates = [r["date"] for r in rows]
    p = np.array([r["close"] for r in rows], float)
    n = len(p)
    lr = np.diff(np.log(np.where(p > 0, p, 1e-9)), prepend=0.0)
    ks = np.arange(-m, m + 1)

    idxs = [i for i in range(min_hist, n - 1) if eval_start <= dates[i] < eval_end]
    thread, edges, breaches, offs, overshoots = [], [], [], [], []
    fan_forecasts, winners, actuals, centers, sdates = [], [], [], [], []
    for i in idxs:
        P = p[i]
        drive = float(np.clip(np.mean(lr[max(1, i - 10):i + 1]), -0.03, 0.03))   # D_t (EMA drive)
        S = P * (1 + ks * c)                          # fan points (% chunks)
        F = S * np.exp(drive)                         # forecast from each basis, same drive
        actual = p[i + 1]
        err = np.abs(F - actual)
        kstar = int(ks[int(np.argmin(err))])
        center_err = abs(F[m] - actual)
        edge = center_err - float(err.min())          # how much winner beat center
        breach = not (F.min() <= actual <= F.max())
        off = int(np.sum(err > tau * P))
        ov = 0.0
        if breach:
            ov = (actual - F.max()) / P if actual > F.max() else (F.min() - actual) / P
        thread.append(kstar * c); edges.append(edge); breaches.append(bool(breach))
        offs.append(off); overshoots.append(abs(ov))
        winners.append(kstar * c); actuals.append(float(actual))
        centers.append(float(F[m])); sdates.append(dates[i])
        fan_forecasts.append(F)

    if len(thread) < 20:
        return {"error": "not enough steps in window", "n": len(thread)}
    thread = np.array(thread); edges = np.array(edges)
    ntr = max(10, int(len(idxs) * train_frac))

    # modifier from TRAIN split (median offset)
    M = float(np.median(thread[:ntr]))
    # significance: thread autocorrelation + positive mean error edge (A2/A6)
    ac = float(np.corrcoef(thread[:-1], thread[1:])[0, 1]) if np.std(thread) > 0 else 0.0
    mean_edge = float(np.mean(edges))
    significant = bool(ac > 0.1 and mean_edge > 0)

    # FORWARD test: does applying M to the center cut error out-of-sample?
    cen = np.array(centers); act = np.array(actuals)
    be = np.abs(cen[ntr:] - act[ntr:])
    me = np.abs(cen[ntr:] * (1 + M) - act[ntr:])
    lift = float((be.mean() - me.mean()) / (be.mean() + 1e-12) * 100) if len(be) else 0.0

    # traced vectors (§5)
    vectors = {
        "modifier_pct": round(M * 100, 3),
        "modifier_mean_pct": round(float(np.mean(thread)) * 100, 3),
        "drift_magnitude_pct": round(float(np.mean(np.abs(thread))) * 100, 3),
        "drift_signed_pct": round(float(np.mean(thread)) * 100, 3),
        "mode_offset_pct": round(float(max(set(thread.round(4)), key=list(thread.round(4)).count)) * 100, 3),
        "std_pct": round(float(np.std(thread)) * 100, 3),
        "breach_rate_pct": round(100 * float(np.mean(breaches)), 1),
        "overshoot_max_pct": round(100 * float(np.max(overshoots)) if overshoots else 0.0, 2),
        "off_count_avg": round(float(np.mean(offs)), 0),
        "thread_autocorr": round(ac, 3),
        "error_edge_mean": round(mean_edge, 5),
    }

    # 3D thread data (down-sample fan to ~21 threads + winner + actual + breaches)
    step = max(1, (2 * m + 1) // 21)
    ksub = list(range(0, 2 * m + 1, step))
    threads3d = [{"k_pct": round(float(ks[kk] * c) * 100, 2),
                  "z": [round(float(fan_forecasts[t][kk]), 2) for t in range(len(idxs))]}
                 for kk in ksub]
    out3d = {"dates": sdates, "threads": threads3d,
             "winner_pct": [round(w * 100, 2) for w in winners],
             "actual": act.tolist(),
             "breach_idx": [j for j, b in enumerate(breaches) if b]}

    return {
        "m": m, "c": c, "points": 2 * m + 1, "range_pct": round(m * c * 100, 1),
        "n_steps": len(idxs), "train_steps": ntr, "forward_steps": len(idxs) - ntr,
        "modifier_pct": round(M * 100, 3),
        "significant": significant,
        "accuracy_lift_pct": round(lift, 2),
        "vectors": vectors,
        "viz3d": out3d,
    }


def tpa_for_ticker(ticker, **kw):
    return tpa_run(data.fetch(ticker)["rows"], **kw)

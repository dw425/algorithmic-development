"""Core engine — C3 multi-scale, C4 predictability, C5 base models. Each math-gated."""
import numpy as np
from scipy.spatial.distance import cdist


# ---------- C3: multi-scale aggregation ----------
def aggregate(prices, scale):
    """Block-mean aggregate to a coarser scale."""
    p = np.asarray(prices, float)
    n = len(p) // scale
    if n < 1:
        return p
    return p[-n * scale:].reshape(n, scale).mean(axis=1)


def scale_ladder(prices, scales=(1, 2, 5, 10, 21)):
    return {str(s): [round(float(x), 3) for x in aggregate(prices, s)] for s in scales}


# ---------- C4: predictability ----------
def hurst(prices):
    """DFA Hurst on log-returns. ~0.5 random walk, >0.5 trend, <0.5 mean-revert."""
    r = np.diff(np.log(np.maximum(prices, 1e-9)))
    N = len(r)
    if N < 32:
        return 0.5
    y = np.cumsum(r - r.mean())
    scales = [s for s in (8, 16, 32, 64, 128, 256) if s < N // 2]
    F = []
    for s in scales:
        nseg = N // s
        t = np.arange(s)
        rms = [np.sqrt(np.mean((y[i * s:(i + 1) * s] - np.polyval(np.polyfit(t, y[i * s:(i + 1) * s], 1), t)) ** 2))
               for i in range(nseg)]
        if rms and np.mean(rms) > 0:
            F.append((s, float(np.mean(rms))))
    if len(F) < 2:
        return 0.5
    return float(np.clip(np.polyfit(np.log([a for a, _ in F]), np.log([b for _, b in F]), 1)[0], 0, 1))


def lyapunov(prices, m=3, tau=1, max_t=8):
    """Largest Lyapunov exponent (Rosenstein) on log-returns. >0 = chaotic/sensitive."""
    x = np.diff(np.log(np.maximum(prices, 1e-9)))
    N = len(x)
    M = N - (m - 1) * tau
    if M < 40:
        return 0.0
    Y = np.array([x[i:i + m * tau:tau] for i in range(M)])
    D = cdist(Y, Y)
    np.fill_diagonal(D, np.inf)
    for i in range(M):
        D[i, max(0, i - tau):min(M, i + tau + 1)] = np.inf
    nn = np.argmin(D, axis=1)
    div = []
    for t in range(1, max_t + 1):
        ds = [np.log(np.linalg.norm(Y[i + t] - Y[nn[i] + t]) + 1e-12) for i in range(M - t) if nn[i] + t < M]
        if ds:
            div.append(np.mean(ds))
    if len(div) < 2:
        return 0.0
    return float(np.polyfit(range(len(div)), div, 1)[0])


def takens(prices, m=3, tau=2, n=400):
    """Takens delay embedding of log-returns → attractor points (downsampled)."""
    x = np.diff(np.log(np.maximum(prices, 1e-9)))
    pts = [[float(x[i]), float(x[i + tau]), float(x[i + 2 * tau])] for i in range(len(x) - 2 * tau)]
    step = max(1, len(pts) // n)
    return pts[::step]


def predictability(prices):
    h = hurst(prices)
    lam = lyapunov(prices)
    label = ("near random walk" if abs(h - 0.5) < 0.05
             else "persistent/trending" if h > 0.55 else "mean-reverting")
    return {"hurst": round(h, 3), "lyapunov": round(lam, 4), "label": label,
            "horizon_days": int(max(1, round(1.0 / max(abs(h - 0.5), 0.02))))}


# ---------- C5: base model pool ----------
def _ses(a, alpha=0.3):
    s = a[0]
    for x in a[1:]:
        s = alpha * x + (1 - alpha) * s
    return s


def _holt(a, alpha=0.3, beta=0.1):
    if len(a) < 2:
        return a[-1]
    lvl, tr = a[0], a[1] - a[0]
    for x in a[1:]:
        prev = lvl
        lvl = alpha * x + (1 - alpha) * (lvl + tr)
        tr = beta * (lvl - prev) + (1 - beta) * tr
    return lvl + tr


def _ar1(a):
    r = np.diff(np.log(np.maximum(a, 1e-9)))
    if len(r) >= 3 and np.std(r[:-1]) > 0 and np.std(r[1:]) > 0:
        phi = np.corrcoef(r[:-1], r[1:])[0, 1]
        mu = float(np.mean(r))
        return a[-1] * np.exp(mu + phi * (r[-1] - mu))
    return a[-1]


def _kalman(a, q=1e-3, r=1e-2):
    x, p = a[0], 1.0
    for z in a[1:]:
        p += q
        k = p / (p + r)
        x += k * (z - x)
        p *= (1 - k)
    return x


MODELS = {
    "naive": lambda a: a[-1],
    "drift": lambda a: a[-1] + (a[-1] - a[0]) / (len(a) - 1) if len(a) > 1 else a[-1],
    "ses": _ses,
    "holt": _holt,
    "linear": lambda a: float(np.polyval(np.polyfit(np.arange(len(a)), a, 1), len(a))),
    "ar1": _ar1,
    "momentum": lambda a: a[-1] * np.exp(float(np.mean(np.diff(np.log(np.maximum(a, 1e-9)))))) if len(a) > 1 else a[-1],
    "meanrev": lambda a: a[-1] + 0.3 * (float(np.mean(a)) - a[-1]),
    "theta": lambda a: 0.5 * (float(np.polyval(np.polyfit(np.arange(len(a)), a, 1), len(a))) + _ses(a)),
    "median": lambda a: 0.5 * a[-1] + 0.5 * float(np.median(a[-min(len(a), 5):])),
    "kalman": _kalman,
}


def model_forecasts(window):
    a = np.asarray(window, float)
    return {m: float(fn(a)) for m, fn in MODELS.items()}


def rho_matrix(prices, win=60):
    """Pairwise error-correlation of the models over a rolling window → mean rho + effective N."""
    p = np.asarray(prices, float)
    errs = {m: [] for m in MODELS}
    for i in range(win, len(p)):
        mp = model_forecasts(p[i - win:i])
        for m in MODELS:
            errs[m].append((mp[m] - p[i]) / p[i])
    E = np.array([errs[m] for m in MODELS])
    C = np.corrcoef(E)
    off = C[np.triu_indices(len(MODELS), k=1)]
    rho = float(np.nanmean(off))
    N = len(MODELS)
    return {"mean_rho": round(rho, 3), "effective_models": round(N / (1 + (N - 1) * max(rho, 0)), 2), "pool": N}


# ---------- C6: ensemble combination (error-cov + shrinkage) ----------
def ensemble_weights(error_matrix, shrink=0.5):
    """Bates-Granger inverse-error-covariance weights, shrunk to equal. Sum to 1."""
    E = np.asarray(error_matrix, float)              # (n_models, n_obs)
    k = E.shape[0]
    if k == 1:
        return np.array([1.0])
    Sigma = np.cov(E) + 1e-6 * np.eye(k)
    w = np.clip(np.linalg.pinv(Sigma) @ np.ones(k), 0, None)
    w = w / (w.sum() or 1.0)
    w = shrink * (np.ones(k) / k) + (1 - shrink) * w
    return w / w.sum()


# ---------- C7+C8: conformal+ACI bands with debiasing ----------
FAST = ["naive", "drift", "ses", "linear", "momentum", "meanrev", "kalman"]


def _aci(alpha, miss, a0, g=0.05):
    return float(min(0.6, max(0.005, alpha + g * (a0 - miss))))


def forecast_walkforward(rows, target=0.70, eval_start="2025-01-01", eval_end="2026-01-01",
                         min_hist=40, recent=120, win=60, debias=True):
    dates = [r["date"] for r in rows]
    p = np.array([r["close"] for r in rows], float)
    n = len(p)
    if n < min_hist + 5:
        return {"coverage": 0.0, "avg_width_pct": 0.0, "n_eval": 0, "target": int(target * 100), "rows": []}
    ens = np.full(n, np.nan)
    for i in range(min_hist, n):
        w = p[max(0, i - win):i]
        # Held-out finding: on daily data the ensemble point loses to naive (−30%). Anchor the
        # point on naive (last value); the ensemble only nudges it. Bands come from conformal.
        ens[i] = 0.8 * w[-1] + 0.2 * float(np.mean([MODELS[m](w) for m in FAST]))
    rel = (p - ens) / ens
    a0 = 1 - target
    alpha = a0
    out, hits = [], 0
    for i in range(min_hist, n):
        if not (eval_start <= dates[i] < eval_end):
            continue
        cal = rel[max(min_hist, i - recent):i]
        cal = cal[np.isfinite(cal)]
        if len(cal) < 20:
            continue
        bias = float(np.mean(cal)) if debias else 0.0   # C8 debias (toggleable)
        pred = float(ens[i]) * (1 + bias)
        c = cal - bias
        qlo, qhi = float(np.quantile(c, alpha / 2)), float(np.quantile(c, 1 - alpha / 2))
        lo, hi = pred * (1 + qlo), pred * (1 + qhi)
        actual = float(p[i])
        hit = bool(lo <= actual <= hi)
        hits += int(hit)
        out.append({"date": dates[i], "pred": round(pred, 2), "lo": round(lo, 2),
                    "hi": round(hi, 2), "actual": round(actual, 2), "hit": hit,
                    "width_pct": round((hi - lo) / pred * 100, 2)})
        alpha = _aci(alpha, 0 if hit else 1, a0)      # C7 ACI
    cov = hits / len(out) * 100 if out else 0.0
    return {"coverage": round(cov, 1),
            "avg_width_pct": round(float(np.mean([r["width_pct"] for r in out])), 2) if out else 0.0,
            "n_eval": len(out), "target": int(target * 100), "rows": out,
            "predictability": predictability(p[:max(min_hist, n - 250)]) if n > 80 else None}


# ---------- C9: multi-horizon (7/30/90) with purge/embargo ----------
def purge_embargo(cal_lo, cal_hi, eval_i, h):
    return [j for j in range(cal_lo, cal_hi) if j < eval_i - h]


def multi_horizon(rows, target=0.70, horizons=(7, 30, 90), min_hist=70, recent=150,
                  eval_start="2025-01-01", eval_end="2026-01-01"):
    dates = [r["date"] for r in rows]
    p = np.array([r["close"] for r in rows], float)
    n = len(p)
    lr = np.diff(np.log(np.maximum(p, 1e-9)), prepend=0.0)
    vol = np.array([np.std(lr[max(1, i - 20):i]) if i > 2 else 0 for i in range(n)])
    out = {}
    a0 = 1 - target
    for h in horizons:
        sres = np.full(n, np.nan)
        scale = np.maximum(vol * np.sqrt(h), 1e-4)
        for i in range(min_hist, n - h):
            drift = float(np.clip(np.mean(lr[max(1, i - 20):i]), -0.01, 0.01))
            pt = p[i - 1] * np.exp(drift * h * 0.5)
            sres[i] = (p[i + h - 1] - pt) / (pt * scale[i])
        hits, ws, tot = 0, [], 0
        for i in range(min_hist, n - h):
            if not (eval_start <= dates[i] < eval_end):
                continue
            keep = purge_embargo(max(min_hist, i - recent), i, i, h)
            cal = sres[keep]; cal = cal[np.isfinite(cal)]
            if len(cal) < 20:
                continue
            drift = float(np.clip(np.mean(lr[max(1, i - 20):i]), -0.01, 0.01))
            pt = p[i - 1] * np.exp(drift * h * 0.5)
            q1, q2 = np.quantile(cal, a0 / 2), np.quantile(cal, 1 - a0 / 2)
            lo, hi = pt + q1 * pt * scale[i], pt + q2 * pt * scale[i]
            a = float(p[i + h - 1])
            hits += int(lo <= a <= hi); ws.append((hi - lo) / pt); tot += 1
        if tot:
            out[f"{h}d"] = {"coverage": round(100 * hits / tot, 1),
                            "avg_width_pct": round(float(np.mean(ws)) * 100, 2), "n": tot}
    return out


# ---------- C10: vector grid (1,980) ----------
LOOKBACKS = [5, 8, 10, 12, 15, 20, 25, 30, 40, 50, 60, 80]
SCALES = [1, 2, 5, 10, 21]
POINTS = [0.5, 1.0, 1.5]
N_VECTORS = len(MODELS) * len(LOOKBACKS) * len(SCALES) * len(POINTS)


def build_cloud(prices):
    """1,980 next-step estimates: 11 models x 12 lookbacks x 5 scales x 3 points."""
    p = np.asarray(prices, float)
    last = p[-1]
    vals = []
    for S in SCALES:
        coarse = aggregate(p[-max(LOOKBACKS) * S:], S) if len(p) >= max(LOOKBACKS) * S else p
        for L in LOOKBACKS:
            c = coarse[-L:] if len(coarse) >= L else coarse
            if len(c) < 2 or c[-1] <= 0:
                continue
            for fn in MODELS.values():
                try:
                    f = float(fn(c))
                except Exception:  # noqa
                    f = c[-1]
                move = min(max((f / c[-1]) ** (1.0 / max(S, 1)), 0.9), 1.1) if f > 0 else 1.0
                for P in POINTS:
                    est = last * move ** P
                    if 0.5 * last < est < 2.0 * last:
                        vals.append(est)
    return np.array(vals)

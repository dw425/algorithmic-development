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

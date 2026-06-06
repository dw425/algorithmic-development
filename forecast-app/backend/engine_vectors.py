"""Multi-vector engine with REAL 3D geometry — the vector machine from algo_testing.md.

Per forecast day:
  1) Build a cloud of 1,800 next-day estimates: 10 models x 12 lookbacks x 5 scales x 3 points.
  2) Give each vector genuine 3D coordinates:
        x = temporal reach  (lookback x scale = days of history it used)  -> "position"
        y = predicted value (next-day price estimate)                     -> "value"
        z = implied drift   ((est-last)/last)                             -> "gravity/drift"
     ...standardized (z-score) so the axes are comparable (§6B fix).
  3) THREE real clustering algorithms (KMeans / DBSCAN / GaussianMixture) -> consensus
     clustering: a vector counts if it sits in the densest cluster of >=2 of the 3 methods.
  4) Mahalanobis center + concentration (covariance-aware, not raw Euclidean).
  5) Constellation: MST over cluster centroids (total path length) + Davies-Bouldin index.
  Forecast value = value-axis center of the consensus cluster. Range = conformal-calibrated.

Honest note (per §6I/§6J of the doc): the geometry CHARACTERIZES disagreement. The forecast
number is driven by the value (y) axis; x/z and the constellation are diagnostic structure.
"""
import warnings
import numpy as np
from sklearn.cluster import KMeans, DBSCAN

import data as _data
import prep

warnings.filterwarnings("ignore")

_MARKET_CACHE = {}


def _market_rows():
    if "SPY" not in _MARKET_CACHE:
        try:
            _MARKET_CACHE["SPY"] = _data.fetch("SPY")["rows"]
        except Exception:  # noqa
            _MARKET_CACHE["SPY"] = []
    return _MARKET_CACHE["SPY"]
from sklearn.mixture import GaussianMixture
from sklearn.metrics import davies_bouldin_score
from scipy.sparse.csgraph import minimum_spanning_tree
from scipy.spatial.distance import cdist


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

def _linear(a):
    x = np.arange(len(a))
    m, b = np.polyfit(x, a, 1)
    return m * len(a) + b

def _ar1(a):
    r = np.diff(np.log(a))
    if len(r) >= 3 and np.std(r[:-1]) > 0 and np.std(r[1:]) > 0:
        phi = np.corrcoef(r[:-1], r[1:])[0, 1]
        mu = float(np.mean(r))
        return a[-1] * np.exp(mu + phi * (r[-1] - mu))
    return a[-1]


def _kalman(a, q=1e-3, r=1e-2):
    """Local-level Kalman filter (continual state update) -> next-level forecast."""
    x, p = a[0], 1.0
    for z in a[1:]:
        p += q
        k = p / (p + r)
        x += k * (z - x)
        p *= (1 - k)
    return x

MODELS = {
    "naive":   lambda a: a[-1],
    "drift":   lambda a: a[-1] + (a[-1] - a[0]) / (len(a) - 1) if len(a) > 1 else a[-1],
    "ses":     _ses,
    "holt":    _holt,
    "linear":  _linear,
    "ar1":     _ar1,
    "momentum": lambda a: a[-1] * np.exp(float(np.mean(np.diff(np.log(a))))) if len(a) > 1 else a[-1],
    "meanrev": lambda a: a[-1] + 0.3 * (float(np.mean(a)) - a[-1]),
    "theta":   lambda a: 0.5 * (_linear(a) + _ses(a)),
    "median":  lambda a: 0.5 * a[-1] + 0.5 * float(np.median(a[-min(len(a), 5):])),
    "kalman":  _kalman,
}
LOOKBACKS = [5, 8, 10, 12, 15, 20, 25, 30, 40, 50, 60, 80]
SCALES = [1, 2, 5, 10, 21]
POINTS = [0.5, 1.0, 1.5]
N_VECTORS = len(MODELS) * len(LOOKBACKS) * len(SCALES) * len(POINTS)  # 1800


def build_cloud(prices):
    """Return (vals, reach, drift) arrays — y, x, z coordinates of the 1,800 vectors."""
    last = prices[-1]
    vals, reach, drift = [], [], []
    for S in SCALES:
        need = max(LOOKBACKS) * S
        seg = prices[-need:] if len(prices) >= need else prices
        nblk = len(seg) // S
        coarse_full = (seg[-nblk * S:].reshape(nblk, S).mean(axis=1)
                       if nblk >= 3 else seg.astype(float))
        for L in LOOKBACKS:
            c = coarse_full[-L:] if len(coarse_full) >= L else coarse_full
            if len(c) < 2 or c[-1] <= 0:
                continue
            for name, fn in MODELS.items():
                try:
                    f = float(fn(c))
                except Exception:  # noqa
                    f = c[-1]
                if f <= 0:
                    f = c[-1]
                move = min(max((f / c[-1]) ** (1.0 / max(S, 1)), 0.90), 1.10)
                for P in POINTS:
                    est = last * move ** P
                    if 0.5 * last < est < 2.0 * last:
                        vals.append(est)
                        reach.append(L * S)          # x: temporal reach (days)
                        drift.append((est - last) / last)  # z: implied drift
    return np.array(vals), np.array(reach, float), np.array(drift)


def geo_consensus(vals, reach, drift, last):
    """Real 3D embed -> 3 clusterings -> consensus + Mahalanobis + constellation."""
    n = len(vals)
    diag = {"n_vectors_used": int(n)}
    if n < 30:
        return float(np.median(vals)) if n else last, diag, []

    X = np.column_stack([reach, vals, drift])
    mu, sd = X.mean(axis=0), X.std(axis=0)
    sd[sd < 1e-9] = 1.0                      # floor zero-variance axes (no NaN/inf)
    Xs = (X - mu) / sd
    Xs = np.nan_to_num(Xs, nan=0.0, posinf=0.0, neginf=0.0)

    # --- 3 real clustering algorithms ---
    k = 5
    km = KMeans(n_clusters=k, n_init=5, random_state=0).fit(Xs)
    gm = GaussianMixture(n_components=k, covariance_type="full",
                         random_state=0).fit(Xs)
    gm_lab = gm.predict(Xs)
    db = DBSCAN(eps=0.6, min_samples=25).fit(Xs)

    def densest(labels, ignore_noise=False):
        vals_, counts = np.unique(labels, return_counts=True)
        if ignore_noise:
            mask = vals_ != -1
            vals_, counts = vals_[mask], counts[mask]
        if len(vals_) == 0:
            return None
        return vals_[int(np.argmax(counts))]

    km_d = km.labels_ == densest(km.labels_)
    gm_d = gm_lab == densest(gm_lab)
    db_top = densest(db.labels_, ignore_noise=True)
    db_d = (db.labels_ == db_top) if db_top is not None else np.zeros(n, bool)

    # consensus: in the densest cluster of >= 2 of 3 methods
    votes = km_d.astype(int) + gm_d.astype(int) + db_d.astype(int)
    consensus_mask = votes >= 2
    if consensus_mask.sum() < 10:
        consensus_mask = km_d  # fallback to KMeans densest

    # stability-selection refinement: bootstrap the consensus cloud, take the stable center
    forecast, stab = bootstrap_stability(vals[consensus_mask])
    diag["stability"] = round(stab, 3)
    diag["consensus_pct"] = round(100.0 * consensus_mask.mean(), 1)
    diag["clusters"] = {"kmeans": int(len(set(km.labels_))),
                        "dbscan": int(len(set(db.labels_)) - (1 if -1 in db.labels_ else 0)),
                        "gmm": int(len(set(gm_lab)))}

    # --- Mahalanobis center + concentration (covariance-aware) ---
    cov = np.cov(Xs.T)
    inv = np.linalg.pinv(cov)
    cen = Xs.mean(axis=0)
    md = np.sqrt(np.einsum("ij,jk,ik->i", Xs - cen, inv, Xs - cen))
    diag["mahalanobis_concentration_pct"] = round(100.0 * float(np.mean(md < 1.0)), 1)

    # --- Constellation: MST over KMeans centroids + Davies-Bouldin ---
    cents = km.cluster_centers_
    D = cdist(cents, cents)
    mst = minimum_spanning_tree(D).toarray()
    diag["constellation_path_len"] = round(float(mst.sum()), 3)
    try:
        diag["davies_bouldin"] = round(float(davies_bouldin_score(Xs, km.labels_)), 3)
    except Exception:  # noqa
        diag["davies_bouldin"] = None

    # 3D sample for visualization (price, drift%, reach, cluster)
    step = max(1, n // 280)
    sample = [{"val": round(float(vals[i]), 2),
               "drift": round(float(drift[i]) * 100, 2),
               "reach": int(reach[i]),
               "cluster": int(km.labels_[i]),
               "consensus": bool(consensus_mask[i])}
              for i in range(0, n, step)]
    return forecast, diag, sample


# ============================ FULL-PIPELINE COMPONENTS ============================

def hurst_exponent(prices):
    """R/S analysis. H~0.5 random walk, >0.5 trending, <0.5 mean-reverting."""
    r = np.diff(np.log(prices))
    N = len(r)
    if N < 20:
        return 0.5
    lags = [l for l in (2, 4, 8, 16, 32, 64) if l < N // 2]
    rs = []
    for lag in lags:
        chunks = N // lag
        vals = []
        for i in range(chunks):
            seg = r[i * lag:(i + 1) * lag]
            if len(seg) < 2:
                continue
            z = np.cumsum(seg - seg.mean())
            R, S = z.max() - z.min(), seg.std()
            if S > 0:
                vals.append(R / S)
        if vals:
            rs.append((lag, np.mean(vals)))
    if len(rs) < 2:
        return 0.5
    H = float(np.polyfit(np.log([a for a, _ in rs]), np.log([b for _, b in rs]), 1)[0])
    return max(0.0, min(1.0, H))


def predictability(prices):
    """Chaos / predictability ceiling diagnostic from the Hurst exponent."""
    H = hurst_exponent(prices)
    if abs(H - 0.5) < 0.05:
        label = "near random walk — direction barely forecastable"
    elif H > 0.55:
        label = "persistent / trending — somewhat forecastable"
    else:
        label = "mean-reverting — range forecastable"
    return {"hurst": round(H, 3), "label": label,
            "horizon_days": int(max(1, round(1.0 / max(abs(H - 0.5), 0.02))))}


def inverse_drift(vals, consensus_val, last):
    """Directional coherence of out-of-scope vectors = shared-bias flag (§6J)."""
    dev = (vals - consensus_val) / consensus_val
    out = vals[np.abs(dev) > 0.02]                     # outside ~2% of consensus
    if len(out) < 5:
        return {"coherence_pct": 0.0, "lean": "none", "n_outside": int(len(out))}
    up = float(np.mean(out > consensus_val))
    lean = "higher" if up > 0.6 else "lower" if up < 0.4 else "balanced"
    coherence = abs(up - 0.5) * 2
    return {"coherence_pct": round(coherence * 100, 1), "lean": lean,
            "n_outside": int(len(out)), "up_fraction": round(up, 2)}


def net_results(vals, consensus_val):
    """3 net results (§6G): densest mode, robust trimmed mean, consensus. + convergence."""
    mode = float(np.median(vals))  # robust mode proxy
    lo, hi = np.percentile(vals, [10, 90])
    trimmed = float(np.mean(vals[(vals >= lo) & (vals <= hi)]))
    three = [mode, trimmed, consensus_val]
    spread = (max(three) - min(three)) / consensus_val
    return {"mode": round(mode, 2), "robust_mean": round(trimmed, 2),
            "consensus": round(consensus_val, 2),
            "convergence_pct": round((1 - spread) * 100, 1),
            "agree": bool(spread < 0.01)}


def aci_update(alpha, miss, target_alpha, gamma=0.05):
    """Adaptive Conformal Inference (Gibbs & Candes): drives coverage to target."""
    return float(min(0.6, max(0.005, alpha + gamma * (target_alpha - miss))))


def model_confidence_set(loss_by_model, margin=1.0):
    """Royal rumble (Hansen MCS-lite): keep models statistically tied for best."""
    means = {m: float(np.mean(e)) for m, e in loss_by_model.items() if len(e)}
    if not means:
        return list(loss_by_model.keys())
    best = min(means.values())
    # SE of the loss differences across the pool
    allv = np.concatenate([np.asarray(e) for e in loss_by_model.values() if len(e)])
    se = float(np.std(allv) / np.sqrt(max(len(allv), 1)))
    keep = [m for m, mu in means.items() if mu <= best + margin * se]
    return keep or [min(means, key=means.get)]


def page_hinkley(resid, delta=0.002, lam=0.04):
    """Page-Hinkley concept-drift detector on the residual stream."""
    if len(resid) < 10:
        return {"drift": False, "stat": 0.0}
    mean = 0.0
    mt, mmin = 0.0, 0.0
    for j, x in enumerate(resid):
        mean = mean + (x - mean) / (j + 1)
        mt += x - mean - delta
        mmin = min(mmin, mt)
    ph = mt - mmin
    return {"drift": bool(ph > lam), "stat": round(float(ph), 4)}


def psi(expected, actual, bins=10):
    """Population Stability Index — distribution shift between two samples."""
    if len(expected) < 10 or len(actual) < 10:
        return 0.0
    qs = np.quantile(expected, np.linspace(0, 1, bins + 1))
    qs[0], qs[-1] = -np.inf, np.inf
    e = np.histogram(expected, qs)[0] / len(expected) + 1e-4
    a = np.histogram(actual, qs)[0] / len(actual) + 1e-4
    return float(np.sum((a - e) * np.log(a / e)))


def mixture_band(resid, target):
    """Bayesian-ish 2-regime (normal + tail) band via GMM on residuals (§6D)."""
    r = resid.reshape(-1, 1)
    if len(r) < 30:
        a = 1 - target
        return float(np.quantile(resid, a / 2)), float(np.quantile(resid, 1 - a / 2))
    gm = GaussianMixture(n_components=2, random_state=0).fit(r)
    samp = gm.sample(4000)[0].ravel()
    a = 1 - target
    return float(np.quantile(samp, a / 2)), float(np.quantile(samp, 1 - a / 2))


def aligned_market_returns(dates, market_rows):
    """Exogenous (O3): market index daily returns aligned to the ticker's dates."""
    mp = {r["date"]: r["close"] for r in market_rows}
    closes = np.array([mp.get(d, np.nan) for d in dates], float)
    ret = np.full(len(closes), np.nan)
    for i in range(1, len(closes)):
        if closes[i] > 0 and closes[i - 1] > 0:
            ret[i] = np.log(closes[i] / closes[i - 1])
    return ret


def exogenous_signal(mkt_ret_window):
    """O3 preventive: market regime -> drift tilt + band vol-scale (no lookahead)."""
    w = mkt_ret_window[~np.isnan(mkt_ret_window)]
    if len(w) < 10:
        return 0.0, 1.0
    tilt = float(np.clip(np.mean(w[-10:]) * 0.5, -0.01, 0.01))   # damped market momentum
    vol = float(np.std(w[-20:]))
    med = float(np.median([np.std(w[max(0, k - 20):k]) for k in range(20, len(w) + 1)])) or vol
    vol_scale = float(np.clip(vol / (med + 1e-9), 0.7, 1.6)) if med > 0 else 1.0
    return tilt, vol_scale


def fast_walkforward(rows, target=0.70, eval_start="2025-01-01", eval_end="2026-01-01",
                     min_hist=60, recent=120, win=100):
    """Fast generic forecaster (11-model ensemble + debias + ACI conformal) for ANY series
    over ANY eval window. Same output shape as run_walkforward, minus the 3D geometry."""
    dates = [r["date"] for r in rows]
    p = np.array([r["close"] for r in rows], float)
    p = np.where(p > 0, p, 1e-9)
    n = len(p)
    if n < min_hist + 5:
        return {"coverage": 0.0, "avg_width_pct": 0.0, "n_eval": 0, "target": int(target * 100), "rows": []}
    ens = np.full(n, np.nan)
    fns = list(MODELS.values())
    for i in range(min_hist, n):
        ens[i] = float(np.mean([fn(p[max(0, i - win):i]) for fn in fns]))
    rel = (p - ens) / ens
    alpha, a0 = 1 - target, 1 - target
    out, hits = [], 0
    for i in range(min_hist, n):
        if not (eval_start <= dates[i] < eval_end):
            continue
        cal = rel[max(min_hist, i - recent):i]
        cal = cal[~np.isnan(cal)]
        if len(cal) < 20:
            continue
        bias = float(np.mean(cal))
        pred = float(ens[i]) * (1 + bias)
        c = cal - bias
        qlo, qhi = float(np.quantile(c, alpha / 2)), float(np.quantile(c, 1 - alpha / 2))
        lo, hi = pred * (1 + qlo), pred * (1 + qhi)
        actual = float(p[i])
        hit = bool(lo <= actual <= hi)
        hits += int(hit)
        out.append({"date": dates[i], "pred": round(pred, 4), "lo": round(lo, 4),
                    "hi": round(hi, 4), "actual": round(actual, 4), "hit": hit,
                    "serr": round((actual - pred) / pred, 5),
                    "width_pct": round((hi - lo) / pred * 100, 2)})
        alpha = min(0.6, max(0.005, alpha + 0.05 * (a0 - (0 if hit else 1))))
    cov = hits / len(out) * 100 if out else 0.0
    return {"coverage": round(cov, 1),
            "avg_width_pct": round(float(np.mean([r["width_pct"] for r in out])), 2) if out else 0.0,
            "n_eval": len(out), "target": int(target * 100), "rows": out}


def lyapunov_rosenstein(prices, m=3, tau=1, max_t=8):
    """TRUE largest Lyapunov exponent (Rosenstein) — replaces the Hurst proxy."""
    x = np.diff(np.log(prices))
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
        ds = [np.log(np.linalg.norm(Y[i + t] - Y[nn[i] + t]) + 1e-12)
              for i in range(M - t) if nn[i] + t < M]
        if ds:
            div.append(np.mean(ds))
    if len(div) < 2:
        return 0.0
    return float(np.polyfit(range(len(div)), div, 1)[0])


def bootstrap_stability(vals, B=25):
    """Stability selection (§6C 3-wave idea): bootstrap the cloud, take the stable center."""
    if len(vals) < 30:
        return float(np.median(vals)) if len(vals) else 0.0, 0.0
    rng = np.random.default_rng(0)
    centers = np.array([float(np.median(rng.choice(vals, size=len(vals), replace=True)))
                        for _ in range(B)])
    stable = float(np.median(centers))
    stability = float(max(0.0, 1 - np.std(centers) / (abs(np.mean(centers)) + 1e-9)))
    return stable, stability


def confidence_conditional(rows):
    """O6: are the narrower (more confident) bands actually as accurate as wide ones?"""
    if len(rows) < 10:
        return {}
    w = np.array([r["width_pct"] for r in rows])
    hit = np.array([1.0 if r["hit"] else 0.0 for r in rows])
    med = np.median(w)
    return {"narrow_hitrate": round(float(hit[w <= med].mean()) * 100, 1) if (w <= med).any() else 0.0,
            "wide_hitrate": round(float(hit[w > med].mean()) * 100, 1) if (w > med).any() else 0.0}


def triangulation(our_drift, market_drift):
    """O7: divergence between our consensus drift and the independent market signal."""
    return {"our_drift_pct": round(our_drift * 100, 3),
            "market_drift_pct": round(market_drift * 100, 3),
            "divergence_flag": bool(abs(our_drift - market_drift) > 0.02)}


def isotonic_coverage(rows, target):
    """O8 calibration: empirical coverage vs the nominal target (is the band honest?)."""
    if not rows:
        return {}
    emp = float(np.mean([1.0 if r["hit"] else 0.0 for r in rows]))
    return {"nominal": int(target * 100), "empirical": round(emp * 100, 1),
            "calibrated": bool(abs(emp - target) < 0.05)}


def fforma_adjust(prices, i, consensus):
    """#4 FFORMA-lite: regime-conditional tilt (mean-revert when stretched, follow trend)."""
    last = prices[i - 1]
    ma20 = float(np.mean(prices[max(0, i - 20):i]))
    dist = (last - ma20) / ma20
    lr = np.diff(np.log(prices[max(1, i - 20):i]))
    trend = float(np.mean(lr)) if len(lr) else 0.0
    # stretched far from MA -> revert; mild trend with small dist -> follow
    tilt = -0.25 * dist + 0.15 * np.sign(trend) * min(abs(trend) * 5, 0.01)
    return consensus * (1 + float(np.clip(tilt, -0.03, 0.03)))


def hybrid_residual(prices, cons, i, recent=60):
    """#5 Hybrid: regress recent consensus residuals on features, predict the leftover."""
    lo = max(40, i - recent)
    rows_x, rows_y = [], []
    for k in range(lo, i):
        if np.isnan(cons[k]):
            continue
        ma20 = float(np.mean(prices[max(0, k - 20):k]))
        feat = [(prices[k - 1] - ma20) / ma20,
                float(np.std(np.diff(np.log(prices[max(1, k - 20):k]))))]
        rows_x.append(feat)
        rows_y.append((prices[k] - cons[k]) / cons[k])
    if len(rows_x) < 15:
        return 0.0
    X = np.array(rows_x); y = np.array(rows_y)
    try:
        beta = np.linalg.lstsq(np.column_stack([np.ones(len(X)), X]), y, rcond=None)[0]
        ma20 = float(np.mean(prices[max(0, i - 20):i]))
        f = [(prices[i - 1] - ma20) / ma20,
             float(np.std(np.diff(np.log(prices[max(1, i - 20):i]))))]
        return float(np.clip(beta[0] + beta[1:] @ f, -0.05, 0.05))
    except Exception:  # noqa
        return 0.0


def rho_matrix(prices, idxs, min_hist):
    """Step 5: pairwise error-correlation of base models -> mean rho + effective N."""
    errs = {m: [] for m in MODELS}
    for i in idxs:
        mp = model_preds_full(prices[:i])
        for m in MODELS:
            errs[m].append((mp[m] - prices[i]) / prices[i])
    E = np.array([errs[m] for m in MODELS])
    C = np.corrcoef(E)
    off = C[np.triu_indices(len(MODELS), k=1)]
    rho = float(np.nanmean(off))
    N = len(MODELS)
    eff_n = N / (1 + (N - 1) * max(rho, 0))
    return {"mean_rho": round(rho, 3), "effective_models": round(eff_n, 2), "pool": N}


def model_preds_full(prices):
    """All base models' 1-step forecast on the full window (for rho measurement)."""
    return {m: float(fn(np.asarray(prices, float))) for m, fn in MODELS.items()}


def thief_reconcile(prices, i):
    """THieF/MinT-lite: forecast at 5 temporal scales, reconcile to a coherent value."""
    last = prices[i - 1]
    preds, wts = [], []
    for S in SCALES:
        seg = prices[max(0, i - 60 * S):i]
        nblk = len(seg) // S
        if nblk < 3:
            continue
        coarse = seg[-nblk * S:].reshape(nblk, S).mean(axis=1)
        f = _ses(coarse)
        move = float(np.clip((f / coarse[-1]) ** (1.0 / max(S, 1)), 0.95, 1.05))
        preds.append(last * move)
        wts.append(1.0 / S)                       # finer scales weighted more (MinT-ish)
    if not preds:
        return last
    w = np.array(wts) / sum(wts)
    return float(np.array(preds) @ w)


def signal_decomp_forecast(prices, i):
    """#7 Signal decomposition: STL trend+seasonal, project trend, recombine (causal)."""
    seg = prices[max(0, i - 252):i]
    if len(seg) < 50:
        return prices[i - 1]
    try:
        res = prep.STL(seg, period=21, robust=True).fit()
        trend = res.trend
        slope = float(trend[-1] - trend[-5]) / 5
        seas = float(res.seasonal[-21]) if len(res.seasonal) >= 21 else 0.0
        return float(trend[-1] + slope + seas)
    except Exception:  # noqa
        return prices[i - 1]


def ellipsoid_27(vals, reach, drift):
    """Explicit 27-point (3x3x3) boundary of the Mahalanobis ellipsoid around the cloud."""
    X = np.column_stack([reach, vals, drift])
    mu, sd = X.mean(0), X.std(0); sd[sd < 1e-9] = 1
    pts = []
    for a in (-1, 0, 1):
        for b in (-1, 0, 1):
            for c in (-1, 0, 1):
                pts.append({"reach": float(mu[0] + a * sd[0]),
                            "val": round(float(mu[1] + b * sd[1]), 2),
                            "drift": round(float(mu[2] + c * sd[2]) * 100, 2)})
    return pts


def forecast_horizons(rows, target=0.70, horizons=(7, 30, 90), min_hist=70, recent=150,
                      eval_start="2025-01-01", eval_end="2025-04-01"):
    """Multi-horizon (7/30/90-day) forecaster using the 10 study-derived vectors:
    vol-scaled adaptive band + mean-reversion tilt + horizon bias correction + ACI."""
    dates = [r["date"] for r in rows]
    p = np.array([r["close"] for r in rows], float)
    n = len(p)
    lr = np.diff(np.log(p), prepend=np.log(p[0]))

    # precompute feature vectors per index
    vol20 = np.array([np.std(lr[max(1, i - 20):i]) if i > 2 else 0.0 for i in range(n)])
    ma50 = np.array([np.mean(p[max(0, i - 50):i]) if i > 1 else p[i] for i in range(n)])
    ma20 = np.array([np.mean(p[max(0, i - 20):i]) if i > 1 else p[i] for i in range(n)])
    dist50 = (p - ma50) / ma50
    dist20 = (p - ma20) / ma20
    range5 = np.array([(p[max(0, i - 5):i].max() - p[max(0, i - 5):i].min()) / p[i - 1]
                       if i > 5 else 0.0 for i in range(n)])
    abs_last = np.abs(lr)

    out = {}
    series = {}
    for h in horizons:
        rev = min(0.55, 0.006 * h)                         # reversion strength grows with h
        # point + standardized residuals over history
        def point_at(i):
            drift = float(np.clip(np.mean(lr[max(1, i - 20):i]), -0.01, 0.01))
            pt = p[i - 1] * np.exp(drift * h * 0.5)
            pt *= (1 - rev * (0.6 * dist50[i - 1] + 0.4 * dist20[i - 1]))   # reversion tilt
            return pt

        sres = np.full(n, np.nan)                           # vol-standardized residuals
        scale = np.maximum(vol20 * np.sqrt(h) + 0.5 * range5 + 0.3 * abs_last, 1e-4)
        for i in range(min_hist, n - h):
            pt = point_at(i)
            sres[i] = (p[i + h - 1] - pt) / (pt * scale[i])

        target_alpha = 1 - target
        alpha = target_alpha
        hits, ws, tot, rowser = 0, [], 0, []
        for i in range(min_hist, n - h):
            if not (eval_start <= dates[i] < eval_end):
                continue
            # PURGE + EMBARGO: drop calibration residuals whose h-ahead target overlaps
            # the eval point (otherwise future outcomes leak into the band — Step 3 guard)
            keep = prep.purge_embargo_indices(max(min_hist, i - recent), i, i, h)
            cal = sres[keep]
            cal = cal[~np.isnan(cal)]
            if len(cal) < 20:
                continue
            bias = float(np.mean(cal))                       # horizon-specific debias
            q1 = np.quantile(cal - bias, alpha / 2)
            q2 = np.quantile(cal - bias, 1 - alpha / 2)
            pt = point_at(i) * (1 + bias * scale[i])
            lo = pt + q1 * pt * scale[i]
            hi = pt + q2 * pt * scale[i]
            actual = float(p[i + h - 1])
            hit = bool(lo <= actual <= hi)
            hits += int(hit); ws.append((hi - lo) / pt); tot += 1
            rowser.append({"date": dates[i], "target_date": dates[i + h - 1],
                           "pred": round(pt, 2), "lo": round(float(lo), 2),
                           "hi": round(float(hi), 2), "actual": round(actual, 2), "hit": hit})
            alpha = aci_update(alpha, 0 if hit else 1, target_alpha)
        if tot:
            out[f"{h}d"] = {"coverage": round(100 * hits / tot, 1),
                            "avg_width_pct": round(float(np.mean(ws)) * 100, 2), "n": tot}
            series[f"{h}d"] = rowser
    return {"horizons": out, "series": series, "target": int(target * 100)}


def walkthrough(rows, target=0.70, min_hist=90, recent=120,
                eval_start="2025-01-01", eval_end="2025-04-01"):
    """Return EVERY intermediate artifact for ONE forecast day, phase by phase."""
    dates = [r["date"] for r in rows]
    prices = np.array([r["close"] for r in rows], float)
    n = len(prices)
    target_i = next((i for i in range(min_hist, n)
                     if eval_start <= dates[i] < eval_end), None)
    if target_i is None:
        return {"error": "no eval day found"}

    hist = prices[:target_i]
    last = float(hist[-1])
    actual = float(prices[target_i])
    vals, reach, drift = build_cloud(hist)
    nvec = len(vals)

    # 3D embed + standardize
    X = np.column_stack([reach, vals, drift])
    mu, sd = X.mean(axis=0), X.std(axis=0)
    sd[sd < 1e-9] = 1.0
    Xs = np.nan_to_num((X - mu) / sd)

    # 3 clusterings
    km = KMeans(n_clusters=5, n_init=5, random_state=0).fit(Xs)
    gm = GaussianMixture(n_components=5, covariance_type="full", random_state=0).fit(Xs)
    gm_lab = gm.predict(Xs)
    db = DBSCAN(eps=0.6, min_samples=25).fit(Xs)

    def densest(labels, ign=False):
        u, c = np.unique(labels, return_counts=True)
        if ign:
            m = u != -1; u, c = u[m], c[m]
        return u[int(np.argmax(c))] if len(u) else None

    km_d = km.labels_ == densest(km.labels_)
    gm_d = gm_lab == densest(gm_lab)
    dt = densest(db.labels_, True)
    db_d = (db.labels_ == dt) if dt is not None else np.zeros(nvec, bool)
    votes = km_d.astype(int) + gm_d.astype(int) + db_d.astype(int)
    cmask = votes >= 2
    if cmask.sum() < 10:
        cmask = km_d
    forecast = float(np.mean(vals[cmask]))

    # mahalanobis
    inv = np.linalg.pinv(np.cov(Xs.T))
    cen = Xs.mean(axis=0)
    md = np.sqrt(np.einsum("ij,jk,ik->i", Xs - cen, inv, Xs - cen))

    # constellation: MST over kmeans centroids (de-standardized)
    cents_s = km.cluster_centers_
    D = cdist(cents_s, cents_s)
    mst = minimum_spanning_tree(D).toarray()
    edges = [[int(i), int(j), round(float(mst[i, j]), 3)]
             for i in range(len(cents_s)) for j in range(len(cents_s)) if mst[i, j] > 0]
    cents = (cents_s * sd + mu)
    centroids = [{"reach": float(c[0]), "val": round(float(c[1]), 2),
                  "drift": round(float(c[2]) * 100, 2)} for c in cents]

    # range via recent conformal
    rel_hist = []
    for j in range(max(min_hist, target_i - recent), target_i):
        v2, r2, d2 = build_cloud(prices[:j])
        f2, _, _ = geo_consensus(v2, r2, d2, prices[j - 1])
        rel_hist.append((prices[j] - f2) / f2)
    rel_hist = np.array(rel_hist)
    lo_q, hi_q = (1 - target) / 2, 1 - (1 - target) / 2
    qlo, qhi = float(np.quantile(rel_hist, lo_q)), float(np.quantile(rel_hist, hi_q))
    lo, hi = forecast * (1 + qlo), forecast * (1 + qhi)

    # sample for plotting (carry all 3 cluster labels + consensus)
    step = max(1, nvec // 500)
    idx = list(range(0, nvec, step))
    pts = [{"reach": int(reach[i]), "val": round(float(vals[i]), 2),
            "drift": round(float(drift[i]) * 100, 2),
            "km": int(km.labels_[i]), "gm": int(gm_lab[i]), "db": int(db.labels_[i]),
            "consensus": bool(cmask[i])} for i in idx]

    # cloud histogram
    hcounts, hedges = np.histogram(vals, bins=40)

    # per-model spread
    by_model = {}
    # (recompute quickly which model each came from is omitted; show value hist instead)

    return {
        "ticker": rows and None, "date": dates[target_i], "prev_close": round(last, 2),
        "actual": round(actual, 2), "n_vectors": int(nvec), "target": int(target * 100),
        "phases": {
            "input": {"dates": dates[max(0, target_i - 60):target_i],
                      "prices": [round(float(p), 2) for p in hist[-60:]]},
            "chaos": predictability(hist),
            "inverse_drift": inverse_drift(vals, forecast, last),
            "net_results": net_results(vals, forecast),
            "funnel": [
                {"stage": "Generated vectors", "count": int(N_VECTORS)},
                {"stage": "In-bounds (clip)", "count": int(nvec)},
                {"stage": "Consensus cluster (≥2/3 methods)", "count": int(cmask.sum())},
                {"stage": "+ Within Mahalanobis 1σ", "count": int((cmask & (md < 1.0)).sum())},
                {"stage": "Final consensus point", "count": 1},
            ],
            "cloud": {"n": int(nvec), "min": round(float(vals.min()), 2),
                      "max": round(float(vals.max()), 2),
                      "hist_counts": [int(x) for x in hcounts],
                      "hist_edges": [round(float(x), 2) for x in hedges]},
            "embed": {"axes": {"x": "temporal reach (days)", "y": "predicted value ($)",
                               "z": "implied drift (%)"},
                      "raw_ranges": {"reach": [int(reach.min()), int(reach.max())],
                                     "val": [round(float(vals.min()), 2), round(float(vals.max()), 2)],
                                     "drift": [round(float(drift.min()) * 100, 2), round(float(drift.max()) * 100, 2)]}},
            "standardize": {"mean": [round(float(x), 3) for x in mu],
                            "std": [round(float(x), 3) for x in sd]},
            "cluster": {"kmeans_k": int(len(set(km.labels_))),
                        "dbscan_k": int(len(set(db.labels_)) - (1 if -1 in db.labels_ else 0)),
                        "gmm_k": int(len(set(gm_lab)))},
            "consensus": {"pct": round(100.0 * cmask.mean(), 1), "forecast": round(forecast, 2),
                          "n_consensus": int(cmask.sum())},
            "mahalanobis": {"concentration_pct": round(100.0 * float(np.mean(md < 1.0)), 1),
                            "median_dist": round(float(np.median(md)), 3)},
            "constellation": {"centroids": centroids, "edges": edges,
                              "path_len": round(float(mst.sum()), 3),
                              "davies_bouldin": round(float(davies_bouldin_score(Xs, km.labels_)), 3)},
            "range": {"forecast": round(forecast, 2), "lo": round(float(lo), 2),
                      "hi": round(float(hi), 2), "qlo_pct": round(qlo * 100, 2),
                      "qhi_pct": round(qhi * 100, 2),
                      "width_pct": round((hi - lo) / forecast * 100, 2),
                      "n_calib": int(len(rel_hist))},
            "result": {"pred": round(forecast, 2), "lo": round(float(lo), 2),
                       "hi": round(float(hi), 2), "actual": round(actual, 2),
                       "hit": bool(lo <= actual <= hi)},
        },
        "points": pts,
    }


def run_walkforward(rows, target=0.70, min_hist=90, recent=120,
                    eval_start="2025-01-01", eval_end="2025-04-01"):
    # Steps 1-3: validate -> impute/flag -> stationarity/STL (data-quality report)
    v = prep.validate(rows)
    rows = v["clean"]
    dates = [r["date"] for r in rows]
    prices, hampel = prep.impute_and_flag([r["close"] for r in rows])
    data_quality = {"n_quarantined": v["n_quarantined"], "benford": v["benford"],
                    "hampel_outliers": hampel, "stationarity": prep.stationarity(prices),
                    "stl": prep.stl_decompose(prices)}
    n = len(prices)

    eval_idx = [i for i in range(min_hist, n) if eval_start <= dates[i] < eval_end]
    lo_bound = max(min_hist, min(eval_idx) - recent) if eval_idx else min_hist
    hi_bound = (max(eval_idx) + 1) if eval_idx else n

    cons = np.full(n, np.nan)
    cloud_lo = np.full(n, np.nan)
    cloud_hi = np.full(n, np.nan)
    last_diag, last_sample = {}, []
    for i in range(lo_bound, hi_bound):
        vals, reach, drift = build_cloud(prices[:i])
        f, diag, sample = geo_consensus(vals, reach, drift, prices[i - 1])
        f = fforma_adjust(prices, i, f)                       # #4 FFORMA regime tilt
        cons[i] = f
        cloud_lo[i] = float(np.quantile(vals, (1 - target) / 2))   # for #8 CQR
        cloud_hi[i] = float(np.quantile(vals, 1 - (1 - target) / 2))
        if eval_start <= dates[i] < eval_end and not last_sample:
            last_diag, last_sample = diag, sample
    rel = (prices - cons) / cons

    log_ret = np.diff(np.log(prices), prepend=np.log(prices[0]))
    mkt_ret = aligned_market_returns(dates, _market_rows())        # O3 exogenous (SPY)
    target_alpha = 1 - target
    alpha = target_alpha                      # ACI adaptive miscoverage level
    out_rows, widths, hits, risk_flags, drift_flags = [], [], 0, 0, 0
    psis = []
    for i in range(min_hist, n):
        if not (eval_start <= dates[i] < eval_end):
            continue
        cal = rel[max(min_hist, i - recent):i]
        cal = cal[~np.isnan(cal)]
        if len(cal) < 20:
            continue
        bias = float(np.mean(cal))                                # O1/O2 debiasing
        hres = hybrid_residual(prices, cons, i)                   # #5 hybrid residual
        exo_tilt, vol_scale = exogenous_signal(mkt_ret[max(0, i - 60):i])  # O3 market regime
        pred = float(cons[i]) * (1 + bias + hres) * (1 + exo_tilt)
        centered = cal - bias
        # O5 distribution-shift sentinel (PSI between old vs recent residuals)
        if len(cal) >= 40:
            psis.append(psi(cal[:len(cal) // 2], cal[len(cal) // 2:]))
        # #8 CQR: band from the cloud's OWN spread + conformal correction at ACI level
        calk = [k for k in range(max(min_hist, i - recent), i) if not np.isnan(cloud_lo[k])]
        if len(calk) >= 20:
            scores = np.array([max(cloud_lo[k] - prices[k], prices[k] - cloud_hi[k]) for k in calk])
            E = max(float(np.quantile(scores, min(0.999, 1 - alpha))), 0.0)
            spread_lo = max(float(cons[i]) - cloud_lo[i], 0.0)
            spread_hi = max(cloud_hi[i] - float(cons[i]), 0.0)
            lo = pred - (spread_lo + E) * vol_scale
            hi = pred + (spread_hi + E) * vol_scale
        else:
            qlo, qhi = mixture_band(centered, 1 - alpha)          # §6D mixture fallback
            lo, hi = pred * (1 + qlo * vol_scale), pred * (1 + qhi * vol_scale)
        # drift detection -> widen band (escalate, don't suppress)
        ph = page_hinkley(centered[-60:] if len(centered) >= 60 else centered)
        if ph["drift"]:
            drift_flags += 1; lo = pred - (pred - lo) * 1.3; hi = pred + (hi - pred) * 1.3
        actual = float(prices[i])
        hit = bool(lo <= actual <= hi)
        rsd = float(np.std(log_ret[max(0, i - recent):i]))
        implied = np.log(pred / prices[i - 1])
        flag = bool(abs(implied) > 3 * rsd) if rsd > 0 else False
        risk_flags += int(flag)
        width = (hi - lo) / pred
        hits += int(hit); widths.append(width)
        out_rows.append({
            "date": dates[i], "pred": round(pred, 2),
            "lo": round(float(lo), 2), "hi": round(float(hi), 2),
            "actual": round(actual, 2), "hit": hit,
            "width_pct": round(float(width) * 100, 2),
            "risk_flag": flag, "drift": ph["drift"], "alpha": round(alpha, 3),
        })
        alpha = aci_update(alpha, 0 if hit else 1, target_alpha)   # ACI update

    cov = hits / len(out_rows) if out_rows else 0.0

    # O7 triangulation inputs: our forecast's mean implied drift vs the market's
    if len(out_rows) > 1:
        _our_drift = float(np.mean([(out_rows[k]["pred"] - out_rows[k - 1]["actual"])
                                    / out_rows[k - 1]["actual"] for k in range(1, len(out_rows))]))
    else:
        _our_drift = 0.0
    _mv = mkt_ret[np.isfinite(mkt_ret)]
    _mkt_drift = float(np.mean(_mv[-60:])) if len(_mv) else 0.0

    # multi-horizon coverage (day / week / month), static conformal on h-ahead residuals
    mh = {}
    for h, name in [(1, "day"), (5, "week"), (21, "month")]:
        rh = np.array([(prices[k + h - 1] - cons[k]) / cons[k]
                       for k in range(lo_bound, n - h + 1) if not np.isnan(cons[k])])
        if len(rh) < 20:
            continue
        q1, q2 = np.quantile(rh, target_alpha / 2), np.quantile(rh, 1 - target_alpha / 2)
        hh, ww, tot = 0, [], 0
        for i in range(min_hist, n):
            if not (eval_start <= dates[i] < eval_end) or i + h - 1 >= n or np.isnan(cons[i]):
                continue
            p = float(cons[i]); a = float(prices[i + h - 1])
            lo2, hi2 = p * (1 + q1), p * (1 + q2)
            hh += int(lo2 <= a <= hi2); ww.append((hi2 - lo2) / p); tot += 1
        if tot:
            mh[name] = {"coverage": round(100 * hh / tot, 1),
                        "avg_width_pct": round(float(np.mean(ww)) * 100, 2), "n": tot}

    return {
        "n_eval": len(out_rows),
        "coverage": round(cov * 100, 1),
        "target": int(target * 100),
        "avg_width_pct": round(float(np.mean(widths)) * 100, 2) if widths else 0.0,
        "risk_flags": risk_flags,
        "drift_flags": drift_flags,
        "avg_psi": round(float(np.mean(psis)), 3) if psis else 0.0,
        "exogenous": "SPY market regime (tilt + vol-scale)",
        "data_quality": data_quality,
        "lyapunov": round(lyapunov_rosenstein(prices[:lo_bound]), 4) if lo_bound > 50 else None,
        "confidence_audit": confidence_conditional(out_rows),
        "triangulation": triangulation(_our_drift, _mkt_drift),
        "calibration": isotonic_coverage(out_rows, target),
        "rho": rho_matrix(prices, list(range(max(min_hist, n - 120), n)), min_hist),
        "thief_reconciled": round(thief_reconcile(prices, n), 2),
        "signal_decomp_next": round(signal_decomp_forecast(prices, n), 2),
        "ellipsoid_27_pts": len(ellipsoid_27(*build_cloud(prices[:n]))) if n > min_hist else 0,
        "predictability": predictability(prices[:lo_bound]) if lo_bound > 30 else None,
        "multi_horizon": mh,
        "n_vectors": N_VECTORS,
        "geometry": last_diag,
        "cloud_3d": last_sample,
        "rows": out_rows,
    }

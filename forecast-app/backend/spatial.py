"""Spatial tier — C11 3D embed · C12 clustering · C13 consensus · C14 Mahalanobis ·
C15 constellation · C16 Louvain dependency. Each math-gated."""
import warnings
import numpy as np
from sklearn.cluster import KMeans, DBSCAN
from sklearn.mixture import GaussianMixture
from sklearn.metrics import davies_bouldin_score
from scipy.sparse.csgraph import minimum_spanning_tree
from scipy.spatial.distance import cdist
import networkx as nx
from networkx.algorithms.community import louvain_communities

import data
import engine

warnings.filterwarnings("ignore")


# ---------- C11: 3D embed + standardize ----------
def geo_cloud(prices):
    """1,980 vectors with 3D coords: reach(=L*S), value, drift."""
    p = np.asarray(prices, float)
    last = p[-1]
    vals, reach, drift = [], [], []
    for S in engine.SCALES:
        coarse = engine.aggregate(p[-max(engine.LOOKBACKS) * S:], S) if len(p) >= max(engine.LOOKBACKS) * S else p
        for L in engine.LOOKBACKS:
            c = coarse[-L:] if len(coarse) >= L else coarse
            if len(c) < 2 or c[-1] <= 0:
                continue
            for fn in engine.MODELS.values():
                try:
                    f = float(fn(c))
                except Exception:  # noqa
                    f = c[-1]
                move = min(max((f / c[-1]) ** (1.0 / max(S, 1)), 0.9), 1.1) if f > 0 else 1.0
                for P in engine.POINTS:
                    est = last * move ** P
                    if 0.5 * last < est < 2.0 * last:
                        vals.append(est); reach.append(L * S); drift.append((est - last) / last)
    return np.array(vals), np.array(reach, float), np.array(drift)


def standardize(vals, reach, drift):
    X = np.column_stack([reach, vals, drift])
    mu, sd = X.mean(0), X.std(0)
    sd[sd < 1e-9] = 1.0
    return np.nan_to_num((X - mu) / sd)


# ---------- C12-C15: cluster, consensus, mahalanobis, constellation ----------
def geo_consensus(prices):
    vals, reach, drift = geo_cloud(prices)
    if len(vals) < 30:
        return {"forecast": float(np.median(vals)) if len(vals) else 0.0, "consensus_pct": 0.0}
    Xs = standardize(vals, reach, drift)
    km = KMeans(n_clusters=5, n_init=5, random_state=0).fit(Xs)
    gm = GaussianMixture(n_components=5, random_state=0).fit(Xs); gl = gm.predict(Xs)
    db = DBSCAN(eps=0.6, min_samples=25).fit(Xs)

    def densest(lab, ign=False):
        u, c = np.unique(lab, return_counts=True)
        if ign:
            m = u != -1; u, c = u[m], c[m]
        return u[int(np.argmax(c))] if len(u) else None
    kd = km.labels_ == densest(km.labels_)
    gd = gl == densest(gl)
    dt = densest(db.labels_, True); dd = (db.labels_ == dt) if dt is not None else np.zeros(len(vals), bool)
    votes = kd.astype(int) + gd.astype(int) + dd.astype(int)
    cons = votes >= 2
    if cons.sum() < 10:
        cons = kd
    forecast = float(np.mean(vals[cons]))
    # C14 Mahalanobis concentration
    inv = np.linalg.pinv(np.cov(Xs.T)); cen = Xs.mean(0)
    md = np.sqrt(np.einsum("ij,jk,ik->i", Xs - cen, inv, Xs - cen))
    # C15 constellation
    cents = km.cluster_centers_
    mst = minimum_spanning_tree(cdist(cents, cents)).toarray()
    return {"forecast": round(forecast, 2), "consensus_pct": round(100 * cons.mean(), 1),
            "n_clusters": {"kmeans": int(len(set(km.labels_))), "dbscan": int(len(set(db.labels_)) - (1 if -1 in db.labels_ else 0)), "gmm": int(len(set(gl)))},
            "mahalanobis_pct": round(100 * float(np.mean(md < 1.0)), 1),
            "constellation_len": round(float(mst.sum()), 3),
            "davies_bouldin": round(float(davies_bouldin_score(Xs, km.labels_)), 3),
            "points": [{"x": float(reach[i]), "y": round(float(vals[i]), 2), "z": round(float(drift[i]) * 100, 2),
                        "cluster": int(km.labels_[i]), "consensus": bool(cons[i])}
                       for i in range(0, len(vals), max(1, len(vals) // 300))]}


# ---------- C16: Louvain data-gravity + dependency ----------
def louvain_map(tickers, eval_start="2025-01-01", eval_end="2026-01-01", thresh=0.3):
    series = {}
    for t in tickers:
        try:
            rows = data.fetch(t)["rows"]
            series[t] = {r["date"]: r["close"] for r in rows if eval_start <= r["date"] < eval_end}
        except Exception:  # noqa
            pass
    common = sorted(set.intersection(*[set(d) for d in series.values()])) if series else []
    rets = {t: np.diff(np.log([d[c] for c in common])) for t, d in series.items()
            if len(common) > 5 and all(d[c] > 0 for c in common)}
    tk = list(rets.keys())
    if len(tk) < 2:
        return {"nodes": [], "edges": [], "communities": [], "n_communities": 0}
    L = min(len(v) for v in rets.values())
    C = np.corrcoef(np.array([rets[t][:L] for t in tk]))
    G = nx.Graph(); G.add_nodes_from(range(len(tk)))
    for i in range(len(tk)):
        for j in range(i + 1, len(tk)):
            if abs(C[i, j]) >= thresh:
                G.add_edge(i, j, weight=abs(float(C[i, j])))
    comms = louvain_communities(G, weight="weight", seed=0) if G.number_of_edges() else [set(range(len(tk)))]
    com_of = {n: ci for ci, com in enumerate(comms) for n in com}
    nc = len(comms)
    dep = np.zeros((nc, nc))
    for i in range(len(tk)):
        for j in range(i + 1, len(tk)):
            a, b = com_of[i], com_of[j]
            dep[a, b] += abs(C[i, j]); dep[b, a] += abs(C[i, j])
    edges = [{"source": a, "target": b, "weight": round(float(dep[a, b]), 2)}
             for a in range(nc) for b in range(a + 1, nc) if dep[a, b] > 0]
    return {"nodes": [{"id": tk[i], "community": com_of[i]} for i in range(len(tk))],
            "edges": edges, "communities": [{"id": ci, "members": [tk[n] for n in com]} for ci, com in enumerate(comms)],
            "n_communities": nc, "dep_matrix": [[round(float(dep[a, b]), 2) for b in range(nc)] for a in range(nc)]}

"""Data-gravity / constellation: Louvain community detection on stock-return correlation,
force-directed node layout, and cluster-to-cluster dependency. Feeds the constellation
diagram + dependency mapper (modeled on etl-dep-viz's L1/L2 + ConstellationCanvas)."""
import numpy as np
import networkx as nx
from networkx.algorithms.community import louvain_communities
import data


def _returns(tickers, eval_start, eval_end):
    series = {}
    for t in tickers:
        try:
            rows = data.fetch(t)["rows"]
            series[t] = {r["date"]: r["close"] for r in rows if eval_start <= r["date"] < eval_end}
        except Exception:  # noqa
            pass
    if not series:
        return {}, []
    common = sorted(set.intersection(*[set(d) for d in series.values()]))
    rets = {}
    for t, d in series.items():
        p = np.array([d[c] for c in common], float)
        if len(p) > 5 and (p > 0).all():
            rets[t] = np.diff(np.log(p))
    return rets, common


def constellation(tickers, eval_start="2025-01-01", eval_end="2026-01-01", thresh=0.3):
    """Returns nodes (force-directed, community-colored), cluster-to-cluster dependency
    edges, and the Louvain communities — the data-gravity map across the selected stocks."""
    rets, common = _returns(tickers, eval_start, eval_end)
    tk = list(rets.keys())
    if len(tk) < 2:
        return {"nodes": [], "edges": [], "communities": [], "n": len(tk), "algo": "louvain"}
    L = min(len(v) for v in rets.values())
    M = np.array([rets[t][:L] for t in tk])
    C = np.corrcoef(M)

    G = nx.Graph()
    G.add_nodes_from(range(len(tk)))
    for i in range(len(tk)):
        for j in range(i + 1, len(tk)):
            if abs(C[i, j]) >= thresh:
                G.add_edge(i, j, weight=abs(float(C[i, j])))

    comms = (louvain_communities(G, weight="weight", seed=0)
             if G.number_of_edges() else [set(range(len(tk)))])
    comm_of = {n: ci for ci, com in enumerate(comms) for n in com}
    pos = nx.spring_layout(G, weight="weight", seed=0, k=0.6, iterations=80)

    nodes = []
    for i, t in enumerate(tk):
        cum = float(np.exp(np.sum(rets[t])) - 1) * 100
        p = pos.get(i, (0.0, 0.0))
        nodes.append({"id": t, "x": round(float(p[0]), 4), "y": round(float(p[1]), 4),
                      "community": comm_of.get(i, 0), "drift_pct": round(cum, 1),
                      "vol_pct": round(float(np.std(rets[t])) * 100, 2)})

    nc = len(comms)
    dep = np.zeros((nc, nc))
    for i in range(len(tk)):
        for j in range(i + 1, len(tk)):
            a, b = comm_of[i], comm_of[j]
            dep[a, b] += abs(C[i, j]); dep[b, a] += abs(C[i, j])
    edges = [{"source": a, "target": b, "weight": round(float(dep[a, b]), 2)}
             for a in range(nc) for b in range(a + 1, nc) if dep[a, b] > 0]
    communities = [{"id": ci, "members": [tk[n] for n in com], "size": len(com),
                    "avg_drift_pct": round(float(np.mean([nodes[n2]["drift_pct"]
                                          for n2, c2 in comm_of.items() if c2 == ci])), 1)}
                   for ci, com in enumerate(comms)]
    return {"nodes": nodes, "edges": edges, "communities": communities,
            "n": len(tk), "n_communities": nc, "algo": "louvain", "days": len(common)}

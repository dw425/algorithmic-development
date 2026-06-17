"""
MUSE InsightHub API — read-only endpoints over insights.db (built by
muse_research.build_insights_db). Mounted under /insights/api.

Serves the constellation (every answer = a node with embedding coords + encodable metrics),
prompt blueprints (a prompt's answers side-by-side), and per-tier/category/model/divergence/
quality aggregates for the 9-tab dashboard.
"""

from __future__ import annotations

import sqlite3
from pathlib import Path

from fastapi import APIRouter, HTTPException, Query

router = APIRouter()
DB = Path(__file__).parent / "insights.db"


def _con():
    if not DB.exists():
        raise HTTPException(503, "insights.db not built yet — run muse_research.build_insights_db")
    con = sqlite3.connect(DB)
    con.row_factory = sqlite3.Row
    return con


def _rows(cur):
    return [dict(r) for r in cur.fetchall()]


@router.get("/meta")
def meta():
    con = _con()
    m = {r["key"]: r["value"] for r in con.execute("SELECT key,value FROM meta")}
    con.close()
    return m


@router.get("/overview")
def overview():
    con = _con()
    tiers = _rows(con.execute("SELECT * FROM tiers"))
    m = {r["key"]: r["value"] for r in con.execute("SELECT key,value FROM meta")}
    n_cat = con.execute("SELECT COUNT(*) n FROM categories").fetchone()["n"]
    topdiv = _rows(con.execute(
        "SELECT i,category,prompt,lg_div FROM prompts WHERE lg_div IS NOT NULL ORDER BY lg_div DESC LIMIT 5"))
    con.close()
    order = {"small": 0, "medium": 1, "large": 2}
    tiers.sort(key=lambda t: order.get(t["tier"], 9))
    return {"meta": m, "tiers": tiers, "n_categories": n_cat, "top_divergent": topdiv}


@router.get("/constellation")
def constellation(proj: str = Query("umap", pattern="^(pca|umap)$"),
                  bbox: str = "", cap: int = Query(26000, alias="max"), cluster_algo: str = ""):
    """Answer nodes with coords + encodable metrics. Scales: returns all when total<=max, else a
    uniform sample (overview) or the viewport (bbox) slice. Optional server-side cluster_id."""
    con = _con()
    xc, yc = (("umap_x", "umap_y") if proj == "umap" else ("pca_x", "pca_y"))
    where: list = []; bargs: list = []
    if bbox:
        try:
            x0, y0, x1, y1 = [float(v) for v in bbox.split(",")]
        except Exception:
            con.close(); raise HTTPException(400, "bad bbox")
        where += [f"a.{xc} BETWEEN ? AND ?", f"a.{yc} BETWEEN ? AND ?"]; bargs += [min(x0, x1), max(x0, x1), min(y0, y1), max(y0, y1)]
    bw = (" WHERE " + " AND ".join(where)) if where else ""
    total = con.execute(f"SELECT COUNT(*) n FROM answers a{bw}", bargs).fetchone()["n"]
    sampled = total > cap
    awhere = list(where)
    if sampled:
        awhere.append(f"(a.id % {total // cap + 1})=0")     # deterministic uniform sample
    aw = (" WHERE " + " AND ".join(awhere)) if awhere else ""
    sel = f"SELECT a.id,a.prompt_i,a.model,a.tier,a.category,a.length,a.quality,a.{xc} AS x,a.{yc} AS y"
    frm = "FROM answers a"; args: list = []
    if cluster_algo:
        sel += ",cl.cluster_id AS cluster"; frm += " LEFT JOIN clusters cl ON cl.node_id=a.id AND cl.algorithm=?"; args.append(cluster_algo)
    rows = _rows(con.execute(f"{sel} {frm}{aw} LIMIT {cap}", (*args, *bargs)))
    cats = [r["name"] for r in con.execute("SELECT name FROM categories ORDER BY name")]
    models = [dict(r) for r in con.execute("SELECT name,tier FROM models")]
    con.close()
    return {"proj": proj, "nodes": rows, "total": total, "returned": len(rows), "sampled": sampled,
            "categories": cats, "models": models, "tiers": ["small", "medium", "large"]}


@router.get("/prompts")
def prompts(search: str = "", sort: str = "i", order: str = "asc", limit: int = 1100):
    con = _con()
    cols = {"i", "category", "lg_div", "avg_quality", "sm_div", "md_div"}
    sort = sort if sort in cols else "i"
    order = "DESC" if order.lower() == "desc" else "ASC"
    q = ("SELECT i,category,prompt,sm_div,md_div,lg_div,avg_quality,n_judged FROM prompts "
         "WHERE prompt LIKE ? ORDER BY " + sort + " " + order + " LIMIT ?")
    rows = _rows(con.execute(q, (f"%{search}%", limit)))
    con.close()
    return {"prompts": rows, "count": len(rows)}


@router.get("/prompt/{i}")
def prompt(i: int):
    con = _con()
    p = con.execute("SELECT * FROM prompts WHERE i=?", (i,)).fetchone()
    if not p:
        con.close(); raise HTTPException(404, "prompt not found")
    answers = _rows(con.execute(
        "SELECT id,model,tier,category,length,quality,text FROM answers WHERE prompt_i=? ORDER BY tier,model", (i,)))
    con.close()
    order = {"small": 0, "medium": 1, "large": 2}
    answers.sort(key=lambda a: (order.get(a["tier"], 9), a["model"]))
    return {"prompt": dict(p), "answers": answers}


@router.get("/prompt_sim/{i}")
def prompt_sim(i: int):
    """Pairwise similarity of a prompt's answers (for Neural Net match-recolor). Returns answer ids."""
    con = _con()
    pairs = _rows(con.execute("SELECT a, b, sim FROM answer_sim WHERE prompt_i=?", (i,)))
    con.close()
    return {"prompt_i": i, "pairs": pairs}


@router.get("/answer/{aid}")
def answer(aid: int):
    con = _con()
    a = con.execute("SELECT * FROM answers WHERE id=?", (aid,)).fetchone()
    con.close()
    if not a:
        raise HTTPException(404, "answer not found")
    return dict(a)


@router.get("/tiers")
def tiers():
    con = _con()
    t = _rows(con.execute("SELECT * FROM tiers"))
    pairs = _rows(con.execute("SELECT * FROM pairs"))
    con.close()
    order = {"small": 0, "medium": 1, "large": 2}
    t.sort(key=lambda r: order.get(r["tier"], 9))
    return {"tiers": t, "pairs": pairs}


@router.get("/categories")
def categories():
    con = _con()
    rows = _rows(con.execute("SELECT * FROM categories ORDER BY lg_div DESC"))
    con.close()
    return {"categories": rows}


@router.get("/models")
def models():
    con = _con()
    m = _rows(con.execute("SELECT * FROM models"))
    pairs = _rows(con.execute("SELECT * FROM pairs"))
    con.close()
    return {"models": m, "pairs": pairs}


@router.get("/divergence")
def divergence(order: str = Query("desc", pattern="^(asc|desc)$"), tier: str = "large", limit: int = 30):
    col = {"small": "sm_div", "medium": "md_div", "large": "lg_div"}.get(tier, "lg_div")
    con = _con()
    rows = _rows(con.execute(
        f"SELECT i,category,prompt,{col} AS div FROM prompts WHERE {col} IS NOT NULL "
        f"ORDER BY {col} {order.upper()} LIMIT ?", (limit,)))
    con.close()
    return {"tier": tier, "order": order, "prompts": rows}


@router.get("/quality")
def quality():
    con = _con()
    models = _rows(con.execute(
        "SELECT name,tier,mean_quality,mean_len,n FROM models WHERE mean_quality IS NOT NULL "
        "ORDER BY mean_quality DESC"))
    cats = _rows(con.execute("SELECT name,sm_qual,md_qual,lg_qual FROM categories ORDER BY lg_qual DESC"))
    top = _rows(con.execute(
        "SELECT i,category,prompt,avg_quality FROM prompts WHERE avg_quality IS NOT NULL ORDER BY avg_quality DESC LIMIT 15"))
    bottom = _rows(con.execute(
        "SELECT i,category,prompt,avg_quality FROM prompts WHERE avg_quality IS NOT NULL ORDER BY avg_quality ASC LIMIT 15"))
    con.close()
    return {"model_leaderboard": models, "by_category": cats, "most_accurate": top, "least_accurate": bottom}


@router.get("/vectoring")
def vectoring(proj: str = Query("umap", pattern="^(pca|umap)$")):
    """Same nodes as constellation — front-end uses this tab for embedding-space exploration."""
    return constellation(proj, "", 26000, "")


ALGORITHMS = [
    {"id": "category", "name": "Category (ground truth)", "family": "label", "computed": False},
    {"id": "tier", "name": "Tier", "family": "label", "computed": False},
    {"id": "model", "name": "Model", "family": "label", "computed": False},
    {"id": "louvain", "name": "Louvain (modularity)", "family": "community", "computed": True},
    {"id": "gravity", "name": "Gravity (k-medoid)", "family": "concentration", "computed": True},
    {"id": "kmeans", "name": "K-means (centroid)", "family": "centroid", "computed": True},
    {"id": "spectral", "name": "Spectral", "family": "spectral", "computed": True},
    {"id": "hdbscan", "name": "HDBSCAN (density)", "family": "density", "computed": True},
    {"id": "agglomerative", "name": "Agglomerative (Ward)", "family": "hierarchical", "computed": True},
]


@router.get("/algorithms")
def algorithms():
    con = _con()
    have = {r["algorithm"] for r in con.execute("SELECT DISTINCT algorithm FROM clusters")}
    con.close()
    return {"algorithms": [a for a in ALGORITHMS if not a["computed"] or a["id"] in have]}


def _has_fts(con):
    return bool(con.execute("SELECT 1 FROM sqlite_master WHERE name='search_fts'").fetchone())


@router.get("/search")
def search(q: str = "", scope: str = Query("both", pattern="^(prompt|answer|both)$"),
           tier: str = "", category: str = "", model: str = "", min_quality: float = 0.0,
           page: int = 0, size: int = 50):
    """Full-text search over prompts AND/OR answers, filtered + paginated. Uses FTS5 when present
    (scales to 100K); falls back to LIKE otherwise."""
    con = _con(); fts = _has_fts(con)
    sel = ("SELECT a.id, a.prompt_i, a.model, a.tier, a.category, a.length, a.quality, "
           "substr(a.text,1,240) AS snippet, p.prompt FROM answers a JOIN prompts p ON a.prompt_i=p.i")
    cnt = "SELECT COUNT(*) n FROM answers a JOIN prompts p ON a.prompt_i=p.i"
    where: list = []; args: list = []
    if tier: where.append("a.tier=?"); args.append(tier)
    if category: where.append("a.category=?"); args.append(category)
    if model: where.append("a.model=?"); args.append(model)
    if min_quality: where.append("a.quality>=?"); args.append(min_quality)
    if q.strip():
        if fts:
            terms = " ".join(f'"{t}"' for t in q.replace('"', " ").split() if t)
            match = f"answer:({terms})" if scope == "answer" else f"prompt:({terms})" if scope == "prompt" else terms
            sel += " JOIN search_fts f ON f.node_id=a.id"; cnt += " JOIN search_fts f ON f.node_id=a.id"
            where.append("search_fts MATCH ?"); args.append(match)
        else:
            col = "p.prompt" if scope == "prompt" else "a.text"
            where.append(f"{col} LIKE ?"); args.append(f"%{q}%")
    wsql = (" WHERE " + " AND ".join(where)) if where else ""
    try:
        rows = _rows(con.execute(sel + wsql + " ORDER BY a.quality DESC LIMIT ? OFFSET ?", (*args, size, page * size)))
        total = con.execute(cnt + wsql, args).fetchone()["n"]
    except Exception:
        con.close(); raise HTTPException(400, "invalid search query")
    con.close()
    return {"results": rows, "total": total, "page": page, "size": size, "fts": fts}


@router.get("/cluster_members")
def cluster_members(algorithm: str, cluster: int, page: int = 0, size: int = 60):
    con = _con()
    meta = con.execute("SELECT * FROM cluster_meta WHERE algorithm=? AND cluster_id=?", (algorithm, cluster)).fetchone()
    rows = _rows(con.execute(
        "SELECT a.id, a.prompt_i, a.model, a.tier, a.category, a.length, a.quality, substr(a.text,1,200) AS snippet, p.prompt "
        "FROM clusters cl JOIN answers a ON cl.node_id=a.id JOIN prompts p ON a.prompt_i=p.i "
        "WHERE cl.algorithm=? AND cl.cluster_id=? ORDER BY a.quality DESC NULLS LAST LIMIT ? OFFSET ?",
        (algorithm, cluster, size, page * size)))
    con.close()
    if meta is None:
        raise HTTPException(404, "cluster not found")
    return {"meta": dict(meta), "members": rows, "page": page, "size": size}


@router.get("/cluster_edges")
def cluster_edges(algorithm: str):
    con = _con()
    rows = _rows(con.execute("SELECT a, b, weight FROM cluster_edges WHERE algorithm=? ORDER BY weight DESC", (algorithm,)))
    con.close()
    return {"algorithm": algorithm, "edges": rows}


@router.get("/clusters")
def clusters(algorithm: str):
    """node_id→cluster assignment + per-cluster metadata (size, medoid, cohesion, coupling, color, centroid)."""
    con = _con()
    rows = con.execute("SELECT node_id, cluster_id FROM clusters WHERE algorithm=? ORDER BY node_id",
                       (algorithm,)).fetchall()
    meta = _rows(con.execute("SELECT * FROM cluster_meta WHERE algorithm=? ORDER BY size DESC", (algorithm,)))
    con.close()
    if not rows:
        raise HTTPException(404, f"algorithm '{algorithm}' not computed")
    return {"algorithm": algorithm, "assignments": [r["cluster_id"] for r in rows], "chunks": meta}

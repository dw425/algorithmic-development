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
def constellation(proj: str = Query("umap", pattern="^(pca|umap)$")):
    """All answer nodes with coords + every encodable metric (no text — kept light)."""
    con = _con()
    xc, yc = (("umap_x", "umap_y") if proj == "umap" else ("pca_x", "pca_y"))
    rows = _rows(con.execute(
        f"SELECT id,prompt_i,model,tier,category,length,quality,{xc} AS x,{yc} AS y FROM answers"))
    cats = [r["name"] for r in con.execute("SELECT name FROM categories ORDER BY name")]
    models = [dict(r) for r in con.execute("SELECT name,tier FROM models")]
    con.close()
    return {"proj": proj, "nodes": rows, "categories": cats, "models": models,
            "tiers": ["small", "medium", "large"]}


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
    return constellation(proj)

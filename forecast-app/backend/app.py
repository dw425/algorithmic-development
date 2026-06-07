"""Algorithmic Forecasting — backend (Phase 1 scaffold, built fresh from MASTER_BUILD_PLAN).
Endpoints are added one gated phase at a time; nothing here is trusted until its phase passes."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

import numpy as np

import data
import prep
import engine
import spatial

app = FastAPI(title="Algorithmic Forecasting")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


@app.get("/health")
def health():
    return {"status": "ok", "phase": 1}


@app.get("/api/universe")
def api_universe():
    u = data.universe()
    return {"tickers": u, "n": len(u)}


@app.get("/api/clean")
def api_clean(ticker: str, interval: str = "1d", k: float = 3.0):
    """C1 — validate + impute + Hampel-flag a series."""
    rows = data.fetch(ticker, interval=interval)["rows"]
    v = prep.validate(rows)
    closes = [r["close"] for r in v["clean"]]
    p, flags = prep.impute_and_flag(closes, k=k)
    out = [{"date": v["clean"][i]["date"], "close": round(float(p[i]), 2), "flag": bool(flags[i])}
           for i in range(len(p))]
    return {"ticker": ticker, "n_quarantined": v["n_quarantined"], "benford": v["benford"],
            "hampel_outliers": int(flags.sum()), "k": k, "rows": out}


@app.get("/api/stationarity")
def api_stationarity(ticker: str, interval: str = "1d"):
    """C2 — ADF/KPSS + STL decomposition."""
    rows = data.fetch(ticker, interval=interval)["rows"]
    closes = [r["close"] for r in rows]
    dates = [r["date"] for r in rows]
    return {"ticker": ticker, "dates": dates, "close": closes,
            "stationarity": prep.stationarity(closes), "stl": prep.stl_decompose(closes)}


@app.get("/api/multiscale")
def api_multiscale(ticker: str, interval: str = "1d"):
    """C3 — resolution ladder."""
    rows = data.fetch(ticker, interval=interval)["rows"]
    closes = [r["close"] for r in rows]
    return {"ticker": ticker, "ladder": engine.scale_ladder(closes)}


@app.get("/api/predictability")
def api_predictability(ticker: str, interval: str = "1d"):
    """C4 — Hurst/Lyapunov/Takens."""
    rows = data.fetch(ticker, interval=interval)["rows"]
    closes = [r["close"] for r in rows]
    return {"ticker": ticker, "predictability": engine.predictability(closes),
            "takens": engine.takens(closes)}


@app.get("/api/models")
def api_models(ticker: str, interval: str = "1d", win: int = 60):
    """C5 — per-model 1-step forecasts + rho matrix."""
    rows = data.fetch(ticker, interval=interval)["rows"]
    p = [r["close"] for r in rows]
    dates = [r["date"] for r in rows]
    fc = {m: [] for m in engine.MODELS}
    fdates, actual = [], []
    for i in range(win, len(p)):
        mp = engine.model_forecasts(p[i - win:i])
        for m in engine.MODELS:
            fc[m].append(round(mp[m], 2))
        fdates.append(dates[i]); actual.append(p[i])
    return {"ticker": ticker, "dates": fdates, "actual": actual, "forecasts": fc,
            "rho": engine.rho_matrix(np.array(p, float))}


@app.get("/api/forecast")
def api_forecast(ticker: str, target: float = 0.70, interval: str = "1d",
                 eval_start: str = "2025-01-01", eval_end: str = "2026-01-01"):
    """C7+C8 — conformal+ACI range with debiasing."""
    rows = data.fetch(ticker, interval=interval)["rows"]
    res = engine.forecast_walkforward(rows, target=target, eval_start=eval_start, eval_end=eval_end)
    res["ticker"] = ticker
    return res


@app.get("/api/horizons")
def api_horizons(ticker: str, target: float = 0.70, interval: str = "1d"):
    """C9 — multi-horizon 7/30/90."""
    rows = data.fetch(ticker, interval=interval)["rows"]
    return {"ticker": ticker, "horizons": engine.multi_horizon(rows, target=target)}


@app.get("/api/cloud")
def api_cloud(ticker: str, interval: str = "1d"):
    """C10 — vector grid histogram."""
    rows = data.fetch(ticker, interval=interval)["rows"]
    p = np.array([r["close"] for r in rows], float)
    cloud = engine.build_cloud(p[:300] if len(p) > 300 else p)
    counts, edges = np.histogram(cloud, bins=40)
    return {"ticker": ticker, "n_vectors": engine.N_VECTORS, "n_used": int(len(cloud)),
            "hist_counts": [int(x) for x in counts], "hist_edges": [round(float(x), 2) for x in edges],
            "last": round(float(p[-1]), 2)}


@app.get("/api/geoconsensus")
def api_geo(ticker: str, interval: str = "1d"):
    """C11-C15 — 3D embed → clustering → consensus → Mahalanobis → constellation."""
    rows = data.fetch(ticker, interval=interval)["rows"]
    p = np.array([r["close"] for r in rows], float)
    out = spatial.geo_consensus(p[:300] if len(p) > 300 else p)
    out["ticker"] = ticker
    return out


@app.get("/api/louvain")
def api_louvain(tickers: str):
    """C16 — Louvain data-gravity communities + cluster-to-cluster dependency."""
    tk = [t.strip().upper() for t in tickers.split(",") if t.strip()][:50]
    return spatial.louvain_map(tk)

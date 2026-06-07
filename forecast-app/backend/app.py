"""Algorithmic Forecasting — backend (Phase 1 scaffold, built fresh from MASTER_BUILD_PLAN).
Endpoints are added one gated phase at a time; nothing here is trusted until its phase passes."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

import numpy as np

import data
import prep
import engine

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

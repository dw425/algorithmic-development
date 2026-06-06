"""FastAPI backend: fetch data, run the forecasting engine, return JSON."""
import json

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

import data
import engine
import engine_vectors
import gravity
import tpa

app = FastAPI(title="Range Forecast Engine")
app.add_middleware(
    CORSMiddleware, allow_origins=["*"],
    allow_methods=["*"], allow_headers=["*"],
)


@app.get("/api/stocks")
def stocks():
    return {"tickers": data.TICKERS}


@app.post("/api/run")
def run(body: dict):
    ticker = body["ticker"]
    target = float(body.get("target", 0.70))
    d = data.fetch(ticker)
    res = engine.run_walkforward(d["rows"], target=target)
    res["ticker"] = ticker
    return res


@app.post("/api/run_vectors")
def run_vectors(body: dict):
    ticker = body["ticker"]
    target = float(body.get("target", 0.70))
    d = data.fetch(ticker)
    res = engine_vectors.run_walkforward(d["rows"], target=target)
    res["ticker"] = ticker
    return res


@app.get("/api/walkthrough")
def walkthrough(ticker: str, target: float = 0.70):
    d = data.fetch(ticker)
    res = engine_vectors.walkthrough(d["rows"], target=target)
    res["ticker"] = ticker
    return res


@app.get("/api/forecast")
def forecast(ticker: str, target: float = 0.70):
    import os
    path = os.path.join(os.path.dirname(__file__), "cache", f"forecast_{ticker}.json")
    if os.path.exists(path):
        with open(path) as f:
            return json.load(f)
    d = data.fetch(ticker)
    res = engine_vectors.run_walkforward(d["rows"], target=target)
    res["ticker"] = ticker
    with open(path, "w") as f:
        json.dump(res, f)
    return res


@app.get("/api/tpa")
def tpa_endpoint(ticker: str, m: int = 100, c: float = 0.001,
                 eval_start: str = "2025-01-01", eval_end: str = "2026-01-01"):
    res = tpa.tpa_for_ticker(ticker, m=m, c=c, eval_start=eval_start, eval_end=eval_end)
    res["ticker"] = ticker
    return res


@app.get("/api/constellation")
def constellation(tickers: str, eval_start: str = "2025-01-01", eval_end: str = "2026-01-01"):
    tk = [t.strip().upper() for t in tickers.split(",") if t.strip()][:50]
    return gravity.constellation(tk, eval_start, eval_end)


@app.get("/api/horizons")
def horizons(ticker: str, target: float = 0.70):
    import os
    path = os.path.join(os.path.dirname(__file__), "cache", f"horizons_{ticker}.json")
    if os.path.exists(path):
        with open(path) as f:
            return json.load(f)
    d = data.fetch(ticker)
    res = engine_vectors.forecast_horizons(d["rows"], target=target)
    res["ticker"] = ticker
    with open(path, "w") as f:
        json.dump(res, f)
    return res


@app.get("/api/run_all_vectors")
def run_all_vectors():
    import os
    path = os.path.join(os.path.dirname(__file__), "cache", "full_results.json")
    if os.path.exists(path):
        with open(path) as f:
            return json.load(f)
    return {"results": [], "target": 70, "status": "precomputing — try again shortly"}


@app.get("/api/run_all")
def run_all(target: float = 0.70):
    out = []
    for t in data.TICKERS:
        try:
            d = data.fetch(t)
            r = engine.run_walkforward(d["rows"], target=target)
            out.append({
                "ticker": t, "coverage": r["coverage"],
                "avg_width_pct": r["avg_width_pct"], "n_eval": r["n_eval"],
                "target": r["target"],
            })
        except Exception as e:  # noqa
            out.append({"ticker": t, "error": str(e)})
    return {"results": out, "target": int(target * 100)}

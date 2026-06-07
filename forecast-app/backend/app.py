"""Algorithmic Forecasting — backend (Phase 1 scaffold, built fresh from MASTER_BUILD_PLAN).
Endpoints are added one gated phase at a time; nothing here is trusted until its phase passes."""
import json
import os

from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware

import numpy as np

import data
import prep
import engine
import spatial
import advanced
import backtest
import zoohub
import ingest
import control
import harmonize
import sample as sampling
import modellab
import platform_nodes
import flow as flowmod
from fastapi import Request

app = FastAPI(title="Algorithmic Forecasting")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


@app.get("/health")
def health():
    return {"status": "ok", "phase": 1}


@app.get("/api/datasets")
def api_datasets():
    """Stage 1 — list ingested datasets + pipeline progress."""
    return {"datasets": ingest.list_datasets(), "pipeline": control.overview()}


@app.post("/api/datasets/upload")
async def api_upload(file: UploadFile = File(...), name: str = Form("")):
    """Stage 1 — upload a CSV/JSON/parquet dataset."""
    raw = await file.read()
    df = ingest.parse_bytes(raw, file.filename or "data.csv")
    meta = ingest.save(df, name or (file.filename or "dataset"), source="upload")
    control.set_stage(meta["id"], "ingest", "done", summary={"rows": meta["rows"], "cols": meta["cols"]})
    return meta


@app.post("/api/datasets/load_builtin")
def api_load_builtin(which: str = "synthetic_series"):
    """Stage 1 — load a ready-made sample dataset (synthetic_series / diabetes / california_housing)."""
    df, nm = ingest.builtin_sample(which)
    meta = ingest.save(df, nm, source="builtin")
    control.set_stage(meta["id"], "ingest", "done", summary={"rows": meta["rows"], "cols": meta["cols"]})
    return meta


@app.post("/api/datasets/load_stock")
def api_load_stock(ticker: str):
    """Stage 1 — pull a stock series into the dataset pipeline."""
    df = ingest.from_stock(ticker.upper())
    meta = ingest.save(df, f"{ticker.upper()}_prices", source="stock")
    control.set_stage(meta["id"], "ingest", "done", summary={"rows": meta["rows"], "cols": meta["cols"]})
    return meta


@app.get("/api/datasets/{sid}/rows")
def api_rows(sid: str, limit: int = 2000):
    """Rows for the reactive Explore workspace (sampled if large)."""
    df = ingest.load(sid)
    if df is None:
        return {"error": "not found"}
    prof = ingest.profile(df)
    d = df.head(limit) if len(df) <= limit else df.sample(limit, random_state=0).sort_index()
    return {"id": sid, "n": int(len(df)), "shown": int(len(d)),
            "numeric_columns": prof["numeric_columns"], "columns": [c["name"] for c in prof["columns"]],
            "rows": json.loads(d.to_json(orient="records"))}


@app.get("/api/datasets/{sid}/profile")
def api_profile(sid: str):
    """Stage 1/2 — parse + profile a dataset (schema, dtypes, missing, candidate time/target)."""
    df = ingest.load(sid)
    if df is None:
        return {"error": "not found"}
    prof = ingest.profile(df)
    control.set_stage(sid, "profile", "done", summary={"missing_pct": prof["missing_total_pct"],
                                                        "target": prof["target_candidate"]})
    return {"id": sid, **prof}


@app.get("/api/pipeline/{sid}")
def api_pipeline(sid: str):
    """The logical control plane state for a dataset."""
    return {"id": sid, "stages": control.get(sid)}


@app.post("/api/datasets/{sid}/harmonize")
def api_harmonize(sid: str, missing: str = "mean", outliers: str = "hampel", hampel_k: float = 3.0,
                  normalize: str = "none", encode: str = "none"):
    """Stage 3 — condition the dataset; saves a conditioned copy {sid}_cond."""
    df = ingest.load(sid)
    if df is None:
        return {"error": "not found"}
    cfg = {"missing": missing, "outliers": outliers, "hampel_k": hampel_k,
           "normalize": normalize, "encode": encode}
    out, report = harmonize.condition(df, cfg)
    meta = ingest.save(out, f"{sid}_cond", source=f"harmonized:{sid}")
    control.set_stage(sid, "harmonize", "done", config=cfg, summary=report["after"])
    return {"id": sid, "output_id": meta["id"], **report, "preview": json.loads(out.head(12).to_json(orient="records"))}


@app.post("/api/datasets/{sid}/sample")
def api_sample(sid: str, method: str = "time", test_size: float = 0.2, folds: int = 5,
               embargo: int = 0, by: str = "", seed: int = 0):
    """Stage 4 — build a sampling plan (split preview)."""
    df = ingest.load(sid)
    if df is None:
        return {"error": "not found"}
    cfg = {"method": method, "test_size": test_size, "folds": folds, "embargo": embargo,
           "by": by or None, "seed": seed}
    plan = sampling.make_split(df, cfg)
    control.set_stage(sid, "sample", "done", config=cfg, summary={"method": method})
    return {"id": sid, "n": int(len(df)), "plan": plan}


@app.post("/api/datasets/{sid}/forecast")
def api_dataset_forecast(sid: str, target: str, time: str = "", target_coverage: float = 0.70):
    """Stage 6 — run the forecasting engine on ANY prepped dataset's target column (calibrated
    conformal range + next-step point), not just stock data."""
    df = ingest.load(sid)
    if df is None:
        return {"error": "not found"}
    if target not in df.columns:
        return {"error": f"target '{target}' not in columns"}
    import pandas as pd
    y = pd.to_numeric(df[target], errors="coerce").ffill().fillna(0.0).to_numpy(float)
    n = len(y)
    if n < 60:
        return {"error": "need >=60 rows to forecast"}
    if time and time in df.columns:
        dts = pd.to_datetime(df[time], errors="coerce")
        dates = [d.strftime("%Y-%m-%d") if not pd.isna(d) else None for d in dts]
        if any(d is None for d in dates):
            dates = None
    else:
        dates = None
    if not dates:                                     # synthetic daily calendar for undated data
        dates = [d.strftime("%Y-%m-%d") for d in pd.date_range("2018-01-01", periods=n, freq="D")]
    rows = [{"date": dates[i], "close": float(y[i])} for i in range(n)]
    eval_start = dates[int(n * 0.6)]
    res = engine.forecast_walkforward(rows, target=target_coverage, eval_start=eval_start,
                                      eval_end="2999-01-01", win=engine_param_win(), recent=120, debias=True)
    # next-step point (naive-anchored), same recipe as the Predictions stage
    w = y[-60:]
    fast_mean = float(np.mean([engine.MODELS[m](w) for m in engine.FAST]))
    nxt = round(0.8 * float(y[-1]) + 0.2 * fast_mean, 4)
    res.update({"id": sid, "target": target, "next_point": nxt, "last_value": round(float(y[-1]), 4)})
    if res.get("n_eval", 0) > 0:
        control.set_stage(sid, "forecast", "done", config={"target": target, "coverage": target_coverage},
                          summary={"coverage": res["coverage"], "width_pct": res["avg_width_pct"]})
    return res


def engine_param_win():
    return 60


@app.post("/api/datasets/{sid}/model")
def api_model_run(sid: str, model: str, target: str, test_size: float = 0.2, ordered: bool = True):
    """Stage 5 — fit a Zoo model on the dataset and score it."""
    df = ingest.load(sid)
    if df is None:
        return {"error": "not found"}
    res = modellab.run(df, model, target, test_size=test_size, ordered=ordered)
    if "metrics" in res:
        control.set_stage(sid, "model", "done", config={"model": model, "target": target},
                          summary=res["metrics"])
    return {"id": sid, **res}


@app.get("/api/nodes")
def api_nodes():
    """The node palette for the drag-and-drop canvas (typed ports + params per node type)."""
    return {"nodes": platform_nodes.palette(), "zoo_models": platform_nodes.list_zoo()}


@app.post("/api/flow/run")
async def api_flow_run(request: Request):
    """Execute a wired flow {nodes, edges} as a DAG; return per-node status + summaries."""
    graph = await request.json()
    return flowmod.run_flow(graph)


_FLOWS = os.path.join(os.path.dirname(__file__), "datasets", "_flows.json")


@app.get("/api/flows")
def api_flows_list():
    return json.load(open(_FLOWS)) if os.path.exists(_FLOWS) else {}


@app.post("/api/flows/save")
async def api_flows_save(request: Request):
    body = await request.json()
    name = body.get("name", "untitled")
    allf = json.load(open(_FLOWS)) if os.path.exists(_FLOWS) else {}
    allf[name] = body.get("graph", {})
    json.dump(allf, open(_FLOWS, "w"))
    return {"saved": name, "count": len(allf)}


@app.get("/api/zoo/models")
def api_zoo_models():
    """Project Zoo model registry — every statistical model available in the Model Lab."""
    if not zoohub.available():
        return {"available": False, "models": [], "n": 0}
    try:
        cat = zoohub.model_catalog()
        fams: dict[str, int] = {}
        for m in cat:
            fams[m["family"]] = fams.get(m["family"], 0) + 1
        return {"available": True, "n": len(cat), "families": fams, "models": cat}
    except Exception as e:  # noqa - surface load errors instead of crashing the app
        return {"available": False, "error": str(e)[:200], "models": [], "n": 0}


@app.get("/api/universe")
def api_universe():
    u = data.universe()
    return {"tickers": u, "n": len(u)}


@app.get("/api/clean")
def api_clean(ticker: str, interval: str = "1d", k: float = 3.0, win: int = 7):
    """C1 — validate + impute + Hampel-flag a series."""
    rows = data.fetch(ticker, interval=interval)["rows"]
    v = prep.validate(rows)
    closes = [r["close"] for r in v["clean"]]
    p, flags = prep.impute_and_flag(closes, k=k, win=win)
    out = [{"date": v["clean"][i]["date"], "close": round(float(p[i]), 2), "flag": bool(flags[i])}
           for i in range(len(p))]
    return {"ticker": ticker, "n_quarantined": v["n_quarantined"], "benford": v["benford"],
            "hampel_outliers": int(flags.sum()), "k": k, "rows": out}


@app.get("/api/stationarity")
def api_stationarity(ticker: str, interval: str = "1d", period: int = 21):
    """C2 — ADF/KPSS + STL decomposition."""
    rows = data.fetch(ticker, interval=interval)["rows"]
    closes = [r["close"] for r in rows]
    dates = [r["date"] for r in rows]
    return {"ticker": ticker, "dates": dates, "close": closes,
            "stationarity": prep.stationarity(closes), "stl": prep.stl_decompose(closes, period=period)}


@app.get("/api/multiscale")
def api_multiscale(ticker: str, interval: str = "1d", scales: str = "1,2,5,10,21"):
    """C3 — resolution ladder. Each scale is aligned to the common date axis so coarse scales
    span the full period (fewer, smoother points) instead of dropping off early."""
    rows = data.fetch(ticker, interval=interval)["rows"]
    closes = [r["close"] for r in rows]
    dates = [r["date"] for r in rows]
    sc = tuple(int(x) for x in scales.split(",") if x.strip().isdigit()) or (1, 2, 5, 10, 21)
    ladder = engine.scale_ladder(closes, scales=sc)
    n_all = len(closes)
    ladder_x = {}
    for s_str, vals in ladder.items():
        s = int(s_str)
        nn = len(vals)
        start = max(0, n_all - nn * s)
        ladder_x[s_str] = [dates[min(n_all - 1, start + j * s + s // 2)] for j in range(nn)]
    return {"ticker": ticker, "ladder": ladder, "ladder_x": ladder_x}


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
                 eval_start: str = "2025-01-01", eval_end: str = "2026-01-01",
                 win: int = 60, recent: int = 120, debias: bool = True):
    """C7+C8 — conformal+ACI range with debiasing."""
    rows = data.fetch(ticker, interval=interval)["rows"]
    res = engine.forecast_walkforward(rows, target=target, eval_start=eval_start, eval_end=eval_end,
                                      win=win, recent=recent, debias=debias)
    res["ticker"] = ticker
    return res


@app.get("/api/horizons")
def api_horizons(ticker: str, target: float = 0.70, interval: str = "1d", horizons: str = "7,30,90"):
    """C9 — multi-horizon 7/30/90 (configurable)."""
    rows = data.fetch(ticker, interval=interval)["rows"]
    hz = tuple(int(x) for x in horizons.split(",") if x.strip().isdigit()) or (7, 30, 90)
    return {"ticker": ticker, "horizons": engine.multi_horizon(rows, target=target, horizons=hz)}


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


@app.get("/api/runs")
def api_runs():
    """Tier 7 — browse the batch run results + held-out summary."""
    import os
    p = os.path.join(os.path.dirname(__file__), "run_results.json")
    if not os.path.exists(p):
        return {"summary": {"n": 0}, "rows": [], "status": "running"}
    try:
        d = json.load(open(p))
    except Exception:  # noqa - file may be mid-write by the batch runner
        return {"summary": {"n": 0}, "rows": [], "status": "running"}
    rows = [{"ticker": k, **{m: v.get(m) for m in ("coverage", "avg_width_pct", "naive_lift_pct", "n_eval")}}
            for k, v in d.items() if isinstance(v, dict) and v.get("ok")]
    rows.sort(key=lambda r: -(r.get("coverage") or 0))
    cov = [r["coverage"] for r in rows]
    lift = [r["naive_lift_pct"] for r in rows]
    summary = {"n": len(rows),
               "mean_coverage": round(float(np.mean(cov)), 1) if cov else 0,
               "mean_naive_lift": round(float(np.mean(lift)), 2) if lift else 0,
               "pct_beating_naive": round(float(np.mean([x > 0 for x in lift])) * 100, 1) if lift else 0}
    return {"summary": summary, "rows": rows[:500]}


@app.get("/api/funnel")
def api_funnel(ticker: str, interval: str = "1d"):
    """C18 — vector drop-off funnel."""
    p = np.array([r["close"] for r in data.fetch(ticker, interval=interval)["rows"]], float)
    return {"ticker": ticker, "funnel": advanced.funnel(p[:300] if len(p) > 300 else p)}


@app.get("/api/tpa")
def api_tpa(ticker: str, interval: str = "1d", m: int = 100, c: float = 0.001):
    """C21 — Threaded Point Analysis (fan width m, offset step c)."""
    out = advanced.tpa(data.fetch(ticker, interval=interval)["rows"], m=m, c=c)
    out["ticker"] = ticker
    return out


@app.get("/api/predictions_all")
def api_predictions_all():
    """Next-step prediction for the ENTIRE cached universe (precomputed batch). Powers the
    Universe page so all ~1,100 stocks are loaded with detail, searchable + sortable."""
    p = os.path.join(os.path.dirname(__file__), "predictions_all.json")
    if not os.path.exists(p):
        return {"n": 0, "rows": [], "status": "computing"}
    try:
        d = json.load(open(p))
    except Exception:  # noqa - file may be mid-write by the batch
        return {"n": 0, "rows": [], "status": "computing"}
    rows = [{"ticker": k, **{m: v.get(m) for m in
             ("last_date", "last_close", "point", "lo", "hi", "move_pct", "range_pct", "cloud_consensus")}}
            for k, v in d.items() if isinstance(v, dict) and v.get("ok")]
    rows.sort(key=lambda r: r["ticker"])
    return {"n": len(rows), "rows": rows}


@app.get("/api/predict")
def api_predict(ticker: str, target: float = 0.70, interval: str = "1d",
                win: int = 60, recent: int = 120, debias: bool = True):
    """Forward next-step prediction (beyond the last bar): naive-anchored point + calibrated
    band + 1,980-vector cloud consensus + per-model votes. This is the 'what's the forecast
    for tomorrow's close' mapping."""
    rows = data.fetch(ticker, interval=interval)["rows"]
    p = np.array([r["close"] for r in rows], float)
    dates = [r["date"] for r in rows]
    n = len(p)
    last = float(p[-1])
    min_hist = 40
    w = p[-win:]
    votes = {m: round(float(engine.MODELS[m](w)), 2) for m in engine.MODELS}
    fast_mean = float(np.mean([engine.MODELS[m](w) for m in engine.FAST]))
    raw_point = 0.8 * last + 0.2 * fast_mean
    # calibrated band from recent in-sample residuals of the same naive-anchored point
    ens = np.full(n, np.nan)
    for i in range(min_hist, n):
        ww = p[max(0, i - win):i]
        ens[i] = 0.8 * ww[-1] + 0.2 * float(np.mean([engine.MODELS[m](ww) for m in engine.FAST]))
    rel = (p - ens) / ens
    cal = rel[max(min_hist, n - recent):n]
    cal = cal[np.isfinite(cal)]
    a0 = 1 - target
    if len(cal) >= 20:
        bias = float(np.mean(cal)) if debias else 0.0
        point = raw_point * (1 + bias)
        c = cal - bias
        qlo, qhi = float(np.quantile(c, a0 / 2)), float(np.quantile(c, 1 - a0 / 2))
        lo, hi = point * (1 + qlo), point * (1 + qhi)
    else:
        bias, point, lo, hi = 0.0, raw_point, raw_point * 0.97, raw_point * 1.03
    cloud = engine.build_cloud(p)
    counts, edges = np.histogram(cloud, bins=40)
    pk = int(np.argmax(counts))
    consensus = float((edges[pk] + edges[pk + 1]) / 2)
    return {"ticker": ticker, "last_date": dates[-1], "last_close": round(last, 2),
            "point": round(point, 2), "lo": round(lo, 2), "hi": round(hi, 2),
            "move_pct": round((point - last) / last * 100, 2),
            "target": int(target * 100), "bias_pct": round(bias * 100, 3),
            "votes": votes, "cloud_consensus": round(consensus, 2), "n_vectors": int(len(cloud)),
            "hist_counts": [int(x) for x in counts], "hist_edges": [round(float(x), 2) for x in edges],
            "recent_dates": dates[-30:], "recent_close": [round(float(x), 2) for x in p[-30:]]}


@app.get("/api/backtest")
def api_backtest(ticker: str, dates: str, interval: str = "1d",
                 horizons: str = "1,7,30,90", target: float = 0.70):
    """Anchor at each origin date, forecast 1/7/30/90 days ahead, compare to actuals + inverse-drift
    rating. dates = csv of YYYY-MM-DD origins."""
    rows = data.fetch(ticker, interval=interval)["rows"]
    hz = tuple(int(x) for x in horizons.split(",") if x.strip().isdigit()) or (1, 7, 30, 90)
    ds = [d.strip() for d in dates.split(",") if d.strip()]
    origins = [r for d in ds if (r := backtest.predict_from(rows, d, horizons=hz, target=target))]
    # inverse-drift rating on the prediction cloud (C17)
    p = np.array([r["close"] for r in rows], float)
    cloud = engine.build_cloud(p)
    cons = float(np.median(cloud)) if len(cloud) else float(p[-1])
    inv = advanced.inverse_drift(cloud, cons) if len(cloud) else {}
    # accuracy aggregated by horizon across the chosen dates
    by_h = {}
    for o in origins:
        for r in o["horizons"]:
            if r.get("available"):
                by_h.setdefault(r["h"], []).append(r)
    acc = {str(h): {"mae_pct": round(float(np.mean([x["abs_error_pct"] for x in v])), 2),
                    "accuracy_pct": round(float(np.mean([x["accuracy_pct"] for x in v])), 2),
                    "hit_rate_pct": round(100 * float(np.mean([x["hit"] for x in v])), 1),
                    "beats_naive_pct": round(100 * float(np.mean([x["beats_naive"] for x in v])), 1),
                    "n": len(v)} for h, v in sorted(by_h.items())}
    series = [{"date": r["date"], "close": round(float(r["close"]), 2)}
              for r in rows if r["date"] >= "2025-01-01"]
    return {"ticker": ticker, "origins": origins, "accuracy_by_horizon": acc,
            "inverse_drift": inv, "consensus": round(cons, 2), "series": series}


@app.get("/api/diagnostics")
def api_diagnostics(ticker: str, target: float = 0.70, interval: str = "1d"):
    """C17 net-results + C19 MCS + C20 calibration + C22 outward eye."""
    rows = data.fetch(ticker, interval=interval)["rows"]
    p = np.array([r["close"] for r in rows], float)
    pp = p[:300] if len(p) > 300 else p
    g = spatial.geo_consensus(pp)
    vals, _, _ = spatial.geo_cloud(pp)
    net = advanced.net_results(vals, g.get("forecast", float(np.median(vals)))) if len(vals) else {}
    win = 60
    loss = {m: [] for m in engine.MODELS}
    for i in range(win, len(p)):
        mp = engine.model_forecasts(p[i - win:i])
        for m in engine.MODELS:
            loss[m].append(abs((mp[m] - p[i]) / p[i]))
    surv = advanced.model_confidence_set({m: np.array(v) for m, v in loss.items()}, margin=1.5)
    fc = engine.forecast_walkforward(rows, target=target)
    return {"ticker": ticker, "net_results": net, "mcs_survivors": surv,
            "mcs_pool": len(engine.MODELS), "calibration": advanced.reliability(fc["rows"], target),
            "outward": advanced.outward_eye(rows)}

"""Node registry for the drag-and-drop platform. Each node = typed ports + params + a run fn that
wraps the already-verified backend (ingest / harmonize / sample / modellab / forecast / zoohub /
engine). The executor (flow.py) wires these together into a DAG."""
import numpy as np
import pandas as pd

import ingest
import harmonize
import sample as sampling
import modellab
import engine
import zoohub

# wire types: dataset · split · model · forecast · metrics
NODE_DEFS = {
    "source.sample": {"category": "Sources", "label": "Sample dataset", "color": "#2dd4bf",
        "inputs": [], "outputs": [{"name": "data", "type": "dataset"}],
        "params": [{"name": "which", "type": "select", "options": ["synthetic_series", "diabetes"], "default": "synthetic_series"}]},
    "source.stock": {"category": "Sources", "label": "Stock series", "color": "#2dd4bf",
        "inputs": [], "outputs": [{"name": "data", "type": "dataset"}],
        "params": [{"name": "ticker", "type": "text", "default": "AAPL"}]},
    "transform.condition": {"category": "Transform", "label": "Condition", "color": "#3b82f6",
        "inputs": [{"name": "data", "type": "dataset"}], "outputs": [{"name": "data", "type": "dataset"}],
        "params": [{"name": "missing", "type": "select", "options": ["mean", "median", "ffill", "interpolate", "zero", "drop"], "default": "mean"},
                   {"name": "outliers", "type": "select", "options": ["hampel", "winsorize", "none"], "default": "hampel"},
                   {"name": "normalize", "type": "select", "options": ["none", "zscore", "minmax", "robust", "log"], "default": "none"}]},
    "inspect.profile": {"category": "Inspect", "label": "Profile", "color": "#8b5cf6",
        "inputs": [{"name": "data", "type": "dataset"}], "outputs": [{"name": "data", "type": "dataset"}], "params": []},
    "filter.sample": {"category": "Filter", "label": "Sampler", "color": "#22d3ee",
        "inputs": [{"name": "data", "type": "dataset"}], "outputs": [{"name": "data", "type": "dataset"}],
        "params": [{"name": "method", "type": "select", "options": ["time", "rolling_origin", "bootstrap", "stratified", "random"], "default": "time"},
                   {"name": "test_size", "type": "number", "default": 0.2}]},
    "feature.lag": {"category": "Features", "label": "Lag/roll features", "color": "#0ea5e9",
        "inputs": [{"name": "data", "type": "dataset"}], "outputs": [{"name": "data", "type": "dataset"}],
        "params": [{"name": "target", "type": "text", "default": ""},
                   {"name": "lags", "type": "text", "default": "1,2,3"},
                   {"name": "roll", "type": "number", "default": 5}]},
    "model.automl": {"category": "Models", "label": "AutoML leaderboard", "color": "#6366f1",
        "inputs": [{"name": "data", "type": "dataset"}], "outputs": [{"name": "model", "type": "model"}],
        "params": [{"name": "target", "type": "text", "default": ""},
                   {"name": "test_size", "type": "number", "default": 0.2},
                   {"name": "ordered", "type": "bool", "default": False}]},
    "explain.importance": {"category": "Explain", "label": "Importance", "color": "#f0b429",
        "inputs": [{"name": "data", "type": "dataset"}], "outputs": [],
        "params": [{"name": "model", "type": "model_select", "default": "random_forest"},
                   {"name": "target", "type": "text", "default": ""}]},
    "model.zoo": {"category": "Models", "label": "Zoo model", "color": "#6366f1",
        "inputs": [{"name": "data", "type": "dataset"}], "outputs": [{"name": "model", "type": "model"}],
        "params": [{"name": "model", "type": "model_select", "default": "random_forest"},
                   {"name": "target", "type": "text", "default": ""},
                   {"name": "test_size", "type": "number", "default": 0.2},
                   {"name": "ordered", "type": "bool", "default": False}]},
    "ensemble.combine": {"category": "Ensemble", "label": "Ensemble", "color": "#a855f7",
        "inputs": [{"name": "models", "type": "model", "multi": True}], "outputs": [{"name": "model", "type": "model"}],
        "params": [{"name": "method", "type": "select", "options": ["mean", "weighted", "median"], "default": "weighted"}]},
    "forecast.range": {"category": "Forecast", "label": "Conformal forecast", "color": "#22c55e",
        "inputs": [{"name": "data", "type": "dataset"}], "outputs": [{"name": "forecast", "type": "forecast"}],
        "params": [{"name": "target", "type": "text", "default": ""},
                   {"name": "time", "type": "text", "default": ""},
                   {"name": "coverage", "type": "number", "default": 0.7}]},
    "evaluate.metrics": {"category": "Evaluate", "label": "Evaluate", "color": "#f0b429",
        "inputs": [{"name": "model", "type": "model"}], "outputs": [], "params": []},
}


def palette() -> list[dict]:
    out = []
    for t, d in NODE_DEFS.items():
        out.append({"type": t, **{k: d[k] for k in ("category", "label", "color", "inputs", "outputs", "params")}})
    return out


def _df_preview(df: pd.DataFrame) -> dict:
    import json
    return {"rows": int(len(df)), "cols": int(df.shape[1]), "columns": [str(c) for c in df.columns],
            "head": json.loads(df.head(8).to_json(orient="records"))}


def _forecast_on_df(df, target, time, coverage):
    y = pd.to_numeric(df[target], errors="coerce").ffill().fillna(0.0).to_numpy(float)
    n = len(y)
    if n < 60:
        return {"error": "need >=60 rows"}
    if time and time in df.columns:
        dts = pd.to_datetime(df[time], errors="coerce")
        dates = [d.strftime("%Y-%m-%d") if not pd.isna(d) else None for d in dts]
        if any(d is None for d in dates):
            dates = None
    else:
        dates = None
    if not dates:
        dates = [d.strftime("%Y-%m-%d") for d in pd.date_range("2018-01-01", periods=n, freq="D")]
    rows = [{"date": dates[i], "close": float(y[i])} for i in range(n)]
    res = engine.forecast_walkforward(rows, target=coverage, eval_start=dates[int(n * 0.6)], eval_end="2999-01-01")
    return res


def run_node(ntype: str, params: dict, inputs: dict):
    """Run one node. inputs maps port name -> upstream value (or list of values if multi/fan-in).
    Returns (outputs: dict[port->value], summary: dict)."""
    p = params or {}
    if ntype == "source.sample":
        df, nm = ingest.builtin_sample(p.get("which", "synthetic_series"))
        return {"data": df}, {"dataset": nm, **_df_preview(df)}
    if ntype == "source.stock":
        df = ingest.from_stock(str(p.get("ticker", "AAPL")).upper())
        return {"data": df}, {"dataset": p.get("ticker"), **_df_preview(df)}
    if ntype == "transform.condition":
        df = inputs["data"]
        out, rep = harmonize.condition(df, {"missing": p.get("missing", "mean"), "outliers": p.get("outliers", "hampel"),
                                            "hampel_k": 3.0, "normalize": p.get("normalize", "none"), "encode": "none"})
        return {"data": out}, {"before": rep["before"], "after": rep["after"], **_df_preview(out)}
    if ntype == "inspect.profile":
        df = inputs["data"]
        prof = ingest.profile(df)
        return {"data": df}, {"target_candidate": prof["target_candidate"], "missing_pct": prof["missing_total_pct"],
                              "numeric_columns": prof["numeric_columns"], "time_candidates": prof["time_candidates"],
                              "columns": prof["columns"]}
    if ntype == "filter.sample":
        df = inputs["data"]
        plan = sampling.make_split(df, {"method": p.get("method", "time"), "test_size": float(p.get("test_size", 0.2))})
        return {"data": df}, {"plan": plan}
    if ntype == "model.zoo":
        df = inputs["data"]
        target = p.get("target") or (ingest.profile(df)["target_candidate"])
        res = modellab.run(df, p.get("model", "random_forest"), target,
                           test_size=float(p.get("test_size", 0.2)), ordered=bool(p.get("ordered", False)))
        if "error" in res:
            return {"model": None}, {"error": res["error"]}
        return {"model": res}, {"model": res["model"], "target": target, "metrics": res["metrics"],
                                "naive_metrics": res.get("naive_metrics", {})}
    if ntype == "feature.lag":
        df = inputs["data"]
        target = p.get("target") or (ingest.profile(df)["target_candidate"])
        lags = [int(x) for x in str(p.get("lags", "1,2,3")).split(",") if x.strip().lstrip("-").isdigit()]
        out = modellab.add_features(df, target, lags, int(p.get("roll", 5)))
        return {"data": out}, {"added": [c for c in out.columns if c not in df.columns], **_df_preview(out)}
    if ntype == "model.automl":
        df = inputs["data"]
        target = p.get("target") or (ingest.profile(df)["target_candidate"])
        res = modellab.leaderboard(df, target, test_size=float(p.get("test_size", 0.2)), ordered=bool(p.get("ordered", False)))
        best = res.get("best")
        out_model = best if best else None
        return {"model": out_model}, {"leaderboard": res["leaderboard"], "best_model": res["best_model"],
                                      "n_models": res["n_models"], "target": target,
                                      "metrics": best["metrics"] if best else {}}
    if ntype == "explain.importance":
        df = inputs["data"]
        target = p.get("target") or (ingest.profile(df)["target_candidate"])
        res = modellab.importance(df, p.get("model", "random_forest"), target)
        if res.get("error"):
            return {}, {"error": res["error"]}
        return {}, {"model": res["model"], "importances": res["importances"]}
    if ntype == "ensemble.combine":
        mods = inputs.get("models", [])
        if not isinstance(mods, list):
            mods = [mods]
        res = modellab.combine([m for m in mods if m], method=p.get("method", "weighted"))
        if "error" in res:
            return {"model": None}, {"error": res["error"]}
        return {"model": res}, {"members": res["members"], "method": res["method"], "metrics": res["metrics"]}
    if ntype == "forecast.range":
        df = inputs["data"]
        target = p.get("target") or (ingest.profile(df)["target_candidate"])
        res = _forecast_on_df(df, target, p.get("time", ""), float(p.get("coverage", 0.7)))
        if res.get("error"):
            return {"forecast": None}, {"error": res["error"]}
        return {"forecast": res}, {"target": target, "coverage": res["coverage"], "width_pct": res["avg_width_pct"], "n_eval": res["n_eval"]}
    if ntype == "evaluate.metrics":
        mo = inputs.get("model")
        if isinstance(mo, list):
            mo = mo[0] if mo else None
        if not mo:
            return {}, {"error": "no model input"}
        return {}, {"metrics": mo.get("metrics", {}), "model": mo.get("model") or mo.get("method")}
    raise ValueError(f"unknown node type {ntype}")


def list_zoo():
    return zoohub.list_models() if zoohub.available() else []

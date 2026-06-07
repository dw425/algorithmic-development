"""Stage 5 — Model Lab. Fit any Project Zoo model on prepped+split data and score it, so users can
try different methods and compare. Uses the Zoo BasePredictor interface (fit/predict on DataFrames)."""
import numpy as np
import pandas as pd

import zoohub


def _metrics(y_true: np.ndarray, y_pred: np.ndarray) -> dict:
    y_true = np.asarray(y_true, float)
    y_pred = np.asarray(y_pred, float)
    m = np.isfinite(y_true) & np.isfinite(y_pred)
    y_true, y_pred = y_true[m], y_pred[m]
    if len(y_true) < 2:
        return {"n": int(len(y_true))}
    err = y_pred - y_true
    mae = float(np.mean(np.abs(err)))
    rmse = float(np.sqrt(np.mean(err ** 2)))
    ss_res = float(np.sum(err ** 2))
    ss_tot = float(np.sum((y_true - y_true.mean()) ** 2)) or 1e-9
    denom = np.where(y_true != 0, np.abs(y_true), 1e-9)
    return {"n": int(len(y_true)), "mae": round(mae, 4), "rmse": round(rmse, 4),
            "r2": round(1 - ss_res / ss_tot, 4),
            "mape_pct": round(float(np.mean(np.abs(err / denom)) * 100), 2)}


def run(df: pd.DataFrame, model_name: str, target: str, features: list[str] | None = None,
        test_size: float = 0.2, ordered: bool = True) -> dict:
    if target not in df.columns:
        return {"error": f"target '{target}' not in columns"}
    work = df.copy()
    # numeric design matrix only (drop datetimes; coerce the rest)
    if features:
        feat = [f for f in features if f in work.columns and f != target]
    else:
        feat = [c for c in work.columns if c != target and pd.api.types.is_numeric_dtype(work[c])]
    if not feat:
        return {"error": "no usable numeric feature columns"}
    X = work[feat].apply(pd.to_numeric, errors="coerce").fillna(0.0)
    y = pd.to_numeric(work[target], errors="coerce").ffill().fillna(0.0)
    n = len(work)
    cut = int(n * (1 - test_size))
    if not ordered:
        perm = np.random.default_rng(0).permutation(n)
        X, y = X.iloc[perm].reset_index(drop=True), y.iloc[perm].reset_index(drop=True)
    Xtr, Xte = X.iloc[:cut], X.iloc[cut:]
    ytr, yte = y.iloc[:cut], y.iloc[cut:]
    if len(Xte) < 2:
        return {"error": "test split too small"}
    try:
        model = zoohub.get_model(model_name)
        model.fit(Xtr, ytr)
        pred = np.asarray(model.predict(Xte), float).reshape(-1)[:len(yte)]
    except Exception as e:  # noqa - report the failure honestly (e.g. classifier on numeric target)
        return {"error": f"{model_name} failed: {type(e).__name__}: {str(e)[:160]}",
                "model": model_name, "features": feat, "target": target}
    naive = np.full(len(yte), float(ytr.iloc[-1]))
    return {"model": model_name, "target": target, "features": feat,
            "n_train": cut, "n_test": int(len(yte)),
            "metrics": _metrics(yte.to_numpy(), pred),
            "naive_metrics": _metrics(yte.to_numpy(), naive),
            "y_true": [round(float(v), 6) for v in yte.to_numpy()],
            "y_pred": [round(float(v), 6) for v in pred],
            "sample": [{"i": int(i), "actual": round(float(yte.iloc[i]), 4),
                        "pred": round(float(pred[i]), 4)} for i in range(min(60, len(yte)))]}


AUTOML_SET = ["random_forest", "gradient_boosting", "ridge", "lasso", "linear_regression",
              "knn", "svr", "elasticnet", "bayesian_ridge", "naive_drift"]


def leaderboard(df: pd.DataFrame, target: str, models: list[str] | None = None,
                test_size: float = 0.2, ordered: bool = False) -> dict:
    """Run a set of models and rank them — the AutoML node."""
    names = models or AUTOML_SET
    board, best = [], None
    for nm in names:
        r = run(df, nm, target, test_size=test_size, ordered=ordered)
        if "metrics" in r and r["metrics"].get("r2") is not None:
            row = {"model": nm, **r["metrics"]}
            board.append(row)
            if best is None or r["metrics"]["r2"] > best["metrics"]["r2"]:
                best = r
    board.sort(key=lambda x: -x["r2"])
    return {"leaderboard": board, "n_models": len(board), "best": best,
            "best_model": best["model"] if best else None}


def importance(df: pd.DataFrame, model_name: str, target: str, test_size: float = 0.2, n_repeats: int = 5) -> dict:
    """Permutation importance, computed manually (model-agnostic): drop in R² when each feature is
    shuffled. Avoids sklearn's estimator-protocol coupling so it works on any Zoo model."""
    from sklearn.metrics import r2_score
    if target not in df.columns:
        return {"error": f"target '{target}' missing"}
    feat = [c for c in df.columns if c != target and pd.api.types.is_numeric_dtype(df[c])]
    if not feat:
        return {"error": "no numeric features"}
    X = df[feat].apply(pd.to_numeric, errors="coerce").fillna(0.0)
    y = pd.to_numeric(df[target], errors="coerce").ffill().fillna(0.0)
    cut = int(len(df) * (1 - test_size))
    Xtr, Xte, ytr, yte = X.iloc[:cut], X.iloc[cut:], y.iloc[:cut], y.iloc[cut:]
    if len(Xte) < 5:
        return {"error": "test split too small"}
    try:
        m = zoohub.get_model(model_name)
        m.fit(Xtr, ytr)
        base = r2_score(yte.to_numpy(), np.asarray(m.predict(Xte), float).reshape(-1)[:len(yte)])
        rng = np.random.default_rng(0)
        imp = []
        for c in feat:
            drops = []
            for _ in range(n_repeats):
                Xp = Xte.copy()
                Xp[c] = rng.permutation(Xp[c].to_numpy())
                sc = r2_score(yte.to_numpy(), np.asarray(m.predict(Xp), float).reshape(-1)[:len(yte)])
                drops.append(base - sc)
            imp.append({"feature": c, "importance": round(float(np.mean(drops)), 5)})
        imp.sort(key=lambda d: -d["importance"])
        return {"model": model_name, "baseline_r2": round(float(base), 4), "importances": imp}
    except Exception as e:  # noqa
        return {"error": f"{model_name}: {str(e)[:140]}"}


def add_features(df: pd.DataFrame, target: str, lags: list[int], roll: int) -> pd.DataFrame:
    """Lag + rolling-mean feature engineering on the target — the feature node."""
    out = df.copy()
    if target in out.columns and pd.api.types.is_numeric_dtype(out[target]):
        s = pd.to_numeric(out[target], errors="coerce")
        for L in lags:
            out[f"{target}_lag{L}"] = s.shift(L)
        if roll > 1:
            out[f"{target}_roll{roll}"] = s.rolling(roll).mean()
        out = out.bfill().ffill()
    return out


def combine(model_outputs: list[dict], method: str = "mean", weights: list[float] | None = None) -> dict:
    """Combine the predictions of several model nodes into an ensemble (the wired-ensemble node)."""
    outs = [o for o in model_outputs if o and o.get("y_pred")]
    if not outs:
        return {"error": "ensemble has no fitted model inputs"}
    m = min(len(o["y_pred"]) for o in outs)
    P = np.array([o["y_pred"][:m] for o in outs], float)
    y = np.array(outs[0]["y_true"][:m], float)
    if method == "median":
        ens = np.median(P, axis=0)
    elif method == "weighted":
        if weights and len(weights) == len(outs):
            w = np.array(weights, float)
        else:  # inverse-RMSE weights
            rmse = np.array([np.sqrt(np.mean((np.array(o["y_pred"][:m]) - y) ** 2)) + 1e-9 for o in outs])
            w = 1.0 / rmse
        w = w / w.sum()
        ens = (P * w[:, None]).sum(axis=0)
    else:
        ens = P.mean(axis=0)
    return {"members": [o.get("model") for o in outs], "method": method,
            "metrics": _metrics(y, ens), "y_true": list(np.round(y, 6)), "y_pred": list(np.round(ens, 6)),
            "sample": [{"i": int(i), "actual": round(float(y[i]), 4), "pred": round(float(ens[i]), 4)}
                       for i in range(min(60, m))]}

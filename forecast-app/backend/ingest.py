"""Stage 1 — data ingest + parse/profile. Datasets land as parquet under datasets/ with a JSON
registry; profiling infers dtypes, missing %, numeric stats, and candidate time/target columns
so the harmonize/sample/model stages know what they're working with."""
import io
import json
import os

import numpy as np
import pandas as pd

DIR = os.path.join(os.path.dirname(__file__), "datasets")
REG = os.path.join(DIR, "_registry.json")
os.makedirs(DIR, exist_ok=True)


def _registry() -> dict:
    if os.path.exists(REG):
        try:
            return json.load(open(REG))
        except Exception:  # noqa
            return {}
    return {}


def _save_registry(r: dict):
    json.dump(r, open(REG, "w"), indent=2)


def _slug(name: str) -> str:
    return "".join(c if c.isalnum() or c in "-_" else "_" for c in name).strip("_").lower() or "dataset"


def parse_bytes(raw: bytes, filename: str) -> pd.DataFrame:
    """Parse an uploaded file (csv / json / parquet) into a DataFrame."""
    low = filename.lower()
    if low.endswith(".parquet"):
        return pd.read_parquet(io.BytesIO(raw))
    if low.endswith(".json"):
        try:
            return pd.read_json(io.BytesIO(raw))
        except ValueError:
            return pd.json_normalize(json.loads(raw.decode("utf-8")))
    return pd.read_csv(io.BytesIO(raw))   # default: CSV (handles tsv via sep sniff below)


def save(df: pd.DataFrame, name: str, source: str = "upload") -> dict:
    sid = _slug(name)
    path = os.path.join(DIR, f"{sid}.parquet")
    df.to_parquet(path)
    meta = {"id": sid, "name": name, "source": source, "rows": int(len(df)),
            "cols": int(df.shape[1]), "columns": [str(c) for c in df.columns]}
    r = _registry()
    r[sid] = meta
    _save_registry(r)
    return meta


def list_datasets() -> list[dict]:
    return sorted(_registry().values(), key=lambda m: m["id"])


def load(sid: str) -> pd.DataFrame | None:
    path = os.path.join(DIR, f"{sid}.parquet")
    return pd.read_parquet(path) if os.path.exists(path) else None


def _is_datetime(s: pd.Series) -> bool:
    if pd.api.types.is_datetime64_any_dtype(s):
        return True
    if s.dtype == object:
        sample = s.dropna().astype(str).head(40)
        if len(sample) < 5:
            return False
        ok = pd.to_datetime(sample, errors="coerce", format="mixed").notna().mean()
        return ok > 0.8
    return False


def profile(df: pd.DataFrame) -> dict:
    n = len(df)
    cols = []
    for c in df.columns:
        s = df[c]
        miss = float(s.isna().mean() * 100)
        numeric = pd.api.types.is_numeric_dtype(s)
        dt = _is_datetime(s)
        kind = "datetime" if dt else "numeric" if numeric else "categorical"
        col = {"name": str(c), "kind": kind, "dtype": str(s.dtype),
               "missing_pct": round(miss, 2), "n_unique": int(s.nunique(dropna=True))}
        if numeric and not dt:
            v = pd.to_numeric(s, errors="coerce").dropna()
            if len(v):
                col.update({"min": round(float(v.min()), 4), "max": round(float(v.max()), 4),
                            "mean": round(float(v.mean()), 4), "std": round(float(v.std()), 4)})
        cols.append(col)
    # candidate time column = first datetime; candidate target = last numeric with high variance
    time_candidates = [c["name"] for c in cols if c["kind"] == "datetime"]
    num = [c for c in cols if c["kind"] == "numeric"]
    target_candidate = num[-1]["name"] if num else None
    return {"rows": n, "cols": len(cols), "columns": cols,
            "time_candidates": time_candidates,
            "numeric_columns": [c["name"] for c in num],
            "categorical_columns": [c["name"] for c in cols if c["kind"] == "categorical"],
            "target_candidate": target_candidate,
            "missing_total_pct": round(float(df.isna().mean().mean() * 100), 2),
            "preview": json.loads(df.head(12).to_json(orient="records"))}


def from_stock(ticker: str) -> pd.DataFrame:
    """Bridge the existing stock loader into the dataset pipeline."""
    import data as datamod
    rows = datamod.fetch(ticker)["rows"]
    return pd.DataFrame(rows)


def builtin_sample(name: str) -> tuple[pd.DataFrame, str]:
    """A couple of ready-to-use datasets so the pipeline is usable with zero setup."""
    from sklearn import datasets as sk
    if name == "diabetes":
        d = sk.load_diabetes(as_frame=True)
        df = d.frame
        return df, "diabetes"
    if name == "california_housing":
        d = sk.fetch_california_housing(as_frame=True)
        return d.frame, "california_housing"
    # default: a synthetic trend+seasonal+noise series
    t = np.arange(400)
    val = 100 + 0.05 * t + 8 * np.sin(t / 12) + np.random.default_rng(0).normal(0, 3, len(t))
    df = pd.DataFrame({"date": pd.date_range("2024-01-01", periods=len(t), freq="D"),
                       "value": np.round(val, 3)})
    return df, "synthetic_series"

"""Stage 3 — harmonize & condition. Type coercion, missing-value strategies, outlier conditioning
(reusing the forecast prep Hampel filter), normalization, and categorical encoding. Produces a
conditioned copy of the dataset plus a before/after report."""
import numpy as np
import pandas as pd

import prep


def _coerce(df: pd.DataFrame) -> pd.DataFrame:
    out = df.copy()
    for c in out.columns:
        if out[c].dtype == object:
            dt = pd.to_datetime(out[c], errors="coerce", format="mixed")
            if dt.notna().mean() > 0.8:
                out[c] = dt
                continue
            num = pd.to_numeric(out[c], errors="coerce")
            if num.notna().mean() > 0.8:
                out[c] = num
    return out


def _missing(df: pd.DataFrame, how: str) -> pd.DataFrame:
    out = df.copy()
    num = out.select_dtypes(include=[np.number]).columns
    if how == "drop":
        return out.dropna()
    if how == "zero":
        out[num] = out[num].fillna(0)
    elif how == "ffill":
        out[num] = out[num].ffill().bfill()
    elif how == "interpolate":
        out[num] = out[num].interpolate(limit_direction="both")
    elif how == "median":
        out[num] = out[num].fillna(out[num].median())
    else:  # mean (default)
        out[num] = out[num].fillna(out[num].mean())
    return out


def _outliers(df: pd.DataFrame, how: str, k: float) -> tuple[pd.DataFrame, int]:
    if how == "none":
        return df, 0
    out = df.copy()
    flagged = 0
    for c in out.select_dtypes(include=[np.number]).columns:
        v = out[c].to_numpy(float)
        if how == "winsorize":
            lo, hi = np.nanpercentile(v, [1, 99])
            flagged += int(np.sum((v < lo) | (v > hi)))
            out[c] = np.clip(v, lo, hi)
        else:  # hampel — reuse forecast prep
            cleaned, flags = prep.impute_and_flag(v, k=k)
            flagged += int(np.sum(flags))
            out[c] = cleaned
    return out, flagged


def _normalize(df: pd.DataFrame, how: str) -> pd.DataFrame:
    if how == "none":
        return df
    out = df.copy()
    for c in out.select_dtypes(include=[np.number]).columns:
        v = out[c].to_numpy(float)
        if how == "zscore":
            sd = np.nanstd(v)
            out[c] = (v - np.nanmean(v)) / (sd if sd else 1.0)
        elif how == "minmax":
            mn, mx = np.nanmin(v), np.nanmax(v)
            out[c] = (v - mn) / ((mx - mn) or 1.0)
        elif how == "robust":
            med = np.nanmedian(v)
            iqr = np.nanpercentile(v, 75) - np.nanpercentile(v, 25)
            out[c] = (v - med) / (iqr or 1.0)
        elif how == "log":
            out[c] = np.log1p(v - min(0.0, float(np.nanmin(v))))
    return out


def _encode(df: pd.DataFrame, how: str) -> pd.DataFrame:
    if how == "none":
        return df
    cat = df.select_dtypes(include=["object", "category"]).columns
    if not len(cat):
        return df
    if how == "onehot":
        return pd.get_dummies(df, columns=list(cat), dummy_na=False)
    out = df.copy()                                    # ordinal
    for c in cat:
        out[c] = out[c].astype("category").cat.codes
    return out


def condition(df: pd.DataFrame, cfg: dict) -> tuple[pd.DataFrame, dict]:
    """Apply the full conditioning chain; return conditioned df + before/after report."""
    before = {"rows": int(len(df)), "missing_pct": round(float(df.isna().mean().mean() * 100), 2)}
    out = _coerce(df)
    out = _missing(out, cfg.get("missing", "mean"))
    out, flagged = _outliers(out, cfg.get("outliers", "hampel"), float(cfg.get("hampel_k", 3.0)))
    out = _normalize(out, cfg.get("normalize", "none"))
    out = _encode(out, cfg.get("encode", "none"))
    after = {"rows": int(len(out)), "cols": int(out.shape[1]),
             "missing_pct": round(float(out.isna().mean().mean() * 100), 2),
             "outliers_conditioned": flagged}
    return out, {"before": before, "after": after, "config": cfg}

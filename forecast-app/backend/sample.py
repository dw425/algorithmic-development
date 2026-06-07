"""Stage 4 — sampling. Train/test/holdout, ordered time split, rolling-origin (with optional
purge/embargo), bootstrap, and stratified sampling. Returns split sizes + index ranges for preview."""
import numpy as np
import pandas as pd


def make_split(df: pd.DataFrame, cfg: dict) -> dict:
    n = len(df)
    method = cfg.get("method", "holdout")
    test_size = float(cfg.get("test_size", 0.2))
    rng = np.random.default_rng(int(cfg.get("seed", 0)))
    idx = np.arange(n)

    if method == "time" or method == "holdout_ordered":
        cut = int(n * (1 - test_size))
        return {"method": method, "train": [0, cut], "test": [cut, n],
                "n_train": cut, "n_test": n - cut,
                "note": "ordered split — no shuffling (leakage-safe for series)"}

    if method == "rolling_origin":
        folds = int(cfg.get("folds", 5))
        embargo = int(cfg.get("embargo", 0))
        min_train = int(n * 0.4)
        step = max(1, (n - min_train) // folds)
        out = []
        for f in range(folds):
            tr_end = min(min_train + f * step, n - 1)
            te_start = min(tr_end + embargo, n - 1)
            te_end = min(te_start + step, n)
            if te_end > te_start:
                out.append({"fold": f + 1, "train": [0, tr_end], "test": [te_start, te_end]})
        return {"method": method, "folds": out, "embargo": embargo, "n_folds": len(out)}

    if method == "bootstrap":
        reps = int(cfg.get("reps", 100))
        sample = rng.integers(0, n, size=n)
        return {"method": method, "reps": reps, "n_train": n,
                "unique_fraction": round(float(len(np.unique(sample)) / n), 3),
                "note": f"{reps} bootstrap resamples of {n} rows (with replacement)"}

    if method == "stratified":
        col = cfg.get("by")
        if col and col in df.columns and pd.api.types.is_numeric_dtype(df[col]):
            bins = pd.qcut(df[col].rank(method="first"), q=min(5, n), labels=False, duplicates="drop")
            counts = pd.Series(bins).value_counts().sort_index().to_dict()
            return {"method": method, "by": col, "strata": {int(k): int(v) for k, v in counts.items()},
                    "note": f"stratified into {len(counts)} bins of '{col}'"}
        return {"method": method, "error": "needs a numeric 'by' column"}

    # random holdout (shuffled)
    rng.shuffle(idx)
    cut = int(n * (1 - test_size))
    return {"method": "random", "n_train": cut, "n_test": n - cut,
            "note": "random shuffled holdout"}

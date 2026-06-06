"""Validation harness (Phase 4) — math-gate utilities used by every phase's G3.
Real numeric checks, no mocks."""
import numpy as np


def assert_close(a, b, tol=1e-6, msg=""):
    if abs(float(a) - float(b)) > tol:
        raise AssertionError(f"{msg} {a} != {b} (tol {tol})")
    return True


def coverage(actuals, lo, hi):
    """Fraction of actuals inside [lo,hi] — the calibration metric (OG2)."""
    a, lo, hi = np.asarray(actuals, float), np.asarray(lo, float), np.asarray(hi, float)
    return float(np.mean((a >= lo) & (a <= hi)))


def rolling_origin_split(n, train_frac=0.6):
    """Time-ordered train/forward split (no shuffling) for OOS checks."""
    k = max(1, int(n * train_frac))
    return list(range(k)), list(range(k, n))


def naive_lift(pred, actual):
    """% error reduction of `pred` vs the naive (previous-value) forecast. >0 = beats naive."""
    a = np.asarray(actual, float)
    naive = np.concatenate([[a[0]], a[:-1]])
    pe = np.abs(np.asarray(pred, float) - a)
    ne = np.abs(naive - a)
    return float((ne.mean() - pe.mean()) / (ne.mean() + 1e-12) * 100)

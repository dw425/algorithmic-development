"""Phase 4 — validation harness: math-gate utilities used by every phase's G3 check."""
import numpy as np


def assert_close(a, b, tol=1e-6, msg=""):
    if abs(float(a) - float(b)) > tol:
        raise AssertionError(f"{msg} {a} != {b} (tol {tol})")
    return True


def coverage(actuals, lo, hi):
    a, lo, hi = np.asarray(actuals, float), np.asarray(lo, float), np.asarray(hi, float)
    return float(np.mean((a >= lo) & (a <= hi)))


def rolling_origin_split(n, train_frac=0.6):
    k = max(1, int(n * train_frac))
    return list(range(k)), list(range(k, n))


def naive_lift(pred, actual):
    """% error reduction vs the naive (prev-value) forecast. >0 = beats naive."""
    a = np.asarray(actual, float)
    naive = np.concatenate([[a[0]], a[:-1]])
    pe, ne = np.abs(np.asarray(pred, float) - a), np.abs(naive - a)
    return float((ne.mean() - pe.mean()) / (ne.mean() + 1e-12) * 100)

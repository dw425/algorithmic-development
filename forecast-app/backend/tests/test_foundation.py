"""Tier 0 foundation tests (Phases 2,4,5,6) — real data, real math gates. No mocks."""
import os
import sys
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
import data
import validation as V
import engine_vectors as ev


# --- Phase 5: data fetch on REAL data ---
def test_fetch_real_daily():
    rows = data.fetch("AAPL")["rows"]
    assert len(rows) >= 200, f"only {len(rows)} rows"
    closes = [r["close"] for r in rows]
    assert all(c > 0 for c in closes), "non-positive close"
    dates = [r["date"] for r in rows]
    assert dates == sorted(dates), "dates not monotonic"
    assert all(np.isfinite(c) for c in closes), "NaN/inf close"


def test_fetch_intervals():
    for iv in ("1wk", "1mo"):
        rows = data.fetch("AAPL", interval=iv)["rows"]
        assert len(rows) > 10, f"{iv}: {len(rows)} rows"


# --- Phase 4: validation harness self-tests (known answers) ---
def test_coverage_known():
    V.assert_close(V.coverage([1, 1, 1], [0, 0, 0], [2, 2, 2]), 1.0, msg="full cover")
    V.assert_close(V.coverage([3, 1], [0, 0], [2, 2]), 0.5, msg="half cover")


def test_naive_lift_sign():
    # a perfect forecast beats naive on a trending series
    actual = np.arange(1, 51, dtype=float)
    lift = V.naive_lift(actual, actual)   # pred==actual → huge lift
    assert lift > 0, lift


def test_rolling_split():
    tr, fw = V.rolling_origin_split(100, 0.6)
    assert len(tr) == 60 and len(fw) == 40 and max(tr) < min(fw)


# --- Phase 4/C4 math gate preview: Hurst≈0.5 on a random walk ---
def test_hurst_random_walk():
    rng = np.random.default_rng(0)
    rw = np.cumsum(rng.normal(size=3000)) + 500
    h = ev.hurst_exponent(rw)
    assert 0.40 < h < 0.60, f"Hurst {h} not ~0.5 on random walk"


# --- Phase 6: universe / tickers available ---
def test_universe_cache():
    cache = os.path.join(os.path.dirname(__file__), "..", "cache")
    tk = [f[:-5] for f in os.listdir(cache)
          if f.endswith(".json") and "_" not in f and f[:-5].isalpha()]
    assert len(tk) >= 10, f"only {len(tk)} cached tickers"

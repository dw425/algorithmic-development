"""Phases 2/4/5/6 foundation gates — real data, known-answer math. No mocks."""
import os
import sys
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
import data
import validation as V


# P5 — data loader on REAL data
def test_fetch_real_daily():
    rows = data.fetch("AAPL")["rows"]
    assert len(rows) >= 200
    closes = [r["close"] for r in rows]
    assert all(c > 0 and np.isfinite(c) for c in closes)
    dates = [r["date"] for r in rows]
    assert dates == sorted(dates)


def test_fetch_weekly_monthly():
    for iv in ("1wk", "1mo"):
        assert len(data.fetch("AAPL", interval=iv)["rows"]) > 10


def test_load_csv(tmp_path):
    p = tmp_path / "s.csv"
    p.write_text("date,close\n2025-01-01,10\n2025-01-02,11\n")
    rows = data.load_csv_series(str(p))
    assert rows == [{"date": "2025-01-01", "close": 10.0}, {"date": "2025-01-02", "close": 11.0}]


# P4 — validation harness self-tests (known answers)
def test_coverage_known():
    V.assert_close(V.coverage([1, 1, 1], [0, 0, 0], [2, 2, 2]), 1.0)
    V.assert_close(V.coverage([3, 1], [0, 0], [2, 2]), 0.5)


def test_rolling_split():
    tr, fw = V.rolling_origin_split(100, 0.6)
    assert len(tr) == 60 and len(fw) == 40 and max(tr) < min(fw)


def test_naive_lift():
    a = np.arange(1, 51, dtype=float)
    assert V.naive_lift(a, a) > 0     # perfect forecast beats naive


# P6 — universe
def test_universe_nonempty():
    u = data.universe()
    assert len(u) >= 10 and all(t.isalpha() for t in u)

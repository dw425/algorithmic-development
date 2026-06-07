"""Component math gates — each must PASS before its pages are built. Real data + known answers."""
import os
import sys
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
import prep

rng = np.random.default_rng(0)
RW = np.cumsum(rng.normal(size=1500)) + 500   # random walk


# ---- C1: validate & clean ----
def test_c1_validate_quarantine():
    bad = [{"date": "2025-01-01", "close": 10.0}, {"date": "2025-01-02", "close": -5.0},
           {"date": "2025-01-03", "close": None}]
    v = prep.validate(bad)
    assert v["n_quarantined"] == 2 and len(v["clean"]) == 1


def test_c1_impute_midpoint():
    p, flags = prep.impute_and_flag([10.0, np.nan, 12.0])
    assert abs(p[1] - 11.0) < 1e-9 and np.isfinite(p).all()


def test_c1_hampel_flags_spike():
    series = [10.0] * 10 + [10.0]
    series[10] = 50.0          # obvious spike
    _, flags = prep.impute_and_flag(series, k=3.0, win=7)
    assert flags[10]           # spike flagged


# ---- C2: stationarity ----
def test_c2_random_walk_nonstationary():
    s = prep.stationarity(RW)
    assert s["adf_p"] > 0.05 and "difference" in s["recommend"]


def test_c2_stationary_noise():
    s = prep.stationarity(rng.normal(0, 1, 1500))  # iid → stationary
    assert s["adf_p"] < 0.05


def test_c2_stl_recompose():
    t = np.linspace(0, 10, 500)
    sig = 100 + t * 2 + 3 * np.sin(t * 2 * np.pi / 1.0) + rng.normal(0, 0.5, 500)
    d = prep.stl_decompose(sig, period=21)
    recomposed = np.array(d["trend"]) + np.array(d["seasonal"])
    assert np.mean(np.abs(sig - recomposed)) < 2.0   # trend+seasonal ≈ signal (resid small)

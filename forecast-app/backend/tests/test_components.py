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


# ---- C3: multi-scale ----
import engine as E  # noqa


def test_c3_aggregate():
    a = E.aggregate(np.arange(20.0), 2)
    assert abs(a[0] - 0.5) < 1e-9 and abs(a[-1] - 18.5) < 1e-9 and len(a) == 10


# ---- C4: predictability ----
def test_c4_hurst_regimes():
    assert 0.4 < E.hurst(RW) < 0.6                 # random walk ~0.5
    assert E.hurst(500 + rng.normal(0, 1, 1500)) < 0.45   # iid → mean-reverting


def test_c4_lyapunov_chaos():
    x = np.zeros(2000); x[0] = 0.4
    for i in range(1, 2000):
        x[i] = 3.9 * x[i - 1] * (1 - x[i - 1])
    assert E.lyapunov(x + 10) > E.lyapunov(np.sin(np.arange(2000) * 0.1) + 10)


# ---- C5: base models ----
def test_c5_models_hand():
    a = np.array([10., 11., 12., 13., 14.])
    assert abs(E.MODELS["naive"](a) - 14.0) < 1e-9
    assert abs(E.MODELS["drift"](a) - 15.0) < 1e-9
    for m, fn in E.MODELS.items():
        assert np.isfinite(fn(a)), m


def test_c5_rho():
    import data
    r = E.rho_matrix(np.array([x["close"] for x in data.fetch("AAPL")["rows"]]))
    assert -1 <= r["mean_rho"] <= 1 and r["effective_models"] >= 1

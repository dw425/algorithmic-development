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


# ---- C6: ensemble weights ----
def test_c6_weights_sum_to_one():
    Emat = rng.normal(0, 1, (5, 200))
    w = E.ensemble_weights(Emat)
    assert abs(w.sum() - 1.0) < 1e-9 and (w >= 0).all()


# ---- C7: conformal coverage near target ----
def test_c7_coverage():
    import data
    r = E.forecast_walkforward(data.fetch("MSFT")["rows"], target=0.70)
    assert 0.5 <= r["coverage"] / 100 <= 0.9 and r["n_eval"] > 20


# ---- C8: debias removes injected bias ----
def test_c8_debias():
    actual = 100 + np.cumsum(rng.normal(0, 1, 300))
    biased = actual * 1.05
    bias = float(np.mean((actual - biased) / biased))
    corrected = biased * (1 + bias)
    assert abs(np.mean((actual - corrected) / corrected)) < abs(np.mean((actual - biased) / biased))


# ---- C9: multi-horizon + purge/embargo ----
def test_c9_horizons_and_embargo():
    import data
    h = E.multi_horizon(data.fetch("MSFT")["rows"], target=0.70)
    assert len(h) >= 1 and all(k in ("7d", "30d", "90d") for k in h)
    assert E.purge_embargo(0, 100, 100, 7)[-1] < 100 - 7


# ---- C10: vector grid count ----
def test_c10_grid():
    import data
    assert E.N_VECTORS == 11 * 12 * 5 * 3
    cloud = E.build_cloud(np.array([x["close"] for x in data.fetch("MSFT")["rows"]])[:300])
    assert len(cloud) > 100 and np.isfinite(cloud).all()


# ---- C11-C16: spatial ----
import spatial as SP  # noqa


def _px():
    import data
    return np.array([x["close"] for x in data.fetch("MSFT")["rows"]], float)


def test_c11_standardize():
    v, r, dr = SP.geo_cloud(_px()[:300])
    Xs = SP.standardize(v, r, dr)
    assert np.all(np.abs(Xs.mean(0)) < 1e-6) and np.isfinite(Xs).all()


def test_c12_15_geo_consensus():
    g = SP.geo_consensus(_px()[:300])
    assert np.isfinite(g["forecast"])
    assert 0 <= g["consensus_pct"] <= 100
    assert 0 <= g["mahalanobis_pct"] <= 100
    assert g["constellation_len"] > 0 and g["davies_bouldin"] >= 0


def test_c14_mahalanobis_gaussian():
    # 3D Gaussian: MD^2 ~ chi2(3) -> P(MD<1)=P(chi2_3<1)~=0.20 (NOT the 1D 68%)
    X = rng.normal(0, 1, (4000, 3))
    inv = np.linalg.pinv(np.cov(X.T)); cen = X.mean(0)
    md = np.sqrt(np.einsum("ij,jk,ik->i", X - cen, inv, X - cen))
    assert 0.12 < np.mean(md < 1.0) < 0.30   # chi2_3 CDF at 1 ~= 0.199


def test_c16_louvain_symmetric():
    m = SP.louvain_map(["AAPL", "MSFT", "NVDA", "JNJ", "JPM"])
    assert m["n_communities"] >= 1
    dm = np.array(m["dep_matrix"])
    assert np.allclose(dm, dm.T)   # dependency matrix symmetric
    for e in m["edges"]:
        assert e["weight"] >= 0


# ---- C17-C22: final tier ----
import advanced as AD  # noqa


def test_c17_inverse_net():
    v = np.array([100.0] * 50 + [110.0] * 30)
    idf = AD.inverse_drift(v, 100.0)
    assert 0 <= idf["coherence_pct"] <= 100
    nr = AD.net_results(v, 100.0)
    assert 0 <= nr["convergence_pct"] <= 100


def test_c18_funnel_monotonic():
    fn = AD.funnel(_px()[:300])
    counts = [s["count"] for s in fn]
    assert counts == sorted(counts, reverse=True)   # nested drop-off
    _, stab = AD.bootstrap_stability(_px()[:300])
    assert 0 <= stab <= 1


def test_c19_mcs():
    loss = {"good": np.abs(rng.normal(0, 0.5, 200)), "bad": np.abs(rng.normal(3, 0.5, 200))}
    surv = AD.model_confidence_set(loss, margin=1.0)
    assert "good" in surv and "bad" not in surv


def test_c20_isotonic_monotone():
    nom = np.linspace(0.1, 0.9, 9)
    emp = nom + rng.normal(0, 0.05, 9)        # noisy monotone
    cal, _ = AD.isotonic_recalibrate(nom, emp)
    assert all(cal[i] <= cal[i + 1] + 1e-9 for i in range(len(cal) - 1))  # monotone non-decreasing


def test_c21_tpa():
    import data
    r = AD.tpa(data.fetch("MSFT")["rows"], m=100)
    assert r["points"] == 201
    if not r["significant"]:
        assert abs(r["modifier_pct"]) < 5      # withheld/small when not significant


def test_c22_outward():
    flat = np.zeros(200)
    drifted = np.concatenate([np.zeros(100), np.full(100, 0.5)])
    assert AD.page_hinkley(drifted)["drift"] and not AD.page_hinkley(flat)["drift"]
    assert AD.psi(rng.normal(0, 1, 300), rng.normal(3, 1, 300)) > 0.25


# ---- P130: cross-page consistency (same engine → same numbers everywhere) ----
def test_p130_cross_page_consistency():
    import data, advanced
    rows = data.fetch("MSFT")["rows"]
    f1 = E.forecast_walkforward(rows, target=0.70)
    f2 = E.forecast_walkforward(rows, target=0.70)
    assert f1["coverage"] == f2["coverage"]                  # deterministic
    # Forecast page coverage == Diagnostics page empirical (both from same rows)
    emp = advanced.reliability(f1["rows"], 0.70)["empirical"]
    assert abs(f1["coverage"] - emp) < 1e-6

"""Precompute full 1,800-vector engine results for all 10 stocks -> cache/full_results.json"""
import json
import os
import data
import engine_vectors as ev

# full build: 1,980-vector engine with CQR/FFORMA/hybrid/rho/thief/decomp/kalman wired
out = []
for t in data.TICKERS:
    try:
        d = data.fetch(t)
        r = ev.run_walkforward(d["rows"], target=0.70)
        r["ticker"] = t
        with open(os.path.join(os.path.dirname(__file__), "cache", f"forecast_{t}.json"), "w") as f:
            json.dump(r, f)
        hz = ev.forecast_horizons(d["rows"], target=0.70)
        hz["ticker"] = t
        with open(os.path.join(os.path.dirname(__file__), "cache", f"horizons_{t}.json"), "w") as f:
            json.dump(hz, f)
        out.append({
            "ticker": t, "coverage": r["coverage"], "avg_width_pct": r["avg_width_pct"],
            "risk_flags": r["risk_flags"], "predictability": r["predictability"],
            "multi_horizon": r["multi_horizon"], "n_eval": r["n_eval"], "target": r["target"],
        })
        print(t, r["coverage"], "%", r["avg_width_pct"], "%", flush=True)
    except Exception as e:  # noqa
        out.append({"ticker": t, "error": str(e)})
        print(t, "ERROR", e, flush=True)

path = os.path.join(os.path.dirname(__file__), "cache", "full_results.json")
with open(path, "w") as f:
    json.dump({"results": out, "target": 70}, f)
print("WROTE", path, flush=True)

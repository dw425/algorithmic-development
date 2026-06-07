"""Tier 7 batch runner (P128/P129): run the gated forecaster over the cached universe,
score coverage + width + held-out lift vs naive. Resumable, saves run_results.json."""
import json
import os
import numpy as np
import data
import engine

OUT = os.path.join(os.path.dirname(__file__), "run_results.json")


def naive_lift_from_rows(rows):
    if len(rows) < 3:
        return 0.0
    pred = np.array([r["pred"] for r in rows], float)
    act = np.array([r["actual"] for r in rows], float)
    naive = np.concatenate([[act[0]], act[:-1]])
    pe, ne = np.abs(pred - act), np.abs(naive - act)
    return float((ne.mean() - pe.mean()) / (ne.mean() + 1e-12) * 100)


def run():
    universe = data.universe()
    results = json.load(open(OUT)) if os.path.exists(OUT) else {}
    done = 0
    for t in universe:
        if t in results:
            continue
        try:
            rows = data.fetch(t)["rows"]
            r = engine.forecast_walkforward(rows, target=0.70)
            if r["n_eval"] >= 30:
                results[t] = {"ok": True, "coverage": r["coverage"], "avg_width_pct": r["avg_width_pct"],
                              "naive_lift_pct": round(naive_lift_from_rows(r["rows"]), 2), "n_eval": r["n_eval"]}
            else:
                results[t] = {"ok": False, "reason": "few eval"}
        except Exception as e:  # noqa
            results[t] = {"ok": False, "reason": str(e)[:50]}
        done += 1
        if done % 50 == 0:
            json.dump(results, open(OUT, "w"))
            ok = [v for v in results.values() if v.get("ok")]
            cov = np.mean([v["coverage"] for v in ok]) if ok else 0
            print(f"{done} done | {len(ok)} valid | mean cov {cov:.1f}%", flush=True)
    json.dump(results, open(OUT, "w"))
    ok = [v for v in results.values() if v.get("ok")]
    cov = np.mean([v["coverage"] for v in ok])
    lift = np.mean([v["naive_lift_pct"] for v in ok])
    beat = np.mean([v["naive_lift_pct"] > 0 for v in ok]) * 100
    print(f"DONE: {len(ok)} valid | mean coverage {cov:.1f}% | mean naive-lift {lift:.2f}% | "
          f"% beating naive {beat:.1f}%", flush=True)


if __name__ == "__main__":
    run()

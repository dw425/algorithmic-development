"""Batch next-step prediction over the whole cached universe → predictions_all.json.
Same naive-anchored point + conformal band + 1,980-vector cloud consensus as /api/predict,
but light (no histogram arrays). Resumable."""
import json
import os
import numpy as np
import data
import engine

OUT = os.path.join(os.path.dirname(__file__), "predictions_all.json")


def next_step(rows, target=0.70):
    p = np.array([r["close"] for r in rows], float)
    dates = [r["date"] for r in rows]
    n = len(p)
    if n < 60:
        return None
    last = float(p[-1])
    win, recent, min_hist = 60, 120, 40
    w = p[-win:]
    fast_mean = float(np.mean([engine.MODELS[m](w) for m in engine.FAST]))
    raw_point = 0.8 * last + 0.2 * fast_mean
    ens = np.full(n, np.nan)
    for i in range(min_hist, n):
        ww = p[max(0, i - win):i]
        ens[i] = 0.8 * ww[-1] + 0.2 * float(np.mean([engine.MODELS[m](ww) for m in engine.FAST]))
    rel = (p - ens) / ens
    cal = rel[max(min_hist, n - recent):n]
    cal = cal[np.isfinite(cal)]
    a0 = 1 - target
    if len(cal) >= 20:
        bias = float(np.mean(cal))
        point = raw_point * (1 + bias)
        c = cal - bias
        qlo, qhi = float(np.quantile(c, a0 / 2)), float(np.quantile(c, 1 - a0 / 2))
        lo, hi = point * (1 + qlo), point * (1 + qhi)
    else:
        point, lo, hi = raw_point, raw_point * 0.97, raw_point * 1.03
    cloud = engine.build_cloud(p)
    counts, edges = np.histogram(cloud, bins=40)
    pk = int(np.argmax(counts))
    consensus = float((edges[pk] + edges[pk + 1]) / 2)
    return {"last_date": dates[-1], "last_close": round(last, 2), "point": round(point, 2),
            "lo": round(lo, 2), "hi": round(hi, 2),
            "move_pct": round((point - last) / last * 100, 2),
            "range_pct": round((hi - lo) / point * 100, 2),
            "cloud_consensus": round(consensus, 2)}


def run():
    universe = data.universe()
    results = json.load(open(OUT)) if os.path.exists(OUT) else {}
    done = 0
    for t in universe:
        if t in results:
            continue
        try:
            r = next_step(data.fetch(t)["rows"])
            results[t] = {"ok": True, **r} if r else {"ok": False, "reason": "short"}
        except Exception as e:  # noqa
            results[t] = {"ok": False, "reason": str(e)[:50]}
        done += 1
        if done % 50 == 0:
            json.dump(results, open(OUT, "w"))
            print(f"{done} predicted | {len([v for v in results.values() if v.get('ok')])} ok", flush=True)
    json.dump(results, open(OUT, "w"))
    ok = len([v for v in results.values() if v.get("ok")])
    print(f"DONE: {ok}/{len(results)} predictions written", flush=True)


if __name__ == "__main__":
    run()

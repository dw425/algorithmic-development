"""Generic forecast runner — ANY dataset, ANY size, ANY time period, forecast vs actuals.

Examples:
  # 1000 Yahoo tickers, FULL engine, all of 2025, 10 workers
  python runner.py --source ticker --idfile candidates.json --count 1000 \
      --eval-start 2025-01-01 --eval-end 2026-01-01 --engine full --workers 10

  # any folder of CSV time-series (date,value), fast engine, custom window
  python runner.py --source csv --csv-dir ./mydata --eval-start 2023-06-01 --eval-end 2024-01-01

Self-running: launch in background; it collects valid series, computes in parallel,
saves incrementally (RESUMABLE — rerun to continue), then writes a top-N accuracy/drift PNG.
"""
import argparse
import glob
import json
import os
from multiprocessing import Pool

import numpy as np
import data
import engine_vectors as ev

BASE = os.path.dirname(__file__)


def load_series(source, sid):
    return data.fetch(sid)["rows"] if source == "ticker" else data.load_csv_series(sid)


def is_valid(rows, es, ee, min_pre, min_eval):
    pre = sum(1 for r in rows if r["date"] < es)
    inw = sum(1 for r in rows if es <= r["date"] < ee)
    return pre >= min_pre and inw >= min_eval


def _summary(sid, rows, res):
    evw = [r for r in rows if res["rows"] and res["rows"][0]["date"] <= r["date"] <= res["rows"][-1]["date"]]
    drift = 0.0
    if len(evw) > 1 and evw[0]["close"]:
        drift = round(100 * (evw[-1]["close"] / evw[0]["close"] - 1), 1)
    out = {"ok": True, "coverage": res["coverage"], "avg_width_pct": res["avg_width_pct"],
           "n_eval": res["n_eval"], "drift_pct": drift}
    for k in ("rho", "lyapunov", "drift_flags"):
        if k in res:
            out[k] = res[k]
    return out


_CFG = {}


def run_one(sid):
    try:
        rows = load_series(_CFG["source"], sid)
        if not is_valid(rows, _CFG["es"], _CFG["ee"], _CFG["min_pre"], _CFG["min_eval"]):
            return sid, {"ok": False, "reason": "insufficient data for window"}
        fn = ev.run_walkforward if _CFG["engine"] == "full" else ev.fast_walkforward
        res = fn(rows, target=_CFG["target"], eval_start=_CFG["es"], eval_end=_CFG["ee"])
        return sid, _summary(sid, rows, res)
    except Exception as e:  # noqa
        return sid, {"ok": False, "reason": str(e)[:80]}


def init(cfg):
    global _CFG
    _CFG = cfg


def resolve_ids(a):
    if a.csv_dir:
        return sorted(glob.glob(os.path.join(a.csv_dir, "*.csv"))), "csv"
    if a.idfile:
        raw = open(a.idfile).read()
        ids = json.loads(raw) if raw.lstrip().startswith("[") else raw.split()
        return ids, a.source
    if a.ids:
        return a.ids.split(","), a.source
    return json.load(open(os.path.join(BASE, "candidates.json"))), a.source


def plot_top(results, topn, out_png, cfg, liquid):
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    elig = {k: v for k, v in results.items() if v.get("ok") and v["n_eval"] >= 50}
    if liquid:
        elig = {k: v for k, v in elig.items()
                if not (len(k) <= 5 and k[-1] in "UW") and 1.5 <= v["avg_width_pct"] <= 20
                and abs(v.get("drift_pct", 0)) >= 3}
    top = sorted(elig.items(), key=lambda kv: (-kv[1]["coverage"], kv[1]["avg_width_pct"]))[:topn]
    print(f"\nTOP {topn} by forecast accuracy ({len(elig)} eligible of {len(results)}):")
    print(f"{'ID':10}{'COVERAGE':>9}{'WIDTH':>8}{'DRIFT':>9}")
    for sid, v in top:
        print(f"{str(sid)[:10]:10}{v['coverage']:>8}%{v['avg_width_pct']:>7}%{v.get('drift_pct',0):>8}%")

    fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(13, 10), facecolor="#0f1117")
    fn = ev.run_walkforward if cfg["engine"] == "full" else ev.fast_walkforward
    for (sid, v), col in zip(top, plt.cm.tab10(np.linspace(0, 1, max(topn, 1)))):
        res = fn(load_series(cfg["source"], sid), target=cfg["target"],
                 eval_start=cfg["es"], eval_end=cfg["ee"])
        rr = res["rows"]
        if len(rr) < 25:
            continue
        hit = np.array([1.0 if r["hit"] else 0.0 for r in rr])
        serr = np.array([r.get("serr", (r["actual"] - r["pred"]) / r["pred"]) for r in rr])
        racc = np.convolve(hit, np.ones(21) / 21, mode="valid") * 100
        ax1.plot(range(len(racc)), racc, color=col, lw=1.5, label=f"{str(sid)[:8]} ({v['coverage']}%)")
        ax2.plot(range(len(serr)), np.cumsum(serr) * 100, color=col, lw=1.5, label=str(sid)[:8])
    ax1.axhline(cfg["target"] * 100, color="#f0b429", ls="--", lw=1)
    for ax, t, yl in ((ax1, "Forecast ACCURACY — 21-day rolling hit-rate", "accuracy %"),
                      (ax2, "Forecast DRIFT — cumulative signed error", "drift %")):
        ax.set_facecolor("#151823"); ax.tick_params(colors="#8b93a7")
        for sp in ax.spines.values():
            sp.set_color("#2c3142")
        ax.set_title(t, color="#e8eaf0"); ax.set_ylabel(yl, color="#b9c0d4")
        ax.legend(ncol=5, fontsize=8, facecolor="#151823", labelcolor="#c8cee0", framealpha=0.3)
    fig.suptitle(f"Top-{topn} accuracy & drift — {len(results)} series, {cfg['engine']} engine, "
                 f"{cfg['es']}→{cfg['ee']}", color="#e8eaf0", fontsize=13)
    plt.tight_layout(); plt.savefig(out_png, dpi=110, facecolor="#0f1117")
    print("WROTE", out_png)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--source", default="ticker", choices=["ticker", "csv"])
    ap.add_argument("--ids"); ap.add_argument("--idfile"); ap.add_argument("--csv-dir")
    ap.add_argument("--count", type=int, default=0, help="target # valid series (0=all)")
    ap.add_argument("--eval-start", default="2025-01-01")
    ap.add_argument("--eval-end", default="2026-01-01")
    ap.add_argument("--target", type=float, default=0.70)
    ap.add_argument("--engine", default="full", choices=["full", "fast"])
    ap.add_argument("--workers", type=int, default=max(2, (os.cpu_count() or 4) - 2))
    ap.add_argument("--out", default="run_results.json")
    ap.add_argument("--topn", type=int, default=10)
    ap.add_argument("--min-pre", type=int, default=150)
    ap.add_argument("--min-eval", type=int, default=20)
    ap.add_argument("--liquid", action="store_true", help="filter warrants/units/flat (tickers)")
    a = ap.parse_args()

    cfg = {"source": a.source, "es": a.eval_start, "ee": a.eval_end,
           "target": a.target, "engine": a.engine,
           "min_pre": a.min_pre, "min_eval": a.min_eval}
    ids, src = resolve_ids(a)
    cfg["source"] = src
    outp = os.path.join(BASE, a.out)
    results = json.load(open(outp)) if os.path.exists(outp) else {}

    # collect target # valid (or all), skipping already-done
    todo = []
    valid = sum(1 for v in results.values() if v.get("ok"))
    for sid in ids:
        if a.count and valid + len([t for t in todo]) >= a.count + len(todo):  # rough cap
            pass
        if str(sid) in results:
            continue
        todo.append(sid)
        if a.count and (valid + len(todo)) >= a.count * 2:  # over-provision for failures
            break
    print(f"{len(ids)} ids | {len(results)} done | computing up to {len(todo)} "
          f"(target {a.count or 'all'} valid) | engine={a.engine} | workers={a.workers}", flush=True)

    init(cfg)
    done = 0
    with Pool(processes=a.workers, initializer=init, initargs=(cfg,)) as pool:
        for sid, res in pool.imap_unordered(run_one, todo):
            results[str(sid)] = res
            done += 1
            if res.get("ok"):
                valid += 1
            if done % 10 == 0:
                json.dump(results, open(outp, "w"))
                print(f"{done}/{len(todo)} computed | {valid} valid", flush=True)
            if a.count and valid >= a.count:
                print(f"reached target {a.count} valid", flush=True)
                break
    json.dump(results, open(outp, "w"))
    print(f"COMPUTE DONE: {valid} valid -> {outp}", flush=True)
    plot_top(results, a.topn, os.path.join(BASE, a.out.replace(".json", "_top.png")), cfg, a.liquid)


if __name__ == "__main__":
    main()

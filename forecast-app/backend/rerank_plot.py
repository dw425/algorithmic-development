"""Re-rank full_run by accuracy-AND-tightness (coverage - 2*width) and regenerate the
accuracy/drift line-vector graphic for the meaningful top 10 (full engine daily series)."""
import json
import os
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import data
import engine_vectors as ev

R = json.load(open("full_run.json"))
ok = {k: v for k, v in R.items() if v.get("ok") and v["n_eval"] >= 150
      and not (len(k) <= 5 and k[-1] in "UW") and 1.0 <= v["avg_width_pct"] <= 25}
score = lambda v: v["coverage"] - 2.0 * v["avg_width_pct"]
top = sorted(ok.items(), key=lambda kv: -score(kv[1]))[:10]
print("TOP 10 (accuracy & tightness):", [k for k, _ in top], flush=True)

fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(13, 10), facecolor="#0f1117")
for (sid, v), col in zip(top, plt.cm.tab10(np.linspace(0, 1, 10))):
    res = ev.run_walkforward(data.fetch(sid)["rows"], target=0.70,
                             eval_start="2025-01-01", eval_end="2026-01-01")
    rr = res["rows"]
    if len(rr) < 25:
        continue
    hit = np.array([1.0 if r["hit"] else 0.0 for r in rr])
    serr = np.array([(r["actual"] - r["pred"]) / r["pred"] for r in rr])
    racc = np.convolve(hit, np.ones(21) / 21, mode="valid") * 100
    ax1.plot(range(len(racc)), racc, color=col, lw=1.5,
             label=f"{sid} ({v['coverage']}% / {v['avg_width_pct']}%w)")
    ax2.plot(range(len(serr)), np.cumsum(serr) * 100, color=col, lw=1.5, label=sid)
ax1.axhline(70, color="#f0b429", ls="--", lw=1)
for ax, t, yl in ((ax1, "Forecast ACCURACY — 21d rolling hit-rate (accurate & TIGHT top 10)", "accuracy %"),
                  (ax2, "Forecast DRIFT — cumulative signed error", "drift %")):
    ax.set_facecolor("#151823"); ax.tick_params(colors="#8b93a7")
    for sp in ax.spines.values():
        sp.set_color("#2c3142")
    ax.set_title(t, color="#e8eaf0"); ax.set_ylabel(yl, color="#b9c0d4")
    ax.legend(ncol=5, fontsize=8, facecolor="#151823", labelcolor="#c8cee0", framealpha=0.3)
fig.suptitle("Top-10 best-forecast stocks (accuracy AND tightness) — 1,000-stock full run, all 2025",
             color="#e8eaf0", fontsize=13)
plt.tight_layout()
plt.savefig("full_run_sharp_top.png", dpi=110, facecolor="#0f1117")
print("WROTE full_run_sharp_top.png", flush=True)

"""Rank top 10 stocks by forecast accuracy from the sweep, then plot accuracy + drift
line vectors for those 10 over 2025. Output: sweep_top10.png"""
import json
import os
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import data
from engine_vectors import MODELS

RES = json.load(open(os.path.join(os.path.dirname(__file__), "sweep_results.json")))
TARGET = 0.70


def daily_series(rows, min_hist=60, recent=120, win=100):
    dates = [r["date"] for r in rows]
    p = np.array([r["close"] for r in rows], float)
    n = len(p)
    lr = np.diff(np.log(p), prepend=np.log(p[0]))
    ens = np.full(n, np.nan)
    fns = list(MODELS.values())
    for i in range(min_hist, n):
        ens[i] = float(np.mean([fn(p[max(0, i - win):i]) for fn in fns]))
    rel = (p - ens) / ens
    alpha, a0 = 1 - TARGET, 1 - TARGET
    out = []
    for i in range(min_hist, n):
        if dates[i][:4] != "2025":
            continue
        cal = rel[max(min_hist, i - recent):i]; cal = cal[~np.isnan(cal)]
        if len(cal) < 20:
            continue
        bias = float(np.mean(cal)); pred = float(ens[i]) * (1 + bias)
        c = cal - bias
        qlo, qhi = float(np.quantile(c, alpha / 2)), float(np.quantile(c, 1 - alpha / 2))
        lo, hi = pred * (1 + qlo), pred * (1 + qhi)
        actual = float(p[i]); hit = lo <= actual <= hi
        out.append((dates[i], 1.0 if hit else 0.0, (actual - pred) / pred))
        alpha = min(0.6, max(0.005, alpha + 0.05 * (a0 - (0 if hit else 1))))
    return out


# rank: forecast accuracy on REAL liquid stocks (exclude warrants/units & flat illiquid names)
elig = {k: v for k, v in RES.items()
        if v["n_2025"] >= 150                       # full 2025
        and not (len(k) == 5 and k[-1] in "UW")     # drop units/warrants
        and 1.5 <= v["avg_width_pct"] <= 20         # real movement, not flat/degenerate
        and abs(v["price_drift_pct"]) >= 3}         # the stock actually moved over the year
top = sorted(elig.items(), key=lambda kv: (-kv[1]["coverage"], kv[1]["avg_width_pct"]))[:10]
print(f"eligible after liquidity/quality filter: {len(elig)} of {len(RES)}")
print("TOP 10 by forecast accuracy (coverage):")
print(f"{'TICKER':7}{'COVERAGE':>9}{'WIDTH':>8}{'MAE':>7}{'PRICE DRIFT':>13}")
for tk, v in top:
    print(f"{tk:7}{v['coverage']:>8}%{v['avg_width_pct']:>7}%{v['mae_pct']:>6}%{v['price_drift_pct']:>12}%")

fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(13, 10), facecolor="#0f1117")
cmap = plt.cm.tab10(np.linspace(0, 1, 10))
for (tk, v), col in zip(top, cmap):
    s = daily_series(data.fetch(tk)["rows"])
    if not s:
        continue
    dates = [x[0] for x in s]
    hit = np.array([x[1] for x in s])
    serr = np.array([x[2] for x in s])
    racc = np.convolve(hit, np.ones(21) / 21, mode="valid") * 100   # 21-day rolling accuracy
    cdrift = np.cumsum(serr) * 100                                  # cumulative forecast drift
    xr = range(len(racc))
    ax1.plot(xr, racc, color=col, lw=1.6, label=f"{tk} ({v['coverage']}%)")
    ax2.plot(range(len(cdrift)), cdrift, color=col, lw=1.6, label=tk)

for ax in (ax1, ax2):
    ax.set_facecolor("#151823")
    ax.tick_params(colors="#8b93a7")
    for sp in ax.spines.values():
        sp.set_color("#2c3142")
    ax.legend(ncol=5, fontsize=8, facecolor="#151823", labelcolor="#c8cee0", framealpha=0.3)
ax1.axhline(70, color="#f0b429", ls="--", lw=1, label="target 70%")
ax1.set_title("Forecast ACCURACY — 21-day rolling hit-rate, top 10 (2025)", color="#e8eaf0")
ax1.set_ylabel("rolling accuracy %", color="#b9c0d4")
ax2.set_title("Forecast DRIFT — cumulative signed error, top 10 (2025)", color="#e8eaf0")
ax2.set_ylabel("cumulative drift %", color="#b9c0d4")
ax2.set_xlabel("2025 trading day", color="#b9c0d4")
fig.suptitle(f"Top-10 of {len(RES)} stocks swept — accuracy & drift line vectors",
             color="#e8eaf0", fontsize=14)
plt.tight_layout()
out = os.path.join(os.path.dirname(__file__), "sweep_top10.png")
plt.savefig(out, dpi=110, facecolor="#0f1117")
print("WROTE", out)

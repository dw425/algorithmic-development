import { useState, useEffect } from "react";
import { getTPA, type TPAResult, TICKERS } from "./api";
import Plot from "./Plot";

const VLABEL: Record<string, string> = {
  modifier_pct: "Modifier M (median)", modifier_mean_pct: "Modifier (mean)",
  drift_magnitude_pct: "Drift magnitude", drift_signed_pct: "Drift (signed)",
  mode_offset_pct: "Mode offset", std_pct: "Thread std",
  breach_rate_pct: "Breach rate", overshoot_max_pct: "Max overshoot",
  off_count_avg: "Off-count (avg /201)", thread_autocorr: "Thread autocorrelation",
  error_edge_mean: "Error edge (mean)",
};

export default function TPA() {
  const [ticker, setTicker] = useState("MSFT");
  const [m, setM] = useState(100);
  const [r, setR] = useState<TPAResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function load(t = ticker, mm = m) {
    setLoading(true); setErr(null);
    try { setR(await getTPA(t, mm, 0.001)); }
    catch (e) { setErr(String(e)); }
    setLoading(false);
  }
  useEffect(() => { load("MSFT", 100); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 3D threads: one semi-transparent line per candidate, winner bold, actual + breaches overlaid
  const v = r?.viz3d;
  const x = v ? v.dates.map((_, i) => i) : [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const traces: any[] = [];
  if (v) {
    for (const th of v.threads) {
      traces.push({
        type: "scatter3d", mode: "lines", showlegend: false, hoverinfo: "skip",
        x, y: x.map(() => th.k_pct), z: th.z,
        line: { color: "rgba(110,168,254,0.25)", width: 1 },
      });
    }
    traces.push({
      type: "scatter3d", mode: "lines", name: "winner thread",
      x, y: v.winner_pct, z: v.actual,
      line: { color: "#34d399", width: 4 },
    });
    if (v.breach_idx.length)
      traces.push({
        type: "scatter3d", mode: "markers", name: "breach",
        x: v.breach_idx, y: v.breach_idx.map((i) => v.winner_pct[i]),
        z: v.breach_idx.map((i) => v.actual[i]),
        marker: { color: "#f87171", size: 5 },
      });
  }

  return (
    <div>
      <p className="sub"><b>Threaded Point Analysis</b> — the refinement layer that runs <i>after</i>
        the base forecast. It explodes the basis into a fan of ±% offsets (201 points = ±10%),
        forecasts from each, and threads the winning offset over time into a <b>modifier</b>.
        Ships the modifier <b>only if it lifts accuracy out-of-sample</b> (train→forward).</p>
      <div className="controls">
        <label>Stock:&nbsp;
          <select value={ticker} onChange={(e) => { setTicker(e.target.value); load(e.target.value, m); }}>
            {TICKERS.map((t) => <option key={t}>{t}</option>)}
          </select></label>
        <label>Range ±{(m * 0.1).toFixed(0)}% (m={m}):&nbsp;
          <select value={m} onChange={(e) => { const mm = Number(e.target.value); setM(mm); load(ticker, mm); }}>
            {[50, 100, 200].map((mm) => <option key={mm} value={mm}>{mm}</option>)}
          </select></label>
        {loading && <span className="kv">threading…</span>}
      </div>
      {err && <div className="err">{err}</div>}

      {r && !r.error && <>
        <div className="cards">
          <div className="card"><div className={`cnum ${r.significant ? "good" : "bad"}`}>{r.modifier_pct}%</div>
            <div className="clab">Threaded modifier M</div></div>
          <div className="card"><div className={`cnum ${r.accuracy_lift_pct > 0 ? "good" : "mid"}`}>{r.accuracy_lift_pct}%</div>
            <div className="clab">Out-of-sample accuracy lift</div></div>
          <div className="card"><div className={`cnum ${r.significant ? "good" : "bad"}`}>{r.significant ? "YES" : "NO"}</div>
            <div className="clab">Significant (autocorr+edge)</div></div>
          <div className="card"><div className="cnum">{r.points}</div><div className="clab">fan points (±{r.range_pct}%)</div></div>
          <div className="card"><div className="cnum">{r.vectors.breach_rate_pct}%</div><div className="clab">breach rate</div></div>
          <div className="card"><div className="cnum">{r.n_steps}</div><div className="clab">steps ({r.train_steps}tr/{r.forward_steps}fwd)</div></div>
        </div>

        {!r.significant && <div className="kv" style={{ color: "#f0b429" }}>
          ⚠ Thread autocorrelation ≈ {r.vectors.thread_autocorr} — winners don't connect cycle-to-cycle,
          so the modifier is NOT signal here. TPA correctly withholds it (no fake lift).</div>}

        <h2>3D threaded deviation paths (time × offset% × forecast)</h2>
        <Plot height={520} data={traces} layout={{
          scene: { xaxis: { title: "step", color: "#8b93a7" },
                   yaxis: { title: "offset %", color: "#8b93a7" },
                   zaxis: { title: "forecast $", color: "#8b93a7" }, bgcolor: "#151823" } }} />

        <h2>Traced vectors</h2>
        <table className="mini">
          <thead><tr><th>Vector</th><th>Value</th></tr></thead>
          <tbody>
            {Object.entries(r.vectors).map(([k, val]) => (
              <tr key={k}><td>{VLABEL[k] || k}</td><td>{val}{k.endsWith("_pct") ? "%" : ""}</td></tr>
            ))}
          </tbody>
        </table>
      </>}
      {r?.error && <div className="err">{r.error}</div>}
    </div>
  );
}

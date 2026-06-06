import { useState, useEffect } from "react";
import { getForecast, type RunResult } from "./api";
import { useGlobal } from "./GlobalControls";
import Plot from "./Plot";

export default function Scenario() {
  const g = useGlobal();
  const [base, setBase] = useState<RunResult | null>(null);
  const [shock, setShock] = useState(0);      // % shift applied to the forecast
  const [widen, setWiden] = useState(0);      // % widen of the band
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const ticker = g.stocks[0] || "MSFT";

  async function load() {
    setLoading(true); setErr(null);
    try { setBase(await getForecast(ticker, g.target / 100, g.start, g.end, g.granularity)); }
    catch (e) { setErr(String(e)); }
    setLoading(false);
  }
  useEffect(() => { load(); }, [g.runKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // parametric what-if: shift forecast by `shock`%, widen band by `widen`%, recompute coverage
  let scen = null as null | { coverage: number; width: number; rows: typeof base.rows };
  if (base) {
    const s = shock / 100, w = 1 + widen / 100;
    let hits = 0; const ws: number[] = [];
    const rows = base.rows.map((r) => {
      const pred = r.pred * (1 + s);
      const half = ((r.hi - r.lo) / 2) * w;
      const lo = pred - half, hi = pred + half;
      const hit = lo <= r.actual && r.actual <= hi;
      hits += hit ? 1 : 0; ws.push((hi - lo) / pred * 100);
      return { ...r, pred, lo, hi, hit };
    });
    scen = { coverage: +(hits / rows.length * 100).toFixed(1),
             width: +(ws.reduce((a, b) => a + b, 0) / ws.length).toFixed(2), rows };
  }

  return (
    <div>
      <h1>Scenario Planner — parametric what-if ({ticker})</h1>
      <p className="sub">Adjust the scenario vectors and watch coverage/width change vs baseline.
        Pure parametric — no external model. Test "what if the forecast drifted X% / the band were Y% wider".</p>

      <div className="controls">
        <label>Drift shock: <b>{shock > 0 ? "+" : ""}{shock}%</b>&nbsp;
          <input type="range" min={-15} max={15} step={0.5} value={shock} onChange={(e) => setShock(Number(e.target.value))} /></label>
        <label>Band widen: <b>{widen > 0 ? "+" : ""}{widen}%</b>&nbsp;
          <input type="range" min={-50} max={100} step={5} value={widen} onChange={(e) => setWiden(Number(e.target.value))} /></label>
        <button className="link" onClick={() => { setShock(0); setWiden(0); }}>reset</button>
      </div>
      {loading && <div className="kv">computing…</div>}
      {err && <div className="err">{err}</div>}

      {base && scen && <>
        <div className="cards">
          <div className="card"><div className="cnum">{base.coverage}%</div><div className="clab">baseline coverage</div></div>
          <div className="card"><div className={`cnum ${scen.coverage >= base.coverage ? "good" : "bad"}`}>{scen.coverage}%</div><div className="clab">scenario coverage</div></div>
          <div className="card"><div className="cnum">{base.avg_width_pct}%</div><div className="clab">baseline width</div></div>
          <div className="card"><div className="cnum">{scen.width}%</div><div className="clab">scenario width</div></div>
          <div className="card"><div className={`cnum ${scen.coverage - base.coverage >= 0 ? "good" : "bad"}`}>
            {(scen.coverage - base.coverage).toFixed(1)}pp</div><div className="clab">coverage Δ</div></div>
        </div>
        <h2>Baseline vs scenario range</h2>
        <Plot height={420} data={[
          { x: scen.rows.map((r) => r.date), y: scen.rows.map((r) => r.hi), mode: "lines", line: { width: 0 }, showlegend: false, hoverinfo: "skip" },
          { x: scen.rows.map((r) => r.date), y: scen.rows.map((r) => r.lo), name: "scenario range", mode: "lines", line: { width: 0 }, fill: "tonexty", fillcolor: "rgba(240,180,41,0.18)" },
          { x: base.rows.map((r) => r.date), y: base.rows.map((r) => r.pred), name: "baseline forecast", mode: "lines", line: { color: "#3b82f6", width: 1.5, dash: "dot" } },
          { x: scen.rows.map((r) => r.date), y: scen.rows.map((r) => r.pred), name: "scenario forecast", mode: "lines", line: { color: "#f0b429", width: 2 } },
          { x: base.rows.map((r) => r.date), y: base.rows.map((r) => r.actual), name: "actual", mode: "lines", line: { color: "#34d399", width: 1.5 } },
        ]} layout={{ yaxis: { title: "$ close" } }} />
      </>}
    </div>
  );
}

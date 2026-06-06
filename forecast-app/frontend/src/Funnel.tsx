import { useState, useEffect } from "react";
import { getWalkthrough, type Walkthrough } from "./api";
import { useGlobal } from "./GlobalControls";
import Plot from "./Plot";

export default function Funnel() {
  const g = useGlobal();
  const [wt, setWt] = useState<Walkthrough | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const ticker = g.stocks[0] || "MSFT";

  async function load() {
    setLoading(true); setErr(null);
    try { setWt(await getWalkthrough(ticker, g.target / 100)); }
    catch (e) { setErr(String(e)); }
    setLoading(false);
  }
  useEffect(() => { load(); }, [g.runKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const f = wt?.phases?.funnel;
  return (
    <div>
      <h1>Funnel — prediction-vector drop-off ({ticker})</h1>
      <p className="sub">How the 1,980 generated vectors narrow to one forecast through the
        refinement stages. The drop-off shows where predictions get filtered out.</p>
      {loading && <div className="kv">computing…</div>}
      {err && <div className="err">{err}</div>}
      {f && <>
        <div className="kv">From {f[0].count} vectors → final point. First selected stock; change it on the left.</div>
        <Plot height={460} data={[{
          type: "funnel", y: f.map((s: { stage: string }) => s.stage),
          x: f.map((s: { count: number }) => s.count), textinfo: "value+percent initial",
          marker: { color: ["#3b82f6", "#22d3ee", "#34d399", "#f0b429", "#f87171"] },
        }]} layout={{ margin: { l: 240, r: 16, t: 10, b: 20 } }} />
        <table className="mini" style={{ marginTop: 12 }}>
          <thead><tr><th>Stage</th><th>Vectors</th><th>% of start</th></tr></thead>
          <tbody>
            {f.map((s: { stage: string; count: number }, i: number) => (
              <tr key={i}><td>{s.stage}</td><td>{s.count}</td>
                <td>{((s.count / f[0].count) * 100).toFixed(1)}%</td></tr>
            ))}
          </tbody>
        </table>
      </>}
    </div>
  );
}

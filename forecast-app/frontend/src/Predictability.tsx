import { useState, useEffect } from "react";
import { getPredictability } from "./api";
import { useGlobal } from "./GlobalControls";
import PageArchetype from "./PageArchetype";
import Plot from "./Plot";

export default function Predictability() {
  const g = useGlobal();
  const ticker = g.stocks[0] || "MSFT";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [d, setD] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { setErr(null); getPredictability(ticker, g.granularity).then(setD).catch((e) => setErr(String(e))); }, [g.runKey]); // eslint-disable-line
  if (err) return <div className="err">{err}</div>;
  if (!d) return <PageArchetype title={`Predictability — ${ticker}`} viz={<div className="kv">loading…</div>} />;

  const pr = d.predictability;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tk = d.takens as any[];
  const viz = <>
    <div className="kv">Hurst <b>{pr.hurst}</b> · Lyapunov <b>{pr.lyapunov}</b> · {pr.label} · horizon ~{pr.horizon_days}d</div>
    <Plot height={460} data={[{
      type: "scatter3d", mode: "markers", name: "Takens attractor",
      x: tk.map((p) => p[0]), y: tk.map((p) => p[1]), z: tk.map((p) => p[2]),
      marker: { size: 2.5, color: "#6ea8fe" },
    }]} layout={{ scene: { xaxis: { title: "r(t)" }, yaxis: { title: "r(t+τ)" }, zaxis: { title: "r(t+2τ)" }, bgcolor: "#151823" } }} />
  </>;
  const data = <table className="mini"><thead><tr><th>Metric</th><th>Value</th><th>Meaning</th></tr></thead><tbody>
    <tr><td>Hurst</td><td>{pr.hurst}</td><td>0.5 random · &gt;0.5 trend · &lt;0.5 revert</td></tr>
    <tr><td>Lyapunov</td><td>{pr.lyapunov}</td><td>&gt;0 chaotic/sensitive</td></tr>
    <tr><td>Horizon</td><td>{pr.horizon_days}d</td><td>rough predictability ceiling</td></tr>
  </tbody></table>;
  const note = <div className="kv">Takens delay-embedding reconstructs the attractor from returns. Tight structure = more forecastable; cloud = noise.</div>;
  return <PageArchetype title={`Predictability — ${ticker}`} viz={viz} data={data} control={note} adjustment={note} />;
}

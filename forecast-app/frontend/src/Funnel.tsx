import { useState, useEffect } from "react";
import { getFunnel } from "./api";
import { useGlobal } from "./GlobalControls";
import PageArchetype from "./PageArchetype";
import Plot from "./Plot";

export default function Funnel() {
  const g = useGlobal();
  const ticker = g.stocks[0] || "MSFT";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [d, setD] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { setErr(null); getFunnel(ticker, g.granularity).then(setD).catch((e) => setErr(String(e))); }, [g.runKey]); // eslint-disable-line
  if (err) return <div className="err">{err}</div>;
  if (!d || !d.funnel.length) return <PageArchetype title={`Funnel — ${ticker}`} viz={<div className="kv">loading…</div>} />;
  const f = d.funnel;
  const viz = <Plot height={420} data={[{ type: "funnel", y: f.map((s: { stage: string }) => s.stage), x: f.map((s: { count: number }) => s.count), textinfo: "value+percent initial", marker: { color: ["#3b82f6", "#22d3ee", "#34d399", "#f0b429", "#f87171"] } }]} layout={{ margin: { l: 160, r: 16, t: 10, b: 20 } }} />;
  const data = <table className="mini"><thead><tr><th>Stage</th><th>Vectors</th><th>% of start</th></tr></thead>
    <tbody>{f.map((s: { stage: string; count: number }, i: number) => <tr key={i}><td>{s.stage}</td><td>{s.count}</td><td>{((s.count / f[0].count) * 100).toFixed(1)}%</td></tr>)}</tbody></table>;
  const note = <div className="kv">Vector drop-off through the refinement stages — where predictions get filtered. Monotonic by construction.</div>;
  return <PageArchetype title={`Funnel — ${ticker}`} viz={viz} data={data} control={note} adjustment={note} />;
}

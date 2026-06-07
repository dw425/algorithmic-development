import { useState, useEffect } from "react";
import { getMultiScale } from "./api";
import { useGlobal } from "./GlobalControls";
import PageArchetype from "./PageArchetype";
import Plot from "./Plot";

const COL: Record<string, string> = { "1": "#3b82f6", "2": "#22d3ee", "5": "#34d399", "10": "#f0b429", "21": "#f87171" };

export default function MultiScale() {
  const g = useGlobal();
  const ticker = g.stocks[0] || "MSFT";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [d, setD] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { setErr(null); getMultiScale(ticker, g.granularity).then(setD).catch((e) => setErr(String(e))); }, [g.runKey]); // eslint-disable-line
  if (err) return <div className="err">{err}</div>;
  if (!d) return <PageArchetype title={`Multi-scale — ${ticker}`} viz={<div className="kv">loading…</div>} />;

  const viz = <Plot data={Object.entries(d.ladder).map(([s, vals]) => ({
    y: vals as number[], mode: "lines", name: `scale ${s}`, line: { color: COL[s] || "#888" },
  }))} layout={{ yaxis: { title: "$ (block-mean)" }, xaxis: { title: "block index" } }} />;
  const data = <table className="mini"><thead><tr><th>Scale</th><th>Points</th></tr></thead>
    <tbody>{Object.entries(d.ladder).map(([s, v]) => <tr key={s}><td>{s}</td><td>{(v as number[]).length}</td></tr>)}</tbody></table>;
  const note = <div className="kv">Block-mean aggregation across the resolution ladder. Coarser scales smooth the series; the engine forecasts across all scales.</div>;
  return <PageArchetype title={`Multi-scale — ${ticker}`} viz={viz} data={data} control={note} adjustment={note} />;
}

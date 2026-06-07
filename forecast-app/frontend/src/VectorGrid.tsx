import { useState, useEffect } from "react";
import { getCloud } from "./api";
import { useGlobal } from "./GlobalControls";
import PageArchetype from "./PageArchetype";
import Plot from "./Plot";

export default function VectorGrid() {
  const g = useGlobal();
  const ticker = g.stocks[0] || "MSFT";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [d, setD] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { setErr(null); getCloud(ticker, g.granularity).then(setD).catch((e) => setErr(String(e))); }, [g.runKey]); // eslint-disable-line
  if (err) return <div className="err">{err}</div>;
  if (!d) return <PageArchetype title={`Vector grid — ${ticker}`} viz={<div className="kv">loading…</div>} />;
  const centers = d.hist_edges.slice(0, -1).map((e: number, i: number) => (e + d.hist_edges[i + 1]) / 2);
  const viz = <>
    <div className="kv">{d.n_vectors} vectors (11 models × 12 lookbacks × 5 scales × 3 points) · {d.n_used} in-bounds · last ${d.last}</div>
    <Plot data={[
      { type: "bar", x: centers, y: d.hist_counts, name: "vectors", marker: { color: "#3b82f6" } },
      { x: [d.last, d.last], y: [0, Math.max(...d.hist_counts)], mode: "lines", name: "last", line: { color: "#f0b429", dash: "dot" } },
    ]} layout={{ xaxis: { title: "predicted next value ($)" }, yaxis: { title: "# vectors" } }} />
  </>;
  const data = <div className="kv">Total grid = {d.n_vectors}; in-bounds (after clip) = {d.n_used}. The cloud's spread feeds the 3D clustering + consensus (next components).</div>;
  return <PageArchetype title={`Vector grid — ${ticker}`} viz={viz} data={data} control={data} adjustment={data} />;
}

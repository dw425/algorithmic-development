import { useState, useEffect } from "react";
import { getConstellation, type Constellation as C, TICKERS } from "./api";
import Plot from "./Plot";

const PALETTE = ["#3b82f6", "#34d399", "#f0b429", "#f87171", "#a78bfa", "#22d3ee", "#fb923c", "#e879f9"];

export default function Constellation() {
  const [picked, setPicked] = useState<string[]>(TICKERS.slice());
  const [data, setData] = useState<C | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    setLoading(true); setErr(null);
    try { setData(await getConstellation(picked)); }
    catch (e) { setErr(String(e)); }
    setLoading(false);
  }
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function toggle(t: string) {
    setPicked((p) => p.includes(t) ? p.filter((x) => x !== t) : (p.length < 10 ? [...p, t] : p));
  }

  // community centroids for dependency edges
  const centroids: Record<number, { x: number; y: number }> = {};
  if (data) {
    data.communities.forEach((c) => {
      const ms = data.nodes.filter((n) => n.community === c.id);
      centroids[c.id] = { x: ms.reduce((s, n) => s + n.x, 0) / (ms.length || 1),
                          y: ms.reduce((s, n) => s + n.y, 0) / (ms.length || 1) };
    });
  }

  const nodeTraces = data ? data.communities.map((c) => {
    const ms = data.nodes.filter((n) => n.community === c.id);
    return {
      type: "scatter", mode: "markers+text",
      name: `cluster ${c.id} (${c.size})`,
      x: ms.map((n) => n.x), y: ms.map((n) => n.y), text: ms.map((n) => n.id),
      textposition: "top center", textfont: { size: 9, color: "#c8cee0" },
      marker: { size: ms.map((n) => 12 + Math.min(Math.abs(n.drift_pct), 60) * 0.4),
                color: PALETTE[c.id % PALETTE.length], opacity: 0.85,
                line: { color: "#0f1117", width: 1 } },
    };
  }) : [];
  const edgeTraces = data ? data.edges.map((e) => ({
    type: "scatter", mode: "lines", showlegend: false, hoverinfo: "text",
    text: `cluster ${e.source}↔${e.target}: dependency ${e.weight}`,
    x: [centroids[e.source]?.x, centroids[e.target]?.x],
    y: [centroids[e.source]?.y, centroids[e.target]?.y],
    line: { color: "#f0b429", width: Math.max(1, Math.min(e.weight * 1.5, 8)) },
  })) : [];

  return (
    <div>
      <p className="sub">Data-gravity constellation: each stock is a node placed by
        force-directed layout over return-correlation; <b>Louvain community detection</b>
        colors the clusters; gold lines are <b>cluster-to-cluster dependency</b>. Node size = |drift|.</p>
      <div className="controls" style={{ flexWrap: "wrap" }}>
        {TICKERS.map((t) => (
          <label key={t} className={`chip ${picked.includes(t) ? "on" : ""}`} style={{ cursor: "pointer" }}>
            <input type="checkbox" checked={picked.includes(t)} onChange={() => toggle(t)}
              style={{ marginRight: 4 }} />{t}
          </label>
        ))}
        <button onClick={load} disabled={loading || picked.length < 2}>
          {loading ? "Mapping…" : `Map ${picked.length} stocks`}</button>
      </div>
      {err && <div className="err">{err}</div>}

      {data && <>
        <div className="badges">
          <span>{data.n} nodes</span>
          <span>{data.n_communities} Louvain communities</span>
          <span>{data.days} days</span>
          <span>{data.edges.length} cluster dependencies</span>
        </div>
        <Plot height={520} data={[...edgeTraces, ...nodeTraces]}
          layout={{ xaxis: { visible: false }, yaxis: { visible: false } }} />

        <h2>Communities (data-gravity clusters)</h2>
        <table className="mini">
          <thead><tr><th>Cluster</th><th>Size</th><th>Members</th><th>Avg drift</th></tr></thead>
          <tbody>
            {data.communities.map((c) => (
              <tr key={c.id}>
                <td><span className="chip" style={{ background: PALETTE[c.id % PALETTE.length], color: "#0f1117" }}>{c.id}</span></td>
                <td>{c.size}</td><td>{c.members.join(", ")}</td><td>{c.avg_drift_pct}%</td>
              </tr>
            ))}
          </tbody>
        </table>

        {data.edges.length > 0 && <>
          <h2>Cluster-to-cluster dependency</h2>
          <table className="mini">
            <thead><tr><th>From</th><th>To</th><th>Dependency weight</th></tr></thead>
            <tbody>
              {data.edges.sort((a, b) => b.weight - a.weight).map((e, i) => (
                <tr key={i}><td>cluster {e.source}</td><td>cluster {e.target}</td><td>{e.weight}</td></tr>
              ))}
            </tbody>
          </table>
        </>}
      </>}
    </div>
  );
}

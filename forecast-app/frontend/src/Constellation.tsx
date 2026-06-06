import { useState, useEffect } from "react";
import { getConstellation, type Constellation as C } from "./api";
import { useGlobal } from "./GlobalControls";
import ConstellationCanvas from "./ConstellationCanvas";

const PALETTE = ["#3b82f6", "#34d399", "#f0b429", "#f87171", "#a78bfa", "#22d3ee", "#fb923c", "#e879f9"];

export default function Constellation() {
  const g = useGlobal();
  const [data, setData] = useState<C | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    if (g.stocks.length < 2) { setData(null); return; }
    setLoading(true); setErr(null);
    try { setData(await getConstellation(g.stocks, g.start, g.end)); }
    catch (e) { setErr(String(e)); }
    setLoading(false);
  }
  useEffect(() => { load(); }, [g.runKey]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div>
      <h1>Spatial constellation — {data?.n ?? g.stocks.length} stocks</h1>
      <p className="sub">Data-gravity constellation (D3 canvas): each stock is a star placed by
        force-directed layout over return-correlation; <b>Louvain community detection</b> colors
        the clusters (convex-hull boundaries + density glow). Node size = |drift|.</p>
      <div className="controls">
        <span className="kv">{g.stocks.length} stocks selected (pick on the left, then Apply)</span>
        {loading && <span className="kv">mapping…</span>}
      </div>
      {g.stocks.length < 2 && <div className="kv">Select at least 2 stocks on the left.</div>}
      {err && <div className="err">{err}</div>}

      {data && <>
        <div className="badges">
          <span>{data.n} nodes</span>
          <span>{data.n_communities} Louvain communities</span>
          <span>{data.days} days</span>
          <span>{data.edges.length} cluster dependencies</span>
        </div>
        <ConstellationCanvas nodes={data.nodes} />

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

import { useState, useEffect } from "react";
import { getConstellation, type Constellation as C } from "./api";
import { useGlobal } from "./GlobalControls";
import Plot from "./Plot";

export default function DependencyMapper() {
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

  // build symmetric cluster-to-cluster dependency matrix
  let z: number[][] = [], labels: string[] = [];
  if (data) {
    const nc = data.n_communities;
    labels = Array.from({ length: nc }, (_, i) => `C${i}`);
    z = Array.from({ length: nc }, () => Array(nc).fill(0));
    data.edges.forEach((e) => { z[e.source][e.target] = e.weight; z[e.target][e.source] = e.weight; });
  }

  return (
    <div>
      <h1>Dependency mapper — cluster-to-cluster</h1>
      <p className="sub">How the Louvain clusters depend on each other (summed cross-cluster
        return-correlation). Brighter = stronger dependency between two clusters.</p>
      {loading && <div className="kv">computing…</div>}
      {g.stocks.length < 2 && <div className="kv">Select ≥2 stocks on the left.</div>}
      {err && <div className="err">{err}</div>}

      {data && <>
        <h2>Dependency matrix</h2>
        <Plot height={420} data={[{
          type: "heatmap", z, x: labels, y: labels, colorscale: "Viridis",
          showscale: true, hoverongaps: false,
        }]} layout={{ margin: { l: 50, r: 16, t: 10, b: 40 } }} />

        <h2>Clusters & members</h2>
        <table className="mini">
          <thead><tr><th>Cluster</th><th>Members</th><th>Size</th><th>Avg drift</th></tr></thead>
          <tbody>
            {data.communities.map((c) => (
              <tr key={c.id}><td>C{c.id}</td><td>{c.members.join(", ")}</td>
                <td>{c.size}</td><td>{c.avg_drift_pct}%</td></tr>
            ))}
          </tbody>
        </table>

        <h2>Dependency edges (ranked)</h2>
        <table className="mini">
          <thead><tr><th>From</th><th>To</th><th>Weight</th></tr></thead>
          <tbody>
            {[...data.edges].sort((a, b) => b.weight - a.weight).map((e, i) => (
              <tr key={i}><td>C{e.source}</td><td>C{e.target}</td><td>{e.weight}</td></tr>
            ))}
          </tbody>
        </table>
      </>}
    </div>
  );
}

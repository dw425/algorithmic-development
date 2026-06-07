import { useState, useEffect } from "react";
import { getLouvain } from "./api";
import { useGlobal } from "./GlobalControls";
import PageArchetype from "./PageArchetype";
import Plot from "./Plot";

export default function Dependency() {
  const g = useGlobal();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [d, setD] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (g.stocks.length < 2) { setD(null); return; }
    setErr(null); getLouvain(g.stocks).then(setD).catch((e) => setErr(String(e)));
  }, [g.runKey]); // eslint-disable-line
  if (err) return <div className="err">{err}</div>;
  if (g.stocks.length < 2) return <PageArchetype title="Dependency mapper" viz={<div className="kv">select ≥2 stocks on the left</div>} />;
  if (!d) return <PageArchetype title="Dependency mapper" viz={<div className="kv">loading…</div>} />;

  const labels = (d.communities || []).map((c: { id: number }) => `C${c.id}`);
  const viz = <>
    <div className="kv">{d.n_communities} Louvain communities across {g.stocks.length} stocks · {(d.edges || []).length} cluster dependencies</div>
    <Plot height={380} data={[{ type: "heatmap", z: d.dep_matrix, x: labels, y: labels, colorscale: "Viridis" }]}
      layout={{ margin: { l: 50, r: 16, t: 10, b: 40 } }} />
  </>;
  const data = <table className="mini"><thead><tr><th>Cluster</th><th>Members</th></tr></thead>
    <tbody>{(d.communities || []).map((c: { id: number; members: string[] }) => <tr key={c.id}><td>C{c.id}</td><td>{c.members.join(", ")}</td></tr>)}</tbody></table>;
  const note = <div className="kv">Louvain community detection on return-correlation; heatmap = summed cross-cluster dependency (data gravity).</div>;
  return <PageArchetype title="Dependency mapper" viz={viz} data={data} control={note} adjustment={note} />;
}

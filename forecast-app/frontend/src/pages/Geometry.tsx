import { useState, useEffect, useMemo } from "react";
import { getCloud, getGeo, getFunnel, getLouvain } from "../api";
import { useGlobal } from "../GlobalControls";
import { Card, KPI, PageTitle, Field, Select, Loading, ErrorBox, Button } from "../ui";
import Plot from "../Plot";
import { layoutRadial, layoutTier, layoutDag, posEdges, type GNode, type GEdge } from "../constellationLayout";

function useStock() {
  const g = useGlobal();
  const [t, setT] = useState(g.stocks[0] || "AAPL");
  const picker = <Field label="Stock"><Select value={t} onChange={setT}>{g.stocks.map((s) => <option key={s}>{s}</option>)}</Select></Field>;
  return { t, picker, g };
}

export function VectorCloud() {
  const { t, picker, g } = useStock();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [d, setD] = useState<any>(null); const [e, setE] = useState<string | null>(null);
  useEffect(() => { setD(null); getCloud(t, g.granularity).then(setD).catch((x) => setE(String(x))); }, [t, g.runKey]); // eslint-disable-line
  return (<div className="space-y-4"><PageTitle title="Vector cloud" subtitle="The 1,980-vector next-step cloud — where the forecasts cluster." />{picker}
    {e && <ErrorBox msg={e} />}{!d && !e && <Loading />}
    {d && <><div className="grid grid-cols-3 gap-3"><KPI label="vectors" value={d.n_vectors} /><KPI label="in-bounds" value={d.n_used} /><KPI label="last close" value={`$${d.last}`} /></div>
      <Card title={`${t} — 1,980-vector cloud`}><Plot data={[{ x: d.hist_edges.slice(0, -1), y: d.hist_counts, type: "bar", marker: { color: "#22d3ee" } }, { x: [d.last, d.last], y: [0, Math.max(...d.hist_counts)], mode: "lines", line: { color: "#e5e7eb", dash: "dot" }, name: "last" }]} layout={{ xaxis: { title: "$ predicted" }, yaxis: { title: "# vectors" }, bargap: 0.02 }} /></Card></>}</div>);
}

export function Cluster3D() {
  const { t, picker, g } = useStock();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [d, setD] = useState<any>(null); const [e, setE] = useState<string | null>(null);
  useEffect(() => { setD(null); getGeo(t, g.granularity).then(setD).catch((x) => setE(String(x))); }, [t, g.runKey]); // eslint-disable-line
  const pts = d?.points || [];
  return (<div className="space-y-4"><PageTitle title="3D clusters" subtitle="1,980 vectors embedded in 3D (reach / value / drift), clustered three ways with consensus." />{picker}
    {e && <ErrorBox msg={e} />}{!d && !e && <Loading />}
    {d && <><div className="grid grid-cols-2 md:grid-cols-4 gap-3"><KPI label="forecast" value={`$${d.forecast}`} /><KPI label="consensus" value={`${d.consensus_pct}%`} /><KPI label="within 1σ core" value={`${d.mahalanobis_pct}%`} /><KPI label="Davies-Bouldin" value={d.davies_bouldin} /></div>
      <Card title={`${t} — 3D embedding`}><Plot height={460} data={[{ type: "scatter3d", mode: "markers", x: pts.map((p: { x: number }) => p.x), y: pts.map((p: { y: number }) => p.y), z: pts.map((p: { z: number }) => p.z), marker: { size: 2.5, color: pts.map((p: { cluster: number }) => p.cluster), colorscale: "Viridis" } }]} layout={{ scene: { xaxis: { title: "reach" }, yaxis: { title: "value" }, zaxis: { title: "drift%" } } }} /></Card></>}</div>);
}

export function FunnelView() {
  const { t, picker, g } = useStock();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [d, setD] = useState<any>(null); const [e, setE] = useState<string | null>(null);
  useEffect(() => { setD(null); getFunnel(t, g.granularity).then(setD).catch((x) => setE(String(x))); }, [t, g.runKey]); // eslint-disable-line
  const f = d?.funnel || [];
  return (<div className="space-y-4"><PageTitle title="Funnel" subtitle="Vector drop-off through the refinement stages." />{picker}
    {e && <ErrorBox msg={e} />}{!d && !e && <Loading />}
    {d && <Card title={`${t} — refinement funnel`}><Plot height={320} data={[{ type: "bar", orientation: "h", y: f.map((x: { stage: string }) => x.stage).reverse(), x: f.map((x: { count: number }) => x.count).reverse(), marker: { color: "#22d3ee" }, text: f.map((x: { count: number }) => x.count).reverse(), textposition: "auto" }]} layout={{ xaxis: { title: "# vectors" } }} /></Card>}</div>);
}

const PAL = ["#6366f1", "#22c55e", "#fbbf24", "#f87171", "#22d3ee", "#a855f7", "#fb923c", "#e879f9"];
function useLouvain() {
  const g = useGlobal();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [d, setD] = useState<any>(null); const [e, setE] = useState<string | null>(null);
  useEffect(() => { setD(null); getLouvain(g.stocks).then(setD).catch((x) => setE(String(x))); }, [g.runKey, g.stocks.join(",")]); // eslint-disable-line
  return { d, e, g };
}

export function ConstellationView() {
  const { d, e } = useLouvain();
  const [layout, setLayout] = useState<"radial" | "tier" | "dag">("radial");
  const [sel, setSel] = useState<string | null>(null);
  const W = 1000, H = 640;
  const graph = useMemo(() => {
    if (!d?.nodes) return null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ns: any[] = d.nodes;
    const nodes: GNode[] = ns.map((n) => ({ node_id: n.id, name: n.id, kind: `community ${n.community}` }));
    const attrs: Record<string, Record<string, string>> = {};
    ns.forEach((n) => { attrs[n.id] = { community_id: String(n.community), color: PAL[n.community % PAL.length] }; });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const edges: GEdge[] = (d.edges || []).map((x: any, i: number) => ({ edge_id: "e" + i, source_node_id: ns[x.source]?.id, target_node_id: ns[x.target]?.id })).filter((x: GEdge) => x.source_node_id && x.target_node_id);
    return { nodes, edges, attrs };
  }, [d]);
  const pos = useMemo(() => {
    if (!graph) return [];
    return layout === "dag" ? layoutDag(graph.nodes, graph.edges, graph.attrs, W, H) : layout === "tier" ? layoutTier(graph.nodes, graph.attrs, W, H) : layoutRadial(graph.nodes, graph.attrs, W / 2, H / 2, 280);
  }, [graph, layout]);
  const pe = useMemo(() => (graph ? posEdges(pos, graph.edges) : []), [pos, graph]);
  const inc = new Set<string>(); if (sel) pe.forEach((x) => { if (x.source_node_id === sel || x.target_node_id === sel) { inc.add(x.source_node_id); inc.add(x.target_node_id); } });
  return (<div className="space-y-4"><PageTitle title="Constellation" subtitle="Ported from the ETL-dep-viz constellation — data-gravity communities of your selected stocks. Click a node to trace its links." />
    <div className="flex gap-2">{(["radial", "tier", "dag"] as const).map((l) => <Button key={l} variant={layout === l ? "primary" : "ghost"} onClick={() => setLayout(l)}>{l === "radial" ? "Constellation" : l === "tier" ? "Tier bands" : "Pipeline DAG"}</Button>)}</div>
    {e && <ErrorBox msg={e} />}{!graph && !e && <Loading what="building constellation" />}
    {graph && <Card><svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: 560 }}>
      <g opacity={0.4}>{pe.map((x) => { const hot = sel && (x.source_node_id === sel || x.target_node_id === sel); return <line key={x.edge_id} x1={x.x1} y1={x.y1} x2={x.x2} y2={x.y2} stroke={hot ? "#fbbf24" : "#475569"} strokeWidth={hot ? 2 : 0.8} />; })}</g>
      <g>{pos.map((n) => { const dim = sel && n.node_id !== sel && !inc.has(n.node_id); return (<g key={n.node_id} style={{ cursor: "pointer" }} onClick={() => setSel(n.node_id === sel ? null : n.node_id)}>
        <circle cx={n.x} cy={n.y} r={n.node_id === sel ? 11 : 7} fill={n.color} opacity={dim ? 0.2 : 0.9} stroke={n.node_id === sel ? "#fff" : "none"} strokeWidth={1.5} />
        <text x={n.x + 10} y={n.y + 4} fill={dim ? "#3a4256" : "#c8cee0"} fontSize={12}>{n.name}</text></g>); })}</g>
    </svg>{sel && <div className="text-sm text-muted-foreground mt-2">Selected <b className="text-foreground">{sel}</b> — {Math.max(0, inc.size - 1)} connection(s).</div>}</Card>}</div>);
}

export function DependencyMap() {
  const { d, e } = useLouvain();
  return (<div className="space-y-4"><PageTitle title="Dependency map" subtitle="Louvain data-gravity communities + cluster-to-cluster dependency across the selected stocks." />
    {e && <ErrorBox msg={e} />}{!d && !e && <Loading />}
    {d && <><div className="grid grid-cols-2 gap-3"><KPI label="communities" value={d.n_communities} /><KPI label="stocks" value={(d.nodes || []).length} /></div>
      <Card title="Communities"><table className="w-full text-sm"><thead><tr className="text-left text-muted-foreground border-b border-border"><th className="py-1.5">Stock</th><th>Community</th></tr></thead>
        <tbody>{(d.nodes || []).map((n: { id: string; community: number }) => <tr key={n.id} className="border-b border-border/40"><td className="py-1 font-semibold">{n.id}</td><td><span className="rounded px-1.5 py-0.5 text-xs" style={{ background: PAL[n.community % PAL.length] + "33", color: PAL[n.community % PAL.length] }}>c{n.community}</span></td></tr>)}</tbody></table></Card>
      {d.dep_matrix && <Card title="Cluster dependency"><Plot height={300} data={[{ z: d.dep_matrix, type: "heatmap", colorscale: "Viridis" }]} layout={{}} /></Card>}</>}</div>);
}

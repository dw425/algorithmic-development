import { useState, useEffect, useCallback, useRef, type DragEvent } from "react";
import {
  ReactFlow, ReactFlowProvider, Background, Controls, MiniMap, addEdge, useNodesState,
  useEdgesState, Handle, Position, useReactFlow, type Node, type Edge, type Connection,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { getNodes, runFlow } from "./api";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Def = { type: string; category: string; label: string; color: string; inputs: any[]; outputs: any[]; params: any[] };
const STATUS_COLOR: Record<string, string> = { done: "#22c55e", error: "#ef4444", running: "#3b82f6", pending: "#64748b" };

// ---- custom node ----
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function DFNode({ data, selected }: { data: any; selected: boolean }) {
  const def: Def = data.def;
  const res = data.result;
  const status = res ? res.status : "pending";
  const metric = res?.summary?.metrics;
  return (
    <div style={{ minWidth: 170, background: "#12151E", border: `1.5px solid ${selected ? "#fff" : def.color}`,
      borderRadius: 8, fontSize: 12, color: "#c8cee0", boxShadow: "0 2px 8px rgba(0,0,0,.4)" }}>
      <div style={{ background: def.color, color: "#0A0C12", padding: "4px 8px", borderRadius: "6px 6px 0 0",
        fontWeight: 700, display: "flex", justifyContent: "space-between" }}>
        <span>{def.label}</span>
        <span title={status} style={{ width: 9, height: 9, borderRadius: 9, background: STATUS_COLOR[status], display: "inline-block", marginTop: 3 }} />
      </div>
      <div style={{ padding: "6px 8px" }}>
        <div style={{ opacity: .6, fontSize: 10 }}>{def.category}</div>
        {data.params?.model ? <div>model: <b>{data.params.model}</b></div> : null}
        {data.params?.which ? <div>{data.params.which}</div> : null}
        {data.params?.ticker ? <div>{data.params.ticker}</div> : null}
        {metric ? <div style={{ color: "#22c55e" }}>R² {metric.r2} · RMSE {metric.rmse}</div> : null}
        {res?.summary?.rows ? <div>{res.summary.rows}×{res.summary.cols}</div> : null}
        {res?.summary?.coverage != null ? <div style={{ color: "#22c55e" }}>cov {res.summary.coverage}%</div> : null}
        {res?.error ? <div style={{ color: "#ef4444" }}>{String(res.error).slice(0, 40)}</div> : null}
      </div>
      {def.inputs.map((p, i) => (
        <Handle key={"in" + p.name} type="target" position={Position.Left} id={p.name}
          style={{ top: 34 + i * 16, background: "#94a3b8", width: 9, height: 9 }} />
      ))}
      {def.outputs.map((p, i) => (
        <Handle key={"out" + p.name} type="source" position={Position.Right} id={p.name}
          style={{ top: 34 + i * 16, background: def.color, width: 9, height: 9 }} />
      ))}
    </div>
  );
}
const nodeTypes = { df: DFNode };

function Canvas() {
  const [defs, setDefs] = useState<Def[]>([]);
  const [zoo, setZoo] = useState<string[]>([]);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [sel, setSel] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [log, setLog] = useState<string>("Drag nodes from the left, wire output→input, then Run.");
  const idRef = useRef(1);
  const rf = useReactFlow();

  useEffect(() => { getNodes().then((d) => { setDefs(d.nodes); setZoo(d.zoo_models || []); }).catch(() => undefined); }, []);

  const addNode = useCallback((def: Def, x: number, y: number) => {
    const id = `n${idRef.current++}`;
    const params: Record<string, unknown> = {};
    def.params.forEach((p) => { params[p.name] = p.default; });
    setNodes((ns) => ns.concat({ id, type: "df", position: { x, y }, data: { type: def.type, def, params, label: def.label } }));
  }, [setNodes]);

  const onConnect = useCallback((c: Connection) => setEdges((es) => addEdge({ ...c, animated: true, style: { stroke: "#6366f1" } }, es)), [setEdges]);
  const onDrop = useCallback((e: DragEvent) => {
    e.preventDefault();
    const type = e.dataTransfer.getData("application/df");
    const def = defs.find((d) => d.type === type);
    if (!def) return;
    const pos = rf.screenToFlowPosition({ x: e.clientX, y: e.clientY });
    addNode(def, pos.x, pos.y);
  }, [defs, rf, addNode]);

  async function run() {
    setRunning(true); setLog("running flow…");
    const graph = {
      nodes: nodes.map((n) => ({ id: n.id, type: n.data.type, params: n.data.params })),
      edges: edges.map((e) => ({ source: e.source, target: e.target, sourceHandle: e.sourceHandle, targetHandle: e.targetHandle })),
    };
    try {
      const res = await runFlow(graph);
      if (res.error) { setLog("⚠ " + res.error); setRunning(false); return; }
      setNodes((ns) => ns.map((n) => ({ ...n, data: { ...n.data, result: res.nodes[n.id] } })));
      const lines = (res.order || []).map((id: string) => {
        const r = res.nodes[id]; const m = r.summary?.metrics;
        return `${id} [${r.status}] ${m ? `R²=${m.r2} RMSE=${m.rmse}` : (r.error || r.summary?.dataset || (r.summary?.rows ? r.summary.rows + " rows" : "ok"))}`;
      });
      setLog(lines.join("\n"));
    } catch (e) { setLog("⚠ " + String(e)); }
    setRunning(false);
  }

  function seed() {
    idRef.current = 1; setEdges([]);
    const mk = (type: string, x: number, y: number, extra: Record<string, unknown> = {}) => {
      const def = defs.find((d) => d.type === type)!; const id = `n${idRef.current++}`;
      const params: Record<string, unknown> = {}; def.params.forEach((p) => { params[p.name] = p.default; });
      return { id, type: "df", position: { x, y }, data: { type, def, params: { ...params, ...extra }, label: def.label } };
    };
    const ns = [
      mk("source.sample", 20, 160, { which: "diabetes" }),
      mk("transform.condition", 230, 160, { normalize: "zscore" }),
      mk("model.zoo", 450, 60, { model: "random_forest", target: "target" }),
      mk("model.zoo", 450, 180, { model: "gradient_boosting", target: "target" }),
      mk("model.zoo", 450, 300, { model: "ridge", target: "target" }),
      mk("ensemble.combine", 680, 180, { method: "weighted" }),
      mk("evaluate.metrics", 890, 180),
    ];
    setNodes(ns as Node[]);
    setTimeout(() => rf.fitView({ padding: 0.25 }), 350);
    setEdges([
      { id: "e1", source: ns[0].id, target: ns[1].id, sourceHandle: "data", targetHandle: "data", animated: true, style: { stroke: "#6366f1" } },
      ...[2, 3, 4].map((i) => ({ id: "e" + i, source: ns[1].id, target: ns[i].id, sourceHandle: "data", targetHandle: "data", animated: true, style: { stroke: "#6366f1" } })),
      ...[2, 3, 4].map((i) => ({ id: "em" + i, source: ns[i].id, target: ns[5].id, sourceHandle: "model", targetHandle: "models", animated: true, style: { stroke: "#a855f7" } })),
      { id: "ev", source: ns[5].id, target: ns[6].id, sourceHandle: "model", targetHandle: "model", animated: true, style: { stroke: "#a855f7" } },
    ] as Edge[]);
  }

  const selNode = nodes.find((n) => n.id === sel);
  const cats = Array.from(new Set(defs.map((d) => d.category)));

  return (
    <div style={{ display: "grid", gridTemplateColumns: "190px 1fr 250px", gridTemplateRows: "1fr 150px", height: "calc(100vh - 96px)", gap: 0 }}>
      {/* palette */}
      <div style={{ gridColumn: "1", gridRow: "1 / 3", borderRight: "1px solid #1E2330", overflowY: "auto", padding: 8, background: "#0d1018" }}>
        <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
          <button className="apply" style={{ flex: 1, padding: "6px" }} disabled={running} onClick={run}>{running ? "…" : "▶ Run"}</button>
          <button className="sg" onClick={seed}>Example</button>
        </div>
        {cats.map((c) => (
          <div key={c} style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 10, textTransform: "uppercase", opacity: .5, margin: "4px 0" }}>{c}</div>
            {defs.filter((d) => d.category === c).map((d) => (
              <div key={d.type} draggable onDragStart={(e) => e.dataTransfer.setData("application/df", d.type)}
                style={{ padding: "5px 8px", marginBottom: 4, borderRadius: 6, cursor: "grab",
                  background: "#12151E", borderLeft: `3px solid ${d.color}`, fontSize: 12 }}>{d.label}</div>
            ))}
          </div>
        ))}
      </div>
      {/* canvas */}
      <div onDragOver={(e) => e.preventDefault()} onDrop={onDrop} style={{ gridColumn: "2", gridRow: "1", position: "relative", minWidth: 0, minHeight: 0, height: "100%" }}>
        <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange} onConnect={onConnect} onNodeClick={(_, n) => setSel(n.id)}
          onPaneClick={() => setSel(null)} fitView minZoom={0.2}
          onInit={() => setTimeout(() => rf.fitView({ padding: 0.25 }), 200)} proOptions={{ hideAttribution: true }}>
          <Background color="#1E2330" gap={18} />
          <Controls /><MiniMap pannable style={{ background: "#0d1018" }} />
        </ReactFlow>
      </div>
      {/* inspector */}
      <div style={{ gridColumn: "3", gridRow: "1 / 3", borderLeft: "1px solid #1E2330", padding: 10, overflowY: "auto", background: "#0d1018" }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Inspector</div>
        {!selNode ? <div className="kv">Select a node to edit its parameters.</div> : (
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          <div>
            <div style={{ color: (selNode.data.def as Def).color, fontWeight: 700 }}>{(selNode.data.def as Def).label}</div>
            <div className="kv" style={{ fontSize: 10, marginBottom: 8 }}>{selNode.data.type as string}</div>
            {(selNode.data.def as Def).params.map((p) => {
              const val = (selNode.data.params as Record<string, unknown>)[p.name];
              const setVal = (v: unknown) => setNodes((ns) => ns.map((n) => n.id === selNode.id ? { ...n, data: { ...n.data, params: { ...(n.data.params as object), [p.name]: v } } } : n));
              return (
                <div key={p.name} style={{ marginBottom: 8 }}>
                  <div className="clab">{p.name}</div>
                  {p.type === "select" ? (
                    <select className="ctrl-in" value={String(val)} onChange={(e) => setVal(e.target.value)}>{p.options.map((o: string) => <option key={o} value={o}>{o}</option>)}</select>
                  ) : p.type === "model_select" ? (
                    <select className="ctrl-in" value={String(val)} onChange={(e) => setVal(e.target.value)}>{zoo.map((o) => <option key={o} value={o}>{o}</option>)}</select>
                  ) : p.type === "bool" ? (
                    <button className={`sg ${val ? "on" : ""}`} onClick={() => setVal(!val)}>{val ? "true" : "false"}</button>
                  ) : p.type === "number" ? (
                    <input className="ctrl-in" type="number" step="0.05" value={Number(val)} onChange={(e) => setVal(Number(e.target.value))} />
                  ) : (
                    <input className="ctrl-in" value={String(val ?? "")} onChange={(e) => setVal(e.target.value)} />
                  )}
                </div>);
            })}
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {(() => { const sm = (selNode.data as any).result?.summary; if (!sm) return null;
              if (sm.leaderboard) return (
                <div style={{ marginTop: 8 }}><div className="clab">Leaderboard (best: {sm.best_model})</div>
                  <table className="mini"><thead><tr><th>model</th><th>R²</th><th>RMSE</th></tr></thead>
                    <tbody>{sm.leaderboard.map((r: { model: string; r2: number; rmse: number }) => (
                      <tr key={r.model}><td>{r.model}</td><td className={r.r2 > 0 ? "good" : "bad"}>{r.r2}</td><td>{r.rmse}</td></tr>))}</tbody></table></div>);
              if (sm.importances) return (
                <div style={{ marginTop: 8 }}><div className="clab">Feature importance</div>
                  <table className="mini"><thead><tr><th>feature</th><th>importance</th></tr></thead>
                    <tbody>{sm.importances.map((r: { feature: string; importance: number }) => (
                      <tr key={r.feature}><td>{r.feature}</td><td>{r.importance}</td></tr>))}</tbody></table></div>);
              return <pre style={{ fontSize: 10, whiteSpace: "pre-wrap", color: "#94a3b8", marginTop: 8 }}>{JSON.stringify(sm, null, 1).slice(0, 600)}</pre>;
            })()}
          </div>
        )}
      </div>
      {/* console */}
      <div style={{ gridColumn: "2", gridRow: "2", borderTop: "1px solid #1E2330", padding: 10, overflowY: "auto", background: "#0A0C12", minWidth: 0 }}>
        <div style={{ fontSize: 10, textTransform: "uppercase", opacity: .5 }}>Console</div>
        <pre style={{ fontSize: 12, whiteSpace: "pre-wrap", color: "#c8cee0", margin: 0 }}>{log}</pre>
      </div>
    </div>
  );
}

export default function Platform() {
  return <ReactFlowProvider><Canvas /></ReactFlowProvider>;
}

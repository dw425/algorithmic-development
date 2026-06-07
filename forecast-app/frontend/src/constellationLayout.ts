// Ported from UltraETL (etl-dep-viz) layout.ts — SVG graph layouts: radial constellation,
// tier bands, pipeline DAG, edge positioning.
export interface GNode { node_id: string; name: string; kind: string; }
export interface GEdge { edge_id: string; source_node_id: string; target_node_id: string; }
export interface PNode extends GNode { x: number; y: number; color: string; }
export interface PEdge extends GEdge { x1: number; y1: number; x2: number; y2: number; }

export function layoutRadial(nodes: GNode[], attrs: Record<string, Record<string, string>>, cx: number, cy: number, radius: number): PNode[] {
  const out: PNode[] = []; const groups = new Map<string, GNode[]>();
  for (const n of nodes) { const g = attrs[n.node_id]?.community_id ?? "0"; if (!groups.has(g)) groups.set(g, []); groups.get(g)!.push(n); }
  const ids = Array.from(groups.keys()).sort(); const ng = Math.max(ids.length, 1);
  ids.forEach((gid, gi) => {
    const m = groups.get(gid)!; const a0 = (2 * Math.PI * gi) / ng;
    const rcx = cx + Math.cos(a0) * radius * 0.55, rcy = cy + Math.sin(a0) * radius * 0.55;
    const sub = Math.min(radius * 0.28, 34 + m.length * 5);
    m.forEach((n, i) => { const a = (2 * Math.PI * i) / Math.max(m.length, 1);
      out.push({ ...n, x: rcx + Math.cos(a) * sub, y: rcy + Math.sin(a) * sub, color: attrs[n.node_id]?.color ?? "#6366f1" }); });
  });
  return out;
}
export function layoutTier(nodes: GNode[], attrs: Record<string, Record<string, string>>, w: number, h: number): PNode[] {
  const byKind = new Map<string, GNode[]>();
  for (const n of nodes) { if (!byKind.has(n.kind)) byKind.set(n.kind, []); byKind.get(n.kind)!.push(n); }
  const used = Array.from(byKind.keys()); const bandH = h / Math.max(used.length, 1); const out: PNode[] = [];
  used.forEach((k, i) => { const m = byKind.get(k)!; const y = bandH * (i + 0.5);
    m.forEach((n, j) => out.push({ ...n, x: (w * (j + 1)) / (m.length + 1), y, color: attrs[n.node_id]?.color ?? "#0ea5e9" })); });
  return out;
}
export function layoutDag(nodes: GNode[], edges: GEdge[], attrs: Record<string, Record<string, string>>, w: number, h: number): PNode[] {
  const gen = new Map<string, number>(); const inc = new Map<string, Set<string>>(); const outg = new Map<string, Set<string>>();
  for (const n of nodes) { inc.set(n.node_id, new Set()); outg.set(n.node_id, new Set()); }
  for (const e of edges) { if (!inc.has(e.source_node_id) || !inc.has(e.target_node_id)) continue; inc.get(e.target_node_id)!.add(e.source_node_id); outg.get(e.source_node_id)!.add(e.target_node_id); }
  const q: string[] = []; for (const [id, s] of inc) if (s.size === 0) q.push(id); for (const id of q) gen.set(id, 0);
  while (q.length) { const id = q.shift()!; const g = gen.get(id)!; for (const t of outg.get(id) ?? []) { const s = inc.get(t)!; s.delete(id); gen.set(t, Math.max(gen.get(t) ?? 0, g + 1)); if (s.size === 0) q.push(t); } }
  const mg = Math.max(0, ...Array.from(gen.values())); for (const n of nodes) if (!gen.has(n.node_id)) gen.set(n.node_id, mg + 1);
  const cols = new Map<number, GNode[]>(); for (const n of nodes) { const g = gen.get(n.node_id)!; if (!cols.has(g)) cols.set(g, []); cols.get(g)!.push(n); }
  const sg = Array.from(cols.keys()).sort((a, b) => a - b); const cw = w / Math.max(sg.length, 1); const out: PNode[] = [];
  sg.forEach((g, i) => { const m = cols.get(g)!; m.forEach((n, j) => out.push({ ...n, x: cw * (i + 0.5), y: (h * (j + 1)) / (m.length + 1), color: attrs[n.node_id]?.color ?? "#22c55e" })); });
  return out;
}
export function posEdges(nodes: PNode[], edges: GEdge[]): PEdge[] {
  const by = new Map(nodes.map((n) => [n.node_id, n])); const out: PEdge[] = [];
  for (const e of edges) { const a = by.get(e.source_node_id), b = by.get(e.target_node_id); if (a && b) out.push({ ...e, x1: a.x, y1: a.y, x2: b.x, y2: b.y }); }
  return out;
}

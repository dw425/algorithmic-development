// MUSE InsightHub — constellation. Scales: loads all nodes when they fit, else a viewport/overview
// sample from the server. Hulls, LOD supernodes, bundled cluster edges, 12-color palette, 6 algorithms.
import { useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";
import { api, TIER_COLOR, MODEL_COLOR, CHUNK_PALETTE, heat, type Node, type Tier, type AlgoInfo, type ClusterChunk } from "./api";

type Layout = "umap" | "pca" | "category" | "tier" | "cluster";
type SizeBy = "uniform" | "quality" | "length";
const TIERS: Tier[] = ["small", "medium", "large"];
const LOD_FAR = 0.8, HULL_ALPHA = 0.09, DOT_R = 2.4, MAX_NODES = 26000;
const ZL = [1, 1.8, 3.2, 5.6, 9.6];   // 5 discrete zoom levels (drill-in, not infinite canvas)

function hexA(hex: string, a: number) {
  const h = hex.replace("#", ""); return `rgba(${parseInt(h.slice(0, 2), 16)},${parseInt(h.slice(2, 4), 16)},${parseInt(h.slice(4, 6), 16)},${a})`;
}

export default function Constellation({ onSelect }: { onSelect: (promptI: number) => void }) {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [meta, setMeta] = useState<{ total: number; returned: number; sampled: boolean }>({ total: 0, returned: 0, sampled: false });
  const [cats, setCats] = useState<string[]>([]);
  const [algos, setAlgos] = useState<AlgoInfo[]>([]);
  const [layout, setLayout] = useState<Layout>("cluster");
  const [colorBy, setColorBy] = useState<string>("louvain");
  const [sizeBy, setSizeBy] = useState<SizeBy>("uniform");
  const [hulls, setHulls] = useState(true);
  const [edgesOn, setEdgesOn] = useState(true);
  const [tiers, setTiers] = useState<Set<Tier>>(new Set(TIERS));
  const [cat, setCat] = useState<string>("all");
  const [chunks, setChunks] = useState<Map<number, ClusterChunk> | null>(null);
  const [cedges, setCedges] = useState<{ a: number; b: number; weight: number }[]>([]);
  const [hover, setHover] = useState<{ n: Node; sx: number; sy: number } | null>(null);
  const host = useRef<HTMLDivElement>(null);
  const cv = useRef<HTMLCanvasElement>(null);
  const tf = useRef(d3.zoomIdentity);
  const sizeRef = useRef({ w: 800, h: 600 });
  const fetchTimer = useRef<number | undefined>(undefined);
  const zoomRef = useRef<d3.ZoomBehavior<HTMLCanvasElement, unknown> | null>(null);
  const drawRef = useRef<() => void>(() => {});
  const level = useRef(0);

  const zoomToLevel = (lv: number, cx: number, cy: number) => {
    const c = cv.current; if (!c || !zoomRef.current) return;
    level.current = Math.max(0, Math.min(ZL.length - 1, lv));
    const k = ZL[level.current], [px, py] = tf.current.invert([cx, cy]);
    const t = d3.zoomIdentity.translate(cx - k * px, cy - k * py).scale(k);
    d3.select(c).transition().duration(300).call(zoomRef.current.transform, t);
  };
  const flyTo = (n: Node) => {
    const p = pos.get(n.id), c = cv.current; if (!p || !c) return;
    const { w, h } = sizeRef.current;
    zoomToLevel(level.current + 1, tf.current.applyX(p[0] * w), tf.current.applyY(p[1] * h));
  };
  const setZoom = (lv: number) => { const { w, h } = sizeRef.current; zoomToLevel(lv, w / 2, h / 2); };

  const proj = layout === "pca" ? "pca" : "umap";
  const isAlgo = useMemo(() => algos.some(a => a.id === colorBy && a.computed), [algos, colorBy]);

  useEffect(() => { api.algorithms().then(a => setAlgos(a.algorithms)); }, []);

  // fetch nodes for current projection / cluster algorithm / (optional) viewport bbox
  const fetchNodes = (bbox?: string) => {
    api.constellation(proj, { max: MAX_NODES, bbox, cluster_algo: isAlgo ? colorBy : undefined }).then(d => {
      setNodes(d.nodes); setMeta({ total: d.total, returned: d.returned, sampled: d.sampled });
      setCats(d.categories);
    });
  };
  useEffect(() => { fetchNodes(); }, [proj, colorBy, isAlgo]);   // eslint-disable-line

  // cluster colors + edges
  useEffect(() => {
    if (!isAlgo) { setChunks(null); setCedges([]); return; }
    api.clusters(colorBy).then(d => setChunks(new Map(d.chunks.map(c => [c.cluster_id, c]))));
    api.clusterEdges(colorBy).then(e => setCedges(e.edges)).catch(() => setCedges([]));
  }, [colorBy, isAlgo]);

  // layout position in [0,1] from the node's projection coords
  const pos = useMemo(() => {
    const m = new Map<number, [number, number]>();
    if (layout === "category") {
      const cols = 5, gw = 1 / cols, gh = 1 / Math.ceil((cats.length || 15) / cols), ci = new Map(cats.map((c, i) => [c, i]));
      nodes.forEach(n => { const i = ci.get(n.category) || 0, cx = (i % cols) * gw, cy = Math.floor(i / cols) * gh;
        m.set(n.id, [cx + 0.06 + n.x * (gw - 0.12), cy + 0.08 + n.y * (gh - 0.16)]); });
    } else if (layout === "tier") {
      const bi: Record<Tier, number> = { small: 0, medium: 1, large: 2 };
      nodes.forEach(n => m.set(n.id, [0.04 + n.x * 0.92, 0.12 + bi[n.tier] * 0.3 + n.y * 0.18]));
    } else if (layout === "cluster") {
      // arrange each group/cluster as its own spatial blob in a ring → switching algorithm reorganizes the map
      const keyOf = (n: Node): string | null =>
        colorBy === "tier" ? n.tier : colorBy === "model" ? n.model : colorBy === "category" ? n.category
          : (isAlgo && n.cluster != null && n.cluster !== -1) ? `c${n.cluster}` : null;
      const keys = [...new Set(nodes.map(keyOf).filter((k): k is string => !!k))];
      const ang = new Map(keys.map((k, i) => [k, (2 * Math.PI * i) / Math.max(1, keys.length)]));
      const R = keys.length > 1 ? 0.37 : 0;
      nodes.forEach(n => {
        const k = keyOf(n);
        if (!k || !ang.has(k)) { m.set(n.id, [0.5 + (n.x - 0.5) * 0.1, 0.5 + (n.y - 0.5) * 0.1]); return; }
        const a = ang.get(k)!, cx = 0.5 + R * Math.cos(a), cy = 0.5 + R * Math.sin(a);
        m.set(n.id, [cx + (n.x - 0.5) * 0.17, cy + (n.y - 0.5) * 0.17]);
      });
    } else nodes.forEach(n => m.set(n.id, [n.x, n.y]));
    return m;
  }, [nodes, layout, cats, colorBy, isAlgo]);

  const visible = useMemo(() => nodes.filter(n => tiers.has(n.tier) && (cat === "all" || n.category === cat)), [nodes, tiers, cat]);

  const groupKey = (n: Node): string | null => {
    if (colorBy === "tier") return n.tier;
    if (colorBy === "model") return n.model;
    if (colorBy === "category") return n.category;
    if (colorBy === "quality") return null;
    if (isAlgo && n.cluster != null) return n.cluster === -1 ? "noise" : `c${n.cluster}`;
    return null;
  };
  const groupColor = (key: string): string => {
    if (colorBy === "tier") return TIER_COLOR[key as Tier];
    if (colorBy === "model") return MODEL_COLOR[key] || "#888";
    if (colorBy === "category") return CHUNK_PALETTE[cats.indexOf(key) % CHUNK_PALETTE.length];
    if (key === "noise") return "#5a6a7a";
    return chunks?.get(+key.slice(1))?.color || "#888";
  };
  const colorOf = (n: Node): string => {
    if (colorBy === "quality") return n.quality == null ? "#3a4366" : heat(1 - (n.quality - 1) / 4);
    const k = groupKey(n); return k ? groupColor(k) : "#3B82F6";
  };
  const sizeOf = (n: Node): number => sizeBy === "length" ? 1.2 + Math.min(4, n.length / 1500)
    : sizeBy === "quality" ? (n.quality == null ? 1.4 : 1 + (n.quality / 5) * 3.4) : DOT_R;

  const groups = useMemo(() => {
    if (colorBy === "quality") return [];
    const g = new Map<string, [number, number][]>();
    for (const n of visible) { const k = groupKey(n); if (!k || k === "noise") continue; const p = pos.get(n.id); if (!p) continue;
      (g.get(k) || g.set(k, []).get(k)!).push(p); }
    return [...g.entries()].map(([k, pts]) => ({ key: k, color: groupColor(k), size: pts.length,
      cx: d3.mean(pts, d => d[0])!, cy: d3.mean(pts, d => d[1])!, hull: pts.length >= 3 ? d3.polygonHull(pts) : null }))
      .sort((a, b) => b.size - a.size);
  }, [visible, pos, colorBy, chunks, cats]);

  const quad = useMemo(() => {
    const { w, h } = sizeRef.current;
    return d3.quadtree<Node>().x(n => (pos.get(n.id)?.[0] || 0) * w).y(n => (pos.get(n.id)?.[1] || 0) * h).addAll(visible);
  }, [visible, pos]);

  const draw = () => {
    const c = cv.current; if (!c) return;
    const rect = c.getBoundingClientRect(); const w = Math.round(rect.width), h = Math.round(rect.height);
    if (w < 2 || h < 2) return;
    sizeRef.current = { w, h };
    const dpr = window.devicePixelRatio || 1;
    c.width = w * dpr; c.height = h * dpr; const ctx = c.getContext("2d")!; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const t = tf.current, k = t.k;
    const SX = (x: number) => t.applyX(x * w), SY = (y: number) => t.applyY(y * h);
    if (hulls && groups.length) for (const g of groups) {
      if (!g.hull) continue;
      ctx.beginPath(); g.hull.forEach((pt, i) => { const x = SX(pt[0]), y = SY(pt[1]); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.closePath();
      ctx.fillStyle = hexA(g.color, k < LOD_FAR ? 0.05 : HULL_ALPHA); ctx.fill();
      if (k >= LOD_FAR) { ctx.strokeStyle = hexA(g.color, 0.35); ctx.lineWidth = 1; ctx.stroke(); }
    }
    if (isAlgo && edgesOn && cedges.length) {
      const byId = new Map(groups.map(g => [g.key, g])); ctx.lineCap = "round";
      for (const e of cedges) { const ga = byId.get("c" + e.a), gb = byId.get("c" + e.b); if (!ga || !gb) continue;
        const x0 = SX(ga.cx), y0 = SY(ga.cy), x1 = SX(gb.cx), y1 = SY(gb.cy), mx = (x0 + x1) / 2, my = (y0 + y1) / 2, dx = x1 - x0, dy = y1 - y0;
        ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo(mx - dy * 0.12, my + dx * 0.12, x1, y1);
        ctx.strokeStyle = `rgba(148,163,184,${0.06 + e.weight * 0.2})`; ctx.lineWidth = Math.min(e.weight * 3, 2.6); ctx.stroke(); }
    }
    if (k < LOD_FAR && groups.length) for (const g of groups) {
      const cx = SX(g.cx), cy = SY(g.cy), r = Math.max(7, Math.sqrt(g.size) * 1.7);
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, 6.283); ctx.fillStyle = hexA(g.color, 0.32); ctx.fill();
      ctx.strokeStyle = hexA(g.color, 0.65); ctx.lineWidth = 1.4; ctx.stroke();
      ctx.fillStyle = hexA(g.color, 0.92); ctx.font = "10px ui-monospace,monospace"; ctx.textAlign = "center"; ctx.fillText(String(g.size), cx, cy + 3);
    } else {
      ctx.globalAlpha = 0.82;
      for (const n of visible) { const p = pos.get(n.id); if (!p) continue; const sx = SX(p[0]), sy = SY(p[1]);
        if (sx < -10 || sx > w + 10 || sy < -10 || sy > h + 10) continue;
        ctx.fillStyle = colorOf(n); ctx.beginPath(); ctx.arc(sx, sy, sizeOf(n) * Math.min(2.2, Math.sqrt(k)), 0, 6.283); ctx.fill(); }
      ctx.globalAlpha = 1;
      if (groups.length && groups.length <= 40) { ctx.font = "11px ui-monospace,monospace"; ctx.textAlign = "center";
        for (const g of groups.slice(0, 24)) { const cx = SX(g.cx), cy = SY(g.cy), label = colorBy === "category" ? g.key : g.key.replace("c", "C");
          ctx.fillStyle = "rgba(10,14,26,0.7)"; const tw = ctx.measureText(label).width + 10; ctx.fillRect(cx - tw / 2, cy - 9, tw, 16);
          ctx.fillStyle = g.color; ctx.fillText(label, cx, cy + 3); } }
    }
    if (hover) { const p = pos.get(hover.n.id)!; ctx.strokeStyle = "#fff"; ctx.lineWidth = 1.5; ctx.beginPath();
      ctx.arc(SX(p[0]), SY(p[1]), sizeOf(hover.n) * Math.min(2.2, Math.sqrt(k)) + 3, 0, 6.283); ctx.stroke(); }
  };
  drawRef.current = draw;

  // redraw only when data / view / hover actually change (not on every render → no flicker)
  useEffect(() => { drawRef.current(); },
    [nodes, pos, groups, hover, colorBy, chunks, cedges, hulls, edgesOn, sizeBy, layout, tiers, cat]);

  useEffect(() => {
    const c = cv.current, hh = host.current; if (!c || !hh) return;
    const ro = new ResizeObserver(() => drawRef.current());
    ro.observe(hh);
    const zoom = d3.zoom<HTMLCanvasElement, unknown>().scaleExtent([ZL[0], ZL[ZL.length - 1]])
      .filter(e => e.type !== "wheel")                 // drag = pan; wheel = discrete steps (handled below)
      .on("zoom", e => {
        tf.current = e.transform; drawRef.current();
        if (meta.sampled) {
          clearTimeout(fetchTimer.current);
          fetchTimer.current = window.setTimeout(() => {
            const t = tf.current, { w, h } = sizeRef.current;
            fetchNodes(`${(t.invertX(0) / w).toFixed(4)},${(t.invertY(0) / h).toFixed(4)},${(t.invertX(w) / w).toFixed(4)},${(t.invertY(h) / h).toFixed(4)}`);
          }, 280);
        }
      });
    zoomRef.current = zoom;
    d3.select(c).call(zoom).on("dblclick.zoom", null);
    const onWheel = (e: WheelEvent) => { e.preventDefault(); const r = c.getBoundingClientRect();
      zoomToLevel(level.current + (e.deltaY < 0 ? 1 : -1), e.clientX - r.left, e.clientY - r.top); };
    c.addEventListener("wheel", onWheel, { passive: false });
    return () => { ro.disconnect(); c.removeEventListener("wheel", onWheel); };
  }, [meta.sampled]);   // eslint-disable-line

  useEffect(() => { setZoom(0); }, [layout, proj, colorBy]);   // reset to full view on layout/algorithm change // eslint-disable-line

  const onMove = (e: React.MouseEvent) => {
    const r = cv.current!.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top, t = tf.current, { w, h } = sizeRef.current;
    const found = quad.find(t.invertX(mx), t.invertY(my), 14);
    if (found) { const p = pos.get(found.id)!; setHover({ n: found, sx: t.applyX(p[0] * w), sy: t.applyY(p[1] * h) }); } else setHover(null);
  };

  const Seg = (val: string, set: (v: string) => void, opts: [string, string][]) => (
    <div className="ih-seg">{opts.map(([v, l]) => <button key={v} className={val === v ? "on" : ""} onClick={() => set(v)}>{l}</button>)}</div>);

  return (
    <div className="ih-const-wrap">
      <div className="ih-canvas-host" ref={host}>
        <canvas ref={cv} onMouseMove={onMove} onMouseLeave={() => setHover(null)}
          onClick={() => hover && flyTo(hover.n)} onDoubleClick={() => hover && onSelect(hover.n.prompt_i)}
          style={{ cursor: hover ? "zoom-in" : "grab" }} />
        {hover && <div className="ih-tip" style={{ left: Math.min(hover.sx + 14, sizeRef.current.w - 250), top: hover.sy + 12 }}>
          <div style={{ fontWeight: 700, color: colorOf(hover.n) }}>{hover.n.model}</div>
          <div className="ih-muted" style={{ fontSize: 11, margin: "3px 0" }}>{hover.n.tier} · {hover.n.category}{isAlgo && hover.n.cluster != null ? ` · ${chunks?.get(hover.n.cluster)?.label ?? "noise"}` : ""}</div>
          <div style={{ fontSize: 11 }}>len {hover.n.length} · quality {hover.n.quality ?? "—"}</div>
          <div style={{ fontSize: 11, marginTop: 4, color: "#60a5fa" }}>click = zoom · dbl-click = open #{hover.n.prompt_i}</div>
        </div>}
        <div style={{ position: "absolute", right: 12, top: 12, display: "flex", flexDirection: "column", gap: 5 }}>
          {[["+", () => setZoom(level.current + 1)], ["−", () => setZoom(level.current - 1)], ["⊡", () => setZoom(0)]].map(([t, fn], k) =>
            <button key={k} onClick={fn as () => void} style={{ width: 28, height: 28, borderRadius: 5, border: "1px solid var(--line2)", background: "#1a2332cc", color: "var(--ink)", cursor: "pointer", fontSize: 14, fontFamily: "inherit" }}>{t as string}</button>)}
        </div>
        <div style={{ position: "absolute", left: 12, bottom: 10, fontSize: 11, color: "var(--dim)" }}>
          {meta.returned.toLocaleString()}{meta.sampled ? ` of ${meta.total.toLocaleString()} (sampled)` : " answers"} · {groups.length ? `${groups.length} clusters` : "gradient"} · scroll = drill 5 levels · drag = pan · click = zoom in · dbl-click = open</div>
      </div>
      <div className="ih-encode">
        <h3>Layout</h3>{Seg(layout, v => setLayout(v as Layout), [["cluster", "Clusters"], ["umap", "UMAP"], ["pca", "PCA"], ["category", "By cat"], ["tier", "Tiers"]])}
        <h3>Color / cluster by</h3>
        <div className="ih-seg">{["tier", "model", "category", "quality"].map(v => <button key={v} className={colorBy === v ? "on" : ""} onClick={() => { setColorBy(v); if (v !== "quality") setLayout("cluster"); }}>{v}</button>)}</div>
        <div style={{ fontSize: 11, color: "var(--dim)", margin: "8px 0 5px" }}>clustering algorithms (re-layouts the map)</div>
        <div className="ih-seg">{algos.filter(a => a.computed).map(a => <button key={a.id} className={colorBy === a.id ? "on" : ""} onClick={() => { setColorBy(a.id); setLayout("cluster"); }} title={a.name}>{a.id}</button>)}</div>
        {isAlgo && chunks && <div className="ih-muted" style={{ fontSize: 11, marginTop: 7 }}>
          {algos.find(a => a.id === colorBy)?.name} · {chunks.size} clusters · avg cohesion {([...chunks.values()].reduce((s, x) => s + x.cohesion, 0) / Math.max(1, chunks.size)).toFixed(2)}</div>}
        <h3>Size by</h3>{Seg(sizeBy, v => setSizeBy(v as SizeBy), [["uniform", "Uniform"], ["quality", "Quality"], ["length", "Length"]])}
        <h3>Hulls</h3>
        <div className="ih-seg"><button className={hulls ? "on" : ""} onClick={() => setHulls(true)}>on</button><button className={!hulls ? "on" : ""} onClick={() => setHulls(false)}>off</button></div>
        {isAlgo && cedges.length > 0 && <><h3>Cluster edges</h3>
          <div className="ih-seg"><button className={edgesOn ? "on" : ""} onClick={() => setEdgesOn(true)}>on</button><button className={!edgesOn ? "on" : ""} onClick={() => setEdgesOn(false)}>off</button></div></>}
        <h3>Tiers</h3>
        <div className="ih-seg">{TIERS.map(t => <button key={t} className={tiers.has(t) ? "on" : ""}
          onClick={() => { const s = new Set(tiers); s.has(t) ? s.delete(t) : s.add(t); setTiers(s); }}>{t}</button>)}</div>
        <h3>Category filter</h3>
        <select className="ih-input" value={cat} onChange={e => setCat(e.target.value)}>
          <option value="all">all categories</option>{cats.map(c => <option key={c} value={c}>{c}</option>)}</select>
      </div>
    </div>
  );
}

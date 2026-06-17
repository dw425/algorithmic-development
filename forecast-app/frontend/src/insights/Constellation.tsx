// MUSE InsightHub — constellation with full etlviz rendering: convex hulls, LOD supernodes,
// the 12-color palette, and live clustering (Louvain/gravity/spectral/HDBSCAN/k-means/Ward).
import { useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";
import { api, TIER_COLOR, MODEL_COLOR, CHUNK_PALETTE, heat, type Node, type Tier, type AlgoInfo, type ClusterChunk } from "./api";

type Layout = "umap" | "pca" | "category" | "tier";
type SizeBy = "uniform" | "quality" | "length";
const TIERS: Tier[] = ["small", "medium", "large"];
const LOD_FAR = 0.8, HULL_ALPHA = 0.09, DOT_R = 2.4;
interface XNode extends Node { ux: number; uy: number; px: number; py: number; }

function hexA(hex: string, a: number) {
  const h = hex.replace("#", ""); const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

export default function Constellation({ onSelect }: { onSelect: (promptI: number) => void }) {
  const [raw, setRaw] = useState<XNode[]>([]);
  const [cats, setCats] = useState<string[]>([]);
  const [algos, setAlgos] = useState<AlgoInfo[]>([]);
  const [layout, setLayout] = useState<Layout>("umap");
  const [colorBy, setColorBy] = useState<string>("category");   // tier|model|category|quality|<algo>
  const [sizeBy, setSizeBy] = useState<SizeBy>("uniform");
  const [hulls, setHulls] = useState(true);
  const [tiers, setTiers] = useState<Set<Tier>>(new Set(TIERS));
  const [cat, setCat] = useState<string>("all");
  const [cluster, setCluster] = useState<{ algo: string; assign: number[]; chunks: Map<number, ClusterChunk> } | null>(null);
  const [hover, setHover] = useState<{ n: XNode; sx: number; sy: number } | null>(null);
  const host = useRef<HTMLDivElement>(null);
  const cv = useRef<HTMLCanvasElement>(null);
  const tf = useRef(d3.zoomIdentity);
  const sizeRef = useRef({ w: 800, h: 600 });

  useEffect(() => {
    Promise.all([api.constellation("umap"), api.constellation("pca"), api.algorithms()]).then(([u, p, a]) => {
      const pm = new Map(p.nodes.map(n => [n.id, n]));
      setRaw(u.nodes.map(n => ({ ...n, ux: n.x, uy: n.y, px: pm.get(n.id)!.x, py: pm.get(n.id)!.y })));
      setCats(u.categories); setAlgos(a.algorithms);
    });
  }, []);

  // fetch cluster assignment when colorBy is a computed algorithm
  const isAlgo = useMemo(() => algos.some(a => a.id === colorBy && a.computed), [algos, colorBy]);
  useEffect(() => {
    if (!isAlgo) { setCluster(null); return; }
    api.clusters(colorBy).then(d => setCluster({ algo: colorBy, assign: d.assignments, chunks: new Map(d.chunks.map(c => [c.cluster_id, c])) }));
  }, [colorBy, isAlgo]);

  const pos = useMemo(() => {
    const m = new Map<number, [number, number]>();
    if (layout === "umap") raw.forEach(n => m.set(n.id, [n.ux, n.uy]));
    else if (layout === "pca") raw.forEach(n => m.set(n.id, [n.px, n.py]));
    else if (layout === "category") {
      const cols = 5, gw = 1 / cols, gh = 1 / Math.ceil(cats.length / cols), ci = new Map(cats.map((c, i) => [c, i]));
      raw.forEach(n => { const i = ci.get(n.category) || 0, cx = (i % cols) * gw, cy = Math.floor(i / cols) * gh;
        m.set(n.id, [cx + 0.06 + n.ux * (gw - 0.12), cy + 0.08 + n.uy * (gh - 0.16)]); });
    } else { const bi: Record<Tier, number> = { small: 0, medium: 1, large: 2 };
      raw.forEach(n => m.set(n.id, [0.04 + n.ux * 0.92, 0.12 + bi[n.tier] * 0.3 + n.uy * 0.18])); }
    return m;
  }, [raw, layout, cats]);

  const visible = useMemo(() => raw.filter(n => tiers.has(n.tier) && (cat === "all" || n.category === cat)), [raw, tiers, cat]);

  // grouping (for color + hulls). quality => no groups (gradient).
  const groupKey = (n: XNode): string | null => {
    if (colorBy === "tier") return n.tier;
    if (colorBy === "model") return n.model;
    if (colorBy === "category") return n.category;
    if (colorBy === "quality") return null;
    if (cluster) { const cid = cluster.assign[n.id]; return cid === -1 ? "noise" : `c${cid}`; }
    return null;
  };
  const groupColor = (key: string): string => {
    if (colorBy === "tier") return TIER_COLOR[key as Tier];
    if (colorBy === "model") return MODEL_COLOR[key] || "#888";
    if (colorBy === "category") return CHUNK_PALETTE[cats.indexOf(key) % CHUNK_PALETTE.length];
    if (cluster) { if (key === "noise") return "#5a6a7a"; const cid = +key.slice(1); return cluster.chunks.get(cid)?.color || "#888"; }
    return "#3B82F6";
  };
  const colorOf = (n: XNode): string => {
    if (colorBy === "quality") return n.quality == null ? "#3a4366" : heat(1 - (n.quality - 1) / 4);
    const k = groupKey(n); return k ? groupColor(k) : "#3B82F6";
  };
  const sizeOf = (n: XNode): number => sizeBy === "length" ? 1.2 + Math.min(4, n.length / 1500)
    : sizeBy === "quality" ? (n.quality == null ? 1.4 : 1 + (n.quality / 5) * 3.4) : DOT_R;

  // hulls + centroids per group (in [0,1] space)
  const groups = useMemo(() => {
    if (colorBy === "quality") return [];
    const g = new Map<string, [number, number][]>();
    for (const n of visible) { const k = groupKey(n); if (!k || k === "noise") continue; const p = pos.get(n.id); if (!p) continue;
      (g.get(k) || g.set(k, []).get(k)!).push(p); }
    return [...g.entries()].map(([k, pts]) => {
      const cx = d3.mean(pts, d => d[0])!, cy = d3.mean(pts, d => d[1])!;
      const hull = pts.length >= 3 ? d3.polygonHull(pts) : null;
      return { key: k, color: groupColor(k), size: pts.length, cx, cy, hull };
    }).sort((a, b) => b.size - a.size);
  }, [visible, pos, colorBy, cluster, cats]);

  const quad = useMemo(() => {
    const { w, h } = sizeRef.current;
    return d3.quadtree<XNode>().x(n => (pos.get(n.id)?.[0] || 0) * w).y(n => (pos.get(n.id)?.[1] || 0) * h).addAll(visible);
  }, [visible, pos]);

  const draw = () => {
    const c = cv.current; if (!c) return;
    const { w, h } = sizeRef.current, dpr = window.devicePixelRatio || 1;
    c.width = w * dpr; c.height = h * dpr; const ctx = c.getContext("2d")!; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const t = tf.current, k = t.k;
    const SX = (x: number) => t.applyX(x * w), SY = (y: number) => t.applyY(y * h);

    // hulls
    if (hulls && groups.length) {
      for (const g of groups) {
        if (!g.hull) continue;
        ctx.beginPath();
        g.hull.forEach((pt, i) => { const x = SX(pt[0]), y = SY(pt[1]); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
        ctx.closePath();
        ctx.fillStyle = hexA(g.color, k < LOD_FAR ? 0.05 : HULL_ALPHA); ctx.fill();
        if (k >= LOD_FAR) { ctx.strokeStyle = hexA(g.color, 0.35); ctx.lineWidth = 1; ctx.stroke(); }
      }
    }

    if (k < LOD_FAR && groups.length) {
      // FAR: supernode bubbles at centroids
      for (const g of groups) {
        const cx = SX(g.cx), cy = SY(g.cy), r = Math.max(7, Math.sqrt(g.size) * 1.7);
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, 6.283); ctx.fillStyle = hexA(g.color, 0.32); ctx.fill();
        ctx.strokeStyle = hexA(g.color, 0.65); ctx.lineWidth = 1.4; ctx.stroke();
        ctx.fillStyle = hexA(g.color, 0.92); ctx.font = "10px ui-monospace,monospace"; ctx.textAlign = "center";
        ctx.fillText(String(g.size), cx, cy + 3);
      }
    } else {
      // MID/CLOSE: dots
      ctx.globalAlpha = 0.82;
      for (const n of visible) {
        const p = pos.get(n.id); if (!p) continue;
        const sx = SX(p[0]), sy = SY(p[1]);
        if (sx < -10 || sx > w + 10 || sy < -10 || sy > h + 10) continue;
        ctx.fillStyle = colorOf(n); ctx.beginPath();
        ctx.arc(sx, sy, sizeOf(n) * Math.min(2.2, Math.sqrt(k)), 0, 6.283); ctx.fill();
      }
      ctx.globalAlpha = 1;
      // group pills at centroids
      if (groups.length && groups.length <= 40) {
        ctx.font = "11px ui-monospace,monospace"; ctx.textAlign = "center";
        for (const g of groups.slice(0, 24)) {
          const cx = SX(g.cx), cy = SY(g.cy); const label = colorBy === "category" ? g.key : g.key.replace("c", "C");
          ctx.fillStyle = "rgba(10,14,26,0.7)"; const tw = ctx.measureText(label).width + 10;
          ctx.fillRect(cx - tw / 2, cy - 9, tw, 16);
          ctx.fillStyle = g.color; ctx.fillText(label, cx, cy + 3);
        }
      }
    }
    if (hover) {
      const p = pos.get(hover.n.id)!; const sx = SX(p[0]), sy = SY(p[1]);
      ctx.strokeStyle = "#fff"; ctx.lineWidth = 1.5; ctx.beginPath();
      ctx.arc(sx, sy, sizeOf(hover.n) * Math.min(2.2, Math.sqrt(k)) + 3, 0, 6.283); ctx.stroke();
    }
  };

  useEffect(() => { draw(); });

  useEffect(() => {
    const c = cv.current, hh = host.current; if (!c || !hh) return;
    const ro = new ResizeObserver(() => { sizeRef.current = { w: hh.clientWidth, h: hh.clientHeight }; draw(); });
    ro.observe(hh); sizeRef.current = { w: hh.clientWidth, h: hh.clientHeight };
    const zoom = d3.zoom<HTMLCanvasElement, unknown>().scaleExtent([0.5, 40]).on("zoom", e => { tf.current = e.transform; setHover(null); draw(); });
    d3.select(c).call(zoom);
    return () => ro.disconnect();
  }, []);

  const onMove = (e: React.MouseEvent) => {
    const r = cv.current!.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top;
    const { w, h } = sizeRef.current, t = tf.current;
    const found = quad.find(t.invertX(mx), t.invertY(my), 14);
    if (found) { const p = pos.get(found.id)!; setHover({ n: found, sx: t.applyX(p[0] * w), sy: t.applyY(p[1] * h) }); }
    else setHover(null);
  };

  const Seg = (val: string, set: (v: string) => void, opts: [string, string][]) => (
    <div className="ih-seg">{opts.map(([v, l]) => <button key={v} className={val === v ? "on" : ""} onClick={() => set(v)}>{l}</button>)}</div>
  );
  const labelGroups = colorBy === "tier" || colorBy === "model" || colorBy === "category";

  return (
    <div className="ih-const-wrap">
      <div className="ih-canvas-host" ref={host}>
        <canvas ref={cv} onMouseMove={onMove} onMouseLeave={() => setHover(null)}
          onClick={() => hover && onSelect(hover.n.prompt_i)} style={{ cursor: hover ? "pointer" : "grab" }} />
        {hover && <div className="ih-tip" style={{ left: Math.min(hover.sx + 14, sizeRef.current.w - 250), top: hover.sy + 12 }}>
          <div style={{ fontWeight: 700, color: colorOf(hover.n) }}>{hover.n.model}</div>
          <div className="ih-muted" style={{ fontSize: 11, margin: "3px 0" }}>{hover.n.tier} · {hover.n.category}{cluster ? ` · ${cluster.chunks.get(cluster.assign[hover.n.id])?.label ?? "noise"}` : ""}</div>
          <div style={{ fontSize: 11 }}>len {hover.n.length} · quality {hover.n.quality ?? "—"}</div>
          <div style={{ fontSize: 11, marginTop: 4, color: "#7dd3fc" }}>click → prompt #{hover.n.prompt_i}</div>
        </div>}
        <div style={{ position: "absolute", left: 12, bottom: 10, fontSize: 11, color: "#9aa0b4" }}>
          {visible.length.toLocaleString()} answers · {groups.length ? `${groups.length} ${labelGroups ? "groups" : "clusters"}` : "gradient"} · zoom out for supernodes · click a star</div>
      </div>
      <div className="ih-encode">
        <h3>Layout</h3>{Seg(layout, v => setLayout(v as Layout), [["umap", "UMAP"], ["pca", "PCA"], ["category", "By category"], ["tier", "Tier bands"]])}
        <h3>Color / cluster by</h3>
        <div className="ih-seg">{["tier", "model", "category", "quality"].map(v => <button key={v} className={colorBy === v ? "on" : ""} onClick={() => setColorBy(v)}>{v}</button>)}</div>
        <div style={{ fontSize: 11, color: "#9aa0b4", margin: "8px 0 5px" }}>clustering algorithms</div>
        <div className="ih-seg">{algos.filter(a => a.computed).map(a => <button key={a.id} className={colorBy === a.id ? "on" : ""} onClick={() => setColorBy(a.id)} title={a.name}>{a.id}</button>)}</div>
        {cluster && <div className="ih-muted" style={{ fontSize: 11, marginTop: 7 }}>
          {algos.find(a => a.id === cluster.algo)?.name} · {cluster.chunks.size} clusters · avg cohesion {(
            [...cluster.chunks.values()].reduce((s, x) => s + x.cohesion, 0) / Math.max(1, cluster.chunks.size)).toFixed(2)}</div>}
        <h3>Size by</h3>{Seg(sizeBy, v => setSizeBy(v as SizeBy), [["uniform", "Uniform"], ["quality", "Quality"], ["length", "Length"]])}
        <h3>Hulls</h3>
        <div className="ih-seg"><button className={hulls ? "on" : ""} onClick={() => setHulls(true)}>on</button><button className={!hulls ? "on" : ""} onClick={() => setHulls(false)}>off</button></div>
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

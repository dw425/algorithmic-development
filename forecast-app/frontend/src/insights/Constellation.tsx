// MUSE InsightHub — the constellation: every answer a star; bind any metric to layout/color/size/filter.
import { useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";
import { api, TIER_COLOR, MODEL_COLOR, heat, type Node, type Tier } from "./api";

type Layout = "umap" | "pca" | "category" | "tier";
type ColorBy = "tier" | "model" | "category" | "quality";
type SizeBy = "uniform" | "quality" | "length";
const TIERS: Tier[] = ["small", "medium", "large"];
interface XNode extends Node { ux: number; uy: number; px: number; py: number; }

export default function Constellation({ onSelect }: { onSelect: (promptI: number) => void }) {
  const [raw, setRaw] = useState<XNode[]>([]);
  const [cats, setCats] = useState<string[]>([]);
  const [layout, setLayout] = useState<Layout>("umap");
  const [colorBy, setColorBy] = useState<ColorBy>("tier");
  const [sizeBy, setSizeBy] = useState<SizeBy>("uniform");
  const [tiers, setTiers] = useState<Set<Tier>>(new Set(TIERS));
  const [cat, setCat] = useState<string>("all");
  const [hover, setHover] = useState<{ n: XNode; sx: number; sy: number } | null>(null);
  const host = useRef<HTMLDivElement>(null);
  const cv = useRef<HTMLCanvasElement>(null);
  const tf = useRef(d3.zoomIdentity);
  const sizeRef = useRef({ w: 800, h: 600 });

  useEffect(() => {
    Promise.all([api.constellation("umap"), api.constellation("pca")]).then(([u, p]) => {
      const pmap = new Map(p.nodes.map(n => [n.id, n]));
      setRaw(u.nodes.map(n => ({ ...n, ux: n.x, uy: n.y, px: pmap.get(n.id)!.x, py: pmap.get(n.id)!.y })));
      setCats(u.categories);
    });
  }, []);

  // layout → position in [0,1]
  const pos = useMemo(() => {
    const m = new Map<number, [number, number]>();
    if (layout === "umap") raw.forEach(n => m.set(n.id, [n.ux, n.uy]));
    else if (layout === "pca") raw.forEach(n => m.set(n.id, [n.px, n.py]));
    else if (layout === "category") {
      const cols = 5, gw = 1 / cols, gh = 1 / Math.ceil(cats.length / cols);
      const ci = new Map(cats.map((c, i) => [c, i]));
      raw.forEach(n => { const i = ci.get(n.category) || 0; const cx = (i % cols) * gw, cy = Math.floor(i / cols) * gh;
        m.set(n.id, [cx + 0.06 + n.ux * (gw - 0.12), cy + 0.08 + n.uy * (gh - 0.16)]); });
    } else { // tier bands
      const bi: Record<Tier, number> = { small: 0, medium: 1, large: 2 };
      raw.forEach(n => m.set(n.id, [0.04 + n.ux * 0.92, 0.12 + bi[n.tier] * 0.3 + n.uy * 0.18]));
    }
    return m;
  }, [raw, layout, cats]);

  const visible = useMemo(() => raw.filter(n => tiers.has(n.tier) && (cat === "all" || n.category === cat)), [raw, tiers, cat]);

  const colorOf = (n: XNode): string => {
    if (colorBy === "tier") return TIER_COLOR[n.tier];
    if (colorBy === "model") return MODEL_COLOR[n.model] || "#888";
    if (colorBy === "category") { const i = cats.indexOf(n.category); return d3.schemeTableau10[i % 10]; }
    return n.quality == null ? "#3a4366" : heat(1 - (n.quality - 1) / 4); // quality: high=cool
  };
  const sizeOf = (n: XNode): number => {
    if (sizeBy === "length") return 1.2 + Math.min(4, n.length / 1500);
    if (sizeBy === "quality") return n.quality == null ? 1.4 : 1 + (n.quality / 5) * 3.6;
    return 2.0;
  };

  const quad = useMemo(() => {
    const W = sizeRef.current.w, H = sizeRef.current.h;
    return d3.quadtree<XNode>().x(n => (pos.get(n.id)?.[0] || 0) * W).y(n => (pos.get(n.id)?.[1] || 0) * H).addAll(visible);
  }, [visible, pos]);

  const draw = () => {
    const c = cv.current; if (!c) return;
    const { w, h } = sizeRef.current; const dpr = window.devicePixelRatio || 1;
    c.width = w * dpr; c.height = h * dpr; const ctx = c.getContext("2d")!; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const t = tf.current;
    ctx.globalAlpha = 0.82;
    for (const n of visible) {
      const p = pos.get(n.id); if (!p) continue;
      const sx = t.applyX(p[0] * w), sy = t.applyY(p[1] * h);
      if (sx < -10 || sx > w + 10 || sy < -10 || sy > h + 10) continue;
      ctx.fillStyle = colorOf(n);
      ctx.beginPath(); ctx.arc(sx, sy, sizeOf(n) * Math.min(2.4, Math.sqrt(t.k)), 0, 6.283); ctx.fill();
    }
    ctx.globalAlpha = 1;
    if (hover) {
      const p = pos.get(hover.n.id)!; const sx = t.applyX(p[0] * w), sy = t.applyY(p[1] * h);
      ctx.strokeStyle = "#fff"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(sx, sy, sizeOf(hover.n) * Math.min(2.4, Math.sqrt(t.k)) + 3, 0, 6.283); ctx.stroke();
    }
  };

  useEffect(() => { draw(); }); // redraw on any state change

  useEffect(() => {
    const c = cv.current, h = host.current; if (!c || !h) return;
    const ro = new ResizeObserver(() => { sizeRef.current = { w: h.clientWidth, h: h.clientHeight }; draw(); });
    ro.observe(h); sizeRef.current = { w: h.clientWidth, h: h.clientHeight };
    const zoom = d3.zoom<HTMLCanvasElement, unknown>().scaleExtent([0.6, 40]).on("zoom", (e) => { tf.current = e.transform; setHover(null); draw(); });
    d3.select(c).call(zoom);
    return () => ro.disconnect();
  }, []);

  const onMove = (e: React.MouseEvent) => {
    const r = cv.current!.getBoundingClientRect(); const mx = e.clientX - r.left, my = e.clientY - r.top;
    const { w, h } = sizeRef.current; const t = tf.current; const dx = t.invertX(mx), dy = t.invertY(my);
    const found = quad.find(dx, dy, 14);
    if (found) { const p = pos.get(found.id)!; setHover({ n: found, sx: t.applyX(p[0] * w), sy: t.applyY(p[1] * h) }); }
    else setHover(null);
  };

  const Seg = <T extends string>(val: T, set: (v: T) => void, opts: [T, string][]) => (
    <div className="ih-seg">{opts.map(([v, l]) => <button key={v} className={val === v ? "on" : ""} onClick={() => set(v)}>{l}</button>)}</div>
  );

  return (
    <div className="ih-const-wrap">
      <div className="ih-canvas-host" ref={host}>
        <canvas ref={cv} onMouseMove={onMove} onMouseLeave={() => setHover(null)}
          onClick={() => hover && onSelect(hover.n.prompt_i)} style={{ cursor: hover ? "pointer" : "grab" }} />
        {hover && <div className="ih-tip" style={{ left: Math.min(hover.sx + 14, sizeRef.current.w - 240), top: hover.sy + 12 }}>
          <div style={{ fontWeight: 700, color: colorOf(hover.n) }}>{hover.n.model}</div>
          <div className="ih-muted" style={{ fontSize: 11, margin: "3px 0" }}>{hover.n.tier} tier · {hover.n.category}</div>
          <div style={{ fontSize: 11 }}>length {hover.n.length} · quality {hover.n.quality ?? "—"}</div>
          <div style={{ fontSize: 11, marginTop: 4, color: "#7dd3fc" }}>click → open prompt #{hover.n.prompt_i}</div>
        </div>}
        <div style={{ position: "absolute", left: 12, bottom: 10, fontSize: 11, color: "#9aa0b4" }}>
          {visible.length.toLocaleString()} / {raw.length.toLocaleString()} answers · scroll to zoom · drag to pan · click a star</div>
      </div>
      <div className="ih-encode">
        <h3>Layout</h3>
        {Seg<Layout>(layout, setLayout, [["umap", "UMAP"], ["pca", "PCA"], ["category", "By category"], ["tier", "Tier bands"]])}
        <h3>Color by</h3>
        {Seg<ColorBy>(colorBy, setColorBy, [["tier", "Tier"], ["model", "Model"], ["category", "Category"], ["quality", "Quality"]])}
        <h3>Size by</h3>
        {Seg<SizeBy>(sizeBy, setSizeBy, [["uniform", "Uniform"], ["quality", "Quality"], ["length", "Length"]])}
        <h3>Tiers</h3>
        <div className="ih-seg">{TIERS.map(t => <button key={t} className={tiers.has(t) ? "on" : ""}
          onClick={() => { const s = new Set(tiers); s.has(t) ? s.delete(t) : s.add(t); setTiers(s); }}>{t}</button>)}</div>
        <h3>Category</h3>
        <select className="ih-input" value={cat} onChange={e => setCat(e.target.value)}>
          <option value="all">all categories</option>{cats.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <h3>Legend</h3>
        <div className="ih-legend">
          {colorBy === "tier" && TIERS.map(t => <span key={t} className="it"><span className="sw" style={{ background: TIER_COLOR[t] }} />{t}</span>)}
          {colorBy === "model" && Object.entries(MODEL_COLOR).map(([m, c]) => <span key={m} className="it"><span className="sw" style={{ background: c }} />{m}</span>)}
          {colorBy === "category" && cats.map((c, i) => <span key={c} className="it"><span className="sw" style={{ background: d3.schemeTableau10[i % 10] }} />{c}</span>)}
          {colorBy === "quality" && <span className="it"><span className="sw" style={{ background: "linear-gradient(90deg,#22d3a8,#dc3c50)" }} />low → high (cool=better)</span>}
        </div>
      </div>
    </div>
  );
}

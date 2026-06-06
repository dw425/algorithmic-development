import { useRef, useEffect, useState } from "react";
import * as d3 from "d3";
import type { CNode } from "./api";

const PALETTE = ["#3b82f6", "#34d399", "#f0b429", "#f87171", "#a78bfa", "#22d3ee", "#fb923c", "#e879f9"];

/** D3 + HTML5 Canvas constellation (adapted from etl-dep-viz ConstellationCanvas):
 *  force-positioned nodes, convex-hull cluster boundaries, density glow, hover, pan/zoom. */
export default function ConstellationCanvas({ nodes, height = 540 }: { nodes: CNode[]; height?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [hover, setHover] = useState<CNode | null>(null);
  const tf = useRef({ k: 1, x: 0, y: 0 });

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !nodes.length) return;
    const ctx = canvas.getContext("2d")!;
    const dpr = window.devicePixelRatio || 1;
    const W = canvas.clientWidth, H = height;
    canvas.width = W * dpr; canvas.height = H * dpr;
    ctx.scale(dpr, dpr);

    // map node coords (spring layout ~[-1,1]) to screen
    const xs = nodes.map((n) => n.x), ys = nodes.map((n) => n.y);
    const sx = d3.scaleLinear().domain([Math.min(...xs), Math.max(...xs)]).range([70, W - 70]);
    const sy = d3.scaleLinear().domain([Math.min(...ys), Math.max(...ys)]).range([H - 60, 60]);
    const pos = (n: CNode): [number, number] => [sx(n.x), sy(n.y)];

    const comms = Array.from(new Set(nodes.map((n) => n.community)));
    const quad = d3.quadtree<CNode>().x((n) => pos(n)[0]).y((n) => pos(n)[1]).addAll(nodes);

    function draw() {
      const t = tf.current;
      ctx.save(); ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = "#0f1117"; ctx.fillRect(0, 0, W, H);
      ctx.translate(t.x, t.y); ctx.scale(t.k, t.k);

      // 1) cluster convex hulls + density glow
      for (const c of comms) {
        const pts = nodes.filter((n) => n.community === c).map(pos) as [number, number][];
        const col = PALETTE[c % PALETTE.length];
        // density glow
        for (const p of pts) {
          const g = ctx.createRadialGradient(p[0], p[1], 0, p[0], p[1], 60);
          g.addColorStop(0, col + "22"); g.addColorStop(1, "#0f111700");
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p[0], p[1], 60, 0, 2 * Math.PI); ctx.fill();
        }
        if (pts.length >= 3) {
          const hull = d3.polygonHull(pts);
          if (hull) {
            ctx.beginPath(); ctx.moveTo(hull[0][0], hull[0][1]);
            hull.slice(1).forEach((h) => ctx.lineTo(h[0], h[1])); ctx.closePath();
            ctx.fillStyle = col + "18"; ctx.fill();
            ctx.strokeStyle = col + "66"; ctx.lineWidth = 1 / t.k; ctx.stroke();
          }
        }
      }
      // 2) nodes (size by |drift|, color by community)
      for (const n of nodes) {
        const [x, y] = pos(n);
        const r = (5 + Math.min(Math.abs(n.drift_pct), 80) * 0.12) / 1;
        ctx.beginPath(); ctx.arc(x, y, r, 0, 2 * Math.PI);
        ctx.fillStyle = PALETTE[n.community % PALETTE.length];
        ctx.globalAlpha = 0.9; ctx.fill(); ctx.globalAlpha = 1;
        ctx.strokeStyle = "#0f1117"; ctx.lineWidth = 1 / t.k; ctx.stroke();
        if (t.k > 0.6) {
          ctx.fillStyle = "#c8cee0"; ctx.font = `${11 / t.k}px -apple-system, sans-serif`;
          ctx.fillText(n.id, x + r + 2, y + 3);
        }
      }
      ctx.restore();
    }
    draw();

    const zoom = d3.zoom<HTMLCanvasElement, unknown>().scaleExtent([0.4, 6])
      .on("zoom", (e) => { tf.current = { k: e.transform.k, x: e.transform.x, y: e.transform.y }; draw(); });
    d3.select(canvas).call(zoom);

    function onMove(e: MouseEvent) {
      const rect = canvas!.getBoundingClientRect();
      const t = tf.current;
      const mx = (e.clientX - rect.left - t.x) / t.k, my = (e.clientY - rect.top - t.y) / t.k;
      const hit = quad.find(mx, my, 30);
      setHover(hit || null);
    }
    canvas.addEventListener("mousemove", onMove);
    return () => { canvas.removeEventListener("mousemove", onMove); d3.select(canvas).on(".zoom", null); };
  }, [nodes, height]);

  return (
    <div style={{ position: "relative" }}>
      <canvas ref={ref} style={{ width: "100%", height, borderRadius: 10, border: "1px solid #20242f", cursor: "grab" }} />
      {hover && (
        <div style={{ position: "absolute", top: 8, right: 8, background: "#1a1d27",
          border: "1px solid #2c3142", borderRadius: 8, padding: "8px 12px", fontSize: 12, color: "#c8cee0" }}>
          <b>{hover.id}</b> · cluster {hover.community}<br />drift {hover.drift_pct}% · vol {hover.vol_pct}%
        </div>
      )}
      <div className="kv" style={{ marginTop: 6 }}>Drag to pan · scroll to zoom · hover a star for detail. Hulls = Louvain communities, glow = density.</div>
    </div>
  );
}

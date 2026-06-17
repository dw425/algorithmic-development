// MUSE InsightHub — SVG chart kit. Real proportional viewBoxes (no preserveAspectRatio="none"),
// crisp vector text, rotated labels for crowded axes.
import { useState } from "react";

const DIM = "#8899aa", LINE = "#3a4a5e", INK = "#e2e8f0";

export function Bars({ data, height = 220, fmt = (v: number) => v.toFixed(2), onClick }: {
  data: { label: string; value: number; color?: string }[]; height?: number;
  fmt?: (v: number) => string; onClick?: (i: number) => void;
}) {
  const W = Math.max(320, data.length * 66), H = height, pad = 26, bw = (W - 16) / data.length;
  const max = Math.max(...data.map(d => d.value), 1e-9);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxHeight: H + 10, maxWidth: W, display: "block" }}>
      {data.map((d, i) => {
        const h = (d.value / max) * (H - pad - 22), x = 8 + i * bw, y = H - pad - h;
        return (
          <g key={i} onClick={() => onClick?.(i)} style={{ cursor: onClick ? "pointer" : "default" }}>
            <rect x={x + bw * 0.16} y={y} width={bw * 0.68} height={h} rx={2} fill={d.color || "#3b82f6"} />
            <text x={x + bw / 2} y={y - 4} fill="#cfe0ff" fontSize={11} textAnchor="middle">{fmt(d.value)}</text>
            <text x={x + bw / 2} y={H - 8} fill={DIM} fontSize={11} textAnchor="middle">{d.label.length > 11 ? d.label.slice(0, 10) + "…" : d.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

export function HBars({ data, fmt = (v: number) => v.toFixed(2), max, onClick }: {
  data: { label: string; value: number; color?: string }[]; fmt?: (v: number) => string; max?: number; onClick?: (i: number) => void;
}) {
  const m = max ?? Math.max(...data.map(d => d.value), 1e-9);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      {data.map((d, i) => (
        <div key={i} onClick={() => onClick?.(i)} style={{ display: "flex", alignItems: "center", gap: 9, cursor: onClick ? "pointer" : "default" }}>
          <div style={{ width: 140, fontSize: 12, color: DIM, textAlign: "right", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.label}</div>
          <div style={{ flex: 1, background: "#151d2b", borderRadius: 4, height: 16, position: "relative" }}>
            <div style={{ width: `${(d.value / m) * 100}%`, background: d.color || "#3b82f6", height: "100%", borderRadius: 4, minWidth: 2 }} />
          </div>
          <div style={{ width: 48, fontSize: 12, color: "#cfe0ff", fontWeight: 600 }}>{fmt(d.value)}</div>
        </div>
      ))}
    </div>
  );
}

export function GroupedBars({ groups, series, height = 250, fmt = (v: number) => v.toFixed(2) }: {
  groups: string[]; series: { name: string; color: string; values: (number | null)[] }[]; height?: number; fmt?: (v: number) => string;
}) {
  const [hov, setHov] = useState<{ g: number; s: number } | null>(null);
  const max = Math.max(...series.flatMap(s => s.values.map(v => v || 0)), 1e-9);
  const W = Math.max(560, groups.length * 52), H = height, pad = 56, gw = (W - 16) / groups.length, bw = (gw * 0.74) / series.length;
  return (
    <div style={{ position: "relative" }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block", maxWidth: W, maxHeight: H }}>
        {[0.25, 0.5, 0.75, 1].map(f => <line key={f} x1={8} x2={W - 8} y1={H - pad - f * (H - pad - 14)} y2={H - pad - f * (H - pad - 14)} stroke={LINE} strokeOpacity={0.4} />)}
        {groups.map((_g, gi) => series.map((s, si) => {
          const v = s.values[gi] || 0, h = (v / max) * (H - pad - 14), x = 8 + gi * gw + gw * 0.13 + si * bw, y = H - pad - h;
          return <rect key={`${gi}-${si}`} x={x} y={y} width={bw * 0.86} height={h} rx={1.5} fill={s.color}
            onMouseEnter={() => setHov({ g: gi, s: si })} onMouseLeave={() => setHov(null)} />;
        }))}
        {groups.map((g, gi) => <text key={gi} x={8 + gi * gw + gw / 2} y={H - pad + 14} fill={DIM} fontSize={11}
          textAnchor="end" transform={`rotate(-40 ${8 + gi * gw + gw / 2} ${H - pad + 14})`}>{g.length > 13 ? g.slice(0, 12) + "…" : g}</text>)}
      </svg>
      <div style={{ display: "flex", gap: 14, marginTop: 4, flexWrap: "wrap" }}>
        {series.map(s => <span key={s.name} style={{ fontSize: 12, color: DIM, display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, background: s.color }} />{s.name}</span>)}
      </div>
      {hov && <div style={{ position: "absolute", top: 4, right: 4, background: "#0f1722f0", border: `1px solid ${LINE}`, borderRadius: 6, padding: "6px 9px", fontSize: 12, color: INK }}>
        {groups[hov.g]} · {series[hov.s].name}: <b>{fmt(series[hov.s].values[hov.g] || 0)}</b></div>}
    </div>
  );
}

export function Line2Axis({ labels, a, b }: { labels: string[]; a: { name: string; color: string; values: number[] }; b: { name: string; color: string; values: number[] } }) {
  const W = 420, H = 220, pad = 34;
  const xs = labels.map((_, i) => pad + (i / Math.max(1, labels.length - 1)) * (W - 2 * pad));
  const sc = (vals: number[]) => { const lo = Math.min(...vals), hi = Math.max(...vals); return (v: number) => H - pad - ((v - lo) / (hi - lo + 1e-9)) * (H - 2 * pad); };
  const ya = sc(a.values), yb = sc(b.values);
  const path = (vals: number[], y: (v: number) => number) => vals.map((v, i) => `${i ? "L" : "M"}${xs[i]},${y(v)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxHeight: 230, display: "block" }}>
      {labels.map((l, i) => <text key={i} x={xs[i]} y={H - 10} fill={DIM} fontSize={12} textAnchor="middle">{l}</text>)}
      <path d={path(a.values, ya)} fill="none" stroke={a.color} strokeWidth={2.5} />
      <path d={path(b.values, yb)} fill="none" stroke={b.color} strokeWidth={2.5} strokeDasharray="5 4" />
      {a.values.map((v, i) => <g key={"a" + i}><circle cx={xs[i]} cy={ya(v)} r={4} fill={a.color} /><text x={xs[i]} y={ya(v) - 9} fill={a.color} fontSize={11} textAnchor="middle">{v.toFixed(3)}</text></g>)}
      {b.values.map((v, i) => <g key={"b" + i}><rect x={xs[i] - 3.5} y={yb(v) - 3.5} width={7} height={7} fill={b.color} /><text x={xs[i]} y={yb(v) + 17} fill={b.color} fontSize={11} textAnchor="middle">{v.toFixed(2)}</text></g>)}
      <text x={pad} y={18} fill={a.color} fontSize={11}>{a.name}</text>
      <text x={W - pad} y={18} fill={b.color} fontSize={11} textAnchor="end">{b.name}</text>
    </svg>
  );
}

export function Heatmap({ labels, matrix, fmt = (v: number) => v.toFixed(3) }: { labels: string[]; matrix: number[][]; fmt?: (v: number) => string }) {
  const flat = matrix.flat(); const lo = Math.min(...flat), hi = Math.max(...flat);
  const col = (v: number) => { const t = (v - lo) / (hi - lo + 1e-9); return `rgb(${34 + t * 20},${110 + t * 90},${90 + t * 50})`; };
  return (
    <table style={{ borderCollapse: "collapse", fontSize: 12 }}>
      <tbody>
        <tr><td></td>{labels.map(l => <td key={l} style={{ color: DIM, padding: "3px 6px", fontSize: 11 }}>{l.split(":")[0].slice(0, 9)}</td>)}</tr>
        {matrix.map((row, i) => (
          <tr key={i}><td style={{ color: DIM, padding: "3px 7px", fontSize: 11, textAlign: "right" }}>{labels[i].split(":")[0].slice(0, 9)}</td>
            {row.map((v, j) => <td key={j} style={{ background: col(v), color: ((v - lo) / (hi - lo + 1e-9)) > 0.6 ? "#06241c" : "#e2e8f0", padding: "9px 11px", textAlign: "center", fontWeight: 600, borderRadius: 3 }}>{i === j ? "—" : fmt(v)}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function Histogram({ values, bins = 30, color = "#3b82f6", height = 170 }: { values: number[]; bins?: number; color?: string; height?: number }) {
  if (!values.length) return null;
  const W = 420, H = height, pad = 16;
  const lo = Math.min(...values), hi = Math.max(...values), w = (hi - lo) / bins || 1;
  const counts = new Array(bins).fill(0);
  values.forEach(v => { const bnd = Math.min(bins - 1, Math.floor((v - lo) / w)); counts[bnd]++; });
  const max = Math.max(...counts), bw = (W - 2 * pad) / bins;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxHeight: H + 6, display: "block" }}>
      {counts.map((c, i) => <rect key={i} x={pad + i * bw} y={H - pad - (c / max) * (H - 2 * pad)} width={bw * 0.9} height={(c / max) * (H - 2 * pad)} fill={color} />)}
    </svg>
  );
}

export function Donut({ data, size = 150 }: { data: { label: string; value: number; color: string }[]; size?: number }) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1; let acc = 0; const r = size / 2 - 6, cx = size / 2, cy = size / 2;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
      <svg width={size} height={size}>
        {data.map((d, i) => {
          const a0 = (acc / total) * 2 * Math.PI - Math.PI / 2; acc += d.value; const a1 = (acc / total) * 2 * Math.PI - Math.PI / 2;
          const x0 = cx + r * Math.cos(a0), y0 = cy + r * Math.sin(a0), x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1);
          return <path key={i} d={`M${cx},${cy} L${x0},${y0} A${r},${r} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${x1},${y1} Z`} fill={d.color} stroke="#1a2332" strokeWidth={1.5} />;
        })}
        <circle cx={cx} cy={cy} r={r * 0.56} fill="#243044" />
      </svg>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {data.map(d => <span key={d.label} style={{ fontSize: 12, color: DIM, display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, background: d.color }} />{d.label} <b style={{ color: "#cfe0ff" }}>{d.value}</b></span>)}
      </div>
    </div>
  );
}

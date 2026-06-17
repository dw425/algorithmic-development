// MUSE InsightHub — reusable SVG chart primitives (interactive, dark-theme).
import { useState } from "react";

const DIM = "#9aa0b4", LINE = "#232a48";

export function Bars({ data, height = 220, fmt = (v: number) => v.toFixed(2), onClick }: {
  data: { label: string; value: number; color?: string }[]; height?: number;
  fmt?: (v: number) => string; onClick?: (i: number) => void;
}) {
  const max = Math.max(...data.map(d => d.value), 1e-9);
  const w = 100 / data.length;
  return (
    <svg viewBox={`0 0 100 ${height / 4}`} width="100%" height={height} preserveAspectRatio="none" style={{ overflow: "visible" }}>
      {data.map((d, i) => {
        const h = (d.value / max) * (height / 4 - 12);
        return (
          <g key={i} onClick={() => onClick?.(i)} style={{ cursor: onClick ? "pointer" : "default" }}>
            <rect x={i * w + w * 0.16} y={height / 4 - 8 - h} width={w * 0.68} height={h} rx={1.2} fill={d.color || "#22d3a8"} />
            <text x={i * w + w / 2} y={height / 4 - 8 - h - 1.5} fill="#cfe8ff" fontSize={2.6} textAnchor="middle">{fmt(d.value)}</text>
            <text x={i * w + w / 2} y={height / 4 - 2.5} fill={DIM} fontSize={2.5} textAnchor="middle">{d.label.length > 12 ? d.label.slice(0, 11) + "…" : d.label}</text>
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
          <div style={{ width: 132, fontSize: 12, color: DIM, textAlign: "right", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.label}</div>
          <div style={{ flex: 1, background: "#0f1426", borderRadius: 5, height: 16, position: "relative" }}>
            <div style={{ width: `${(d.value / m) * 100}%`, background: d.color || "#22d3a8", height: "100%", borderRadius: 5, minWidth: 2 }} />
          </div>
          <div style={{ width: 46, fontSize: 12, color: "#cfe8ff", fontWeight: 600 }}>{fmt(d.value)}</div>
        </div>
      ))}
    </div>
  );
}

export function GroupedBars({ groups, series, height = 280, fmt = (v: number) => v.toFixed(2) }: {
  groups: string[]; series: { name: string; color: string; values: (number | null)[] }[]; height?: number; fmt?: (v: number) => string;
}) {
  const [hov, setHov] = useState<{ g: number; s: number } | null>(null);
  const max = Math.max(...series.flatMap(s => s.values.map(v => v || 0)), 1e-9);
  const gw = 100 / groups.length, bw = (gw * 0.74) / series.length;
  return (
    <div style={{ position: "relative" }}>
      <svg viewBox={`0 0 100 ${height / 4}`} width="100%" height={height} preserveAspectRatio="none">
        {groups.map((_g, gi) => series.map((s, si) => {
          const v = s.values[gi] || 0; const h = (v / max) * (height / 4 - 14);
          const x = gi * gw + gw * 0.13 + si * bw;
          return <rect key={`${gi}-${si}`} x={x} y={height / 4 - 9 - h} width={bw * 0.86} height={h} rx={0.8} fill={s.color}
            onMouseEnter={() => setHov({ g: gi, s: si })} onMouseLeave={() => setHov(null)} />;
        }))}
        {groups.map((g, gi) => <text key={gi} x={gi * gw + gw / 2} y={height / 4 - 3} fill={DIM} fontSize={2.3} textAnchor="middle"
          transform={`rotate(0)`}>{g.length > 10 ? g.slice(0, 9) + "…" : g}</text>)}
      </svg>
      <div style={{ display: "flex", gap: 14, marginTop: 6, flexWrap: "wrap" }}>
        {series.map(s => <span key={s.name} style={{ fontSize: 12, color: DIM, display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 10, height: 10, borderRadius: 3, background: s.color }} />{s.name}</span>)}
      </div>
      {hov && <div style={{ position: "absolute", top: 4, right: 4, background: "#0b1020ee", border: `1px solid ${LINE}`, borderRadius: 8, padding: "6px 9px", fontSize: 12 }}>
        {groups[hov.g]} · {series[hov.s].name}: <b>{fmt(series[hov.s].values[hov.g] || 0)}</b></div>}
    </div>
  );
}

export function Line2Axis({ labels, a, b }: { labels: string[]; a: { name: string; color: string; values: number[] }; b: { name: string; color: string; values: number[] } }) {
  const W = 320, H = 180, pad = 30;
  const xs = labels.map((_, i) => pad + (i / (labels.length - 1)) * (W - 2 * pad));
  const sc = (vals: number[]) => { const lo = Math.min(...vals), hi = Math.max(...vals); return (v: number) => H - pad - ((v - lo) / (hi - lo + 1e-9)) * (H - 2 * pad); };
  const ya = sc(a.values), yb = sc(b.values);
  const path = (vals: number[], y: (v: number) => number) => vals.map((v, i) => `${i ? "L" : "M"}${xs[i]},${y(v)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={210}>
      {labels.map((l, i) => <text key={i} x={xs[i]} y={H - 8} fill={DIM} fontSize={11} textAnchor="middle">{l}</text>)}
      <path d={path(a.values, ya)} fill="none" stroke={a.color} strokeWidth={2.5} />
      <path d={path(b.values, yb)} fill="none" stroke={b.color} strokeWidth={2.5} strokeDasharray="5 4" />
      {a.values.map((v, i) => <g key={"a" + i}><circle cx={xs[i]} cy={ya(v)} r={4} fill={a.color} /><text x={xs[i]} y={ya(v) - 8} fill={a.color} fontSize={11} textAnchor="middle">{v.toFixed(3)}</text></g>)}
      {b.values.map((v, i) => <g key={"b" + i}><rect x={xs[i] - 3.5} y={yb(v) - 3.5} width={7} height={7} fill={b.color} /><text x={xs[i]} y={yb(v) + 16} fill={b.color} fontSize={11} textAnchor="middle">{v.toFixed(2)}</text></g>)}
      <text x={pad} y={16} fill={a.color} fontSize={11}>{a.name}</text>
      <text x={W - pad} y={16} fill={b.color} fontSize={11} textAnchor="end">{b.name}</text>
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
            {row.map((v, j) => <td key={j} style={{ background: col(v), color: ((v - lo) / (hi - lo + 1e-9)) > 0.6 ? "#06241c" : "#cfe8ff", padding: "9px 11px", textAlign: "center", fontWeight: 600, borderRadius: 3 }}>{i === j ? "—" : fmt(v)}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function Histogram({ values, bins = 30, color = "#4C72B0", height = 160 }: { values: number[]; bins?: number; color?: string; height?: number }) {
  if (!values.length) return null;
  const lo = Math.min(...values), hi = Math.max(...values); const w = (hi - lo) / bins || 1;
  const counts = new Array(bins).fill(0);
  values.forEach(v => { const b = Math.min(bins - 1, Math.floor((v - lo) / w)); counts[b]++; });
  const max = Math.max(...counts);
  return (
    <svg viewBox={`0 0 100 40`} width="100%" height={height} preserveAspectRatio="none">
      {counts.map((c, i) => <rect key={i} x={i * (100 / bins)} y={40 - (c / max) * 38} width={100 / bins * 0.9} height={(c / max) * 38} fill={color} />)}
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
          return <path key={i} d={`M${cx},${cy} L${x0},${y0} A${r},${r} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${x1},${y1} Z`} fill={d.color} stroke="#0a0e1a" strokeWidth={1.5} />;
        })}
        <circle cx={cx} cy={cy} r={r * 0.56} fill="#121728" />
      </svg>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {data.map(d => <span key={d.label} style={{ fontSize: 12, color: DIM, display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 10, height: 10, borderRadius: 3, background: d.color }} />{d.label} <b style={{ color: "#cfe8ff" }}>{d.value}</b></span>)}
      </div>
    </div>
  );
}

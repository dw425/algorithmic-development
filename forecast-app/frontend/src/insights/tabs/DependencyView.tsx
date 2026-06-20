// MUSE InsightHub — Dependency: an etlviz-style relationship graph of the 21 models. Nodes are
// models laid out in 3 tier columns; edges are within-tier answer-agreement (similarity). Thicker
// edge = stronger agreement. Below: per-tier 3x3 similarity heatmaps + tier cohesion bars.
import { useEffect, useMemo, useState } from "react";
import { api, TIER_COLOR, MODEL_COLOR, fmt, type ModelRow, type PairRow } from "../api";
import { Heatmap, HBars } from "../charts";

const TIERS = ["small", "medium", "large"] as const;
type Tier = typeof TIERS[number];
const short = (name: string) => name.split(":")[0];

export default function DependencyView(_props: { onOpen: (i: number) => void }) {
  const [data, setData] = useState<{ models: ModelRow[]; pairs: PairRow[] } | null>(null);
  const [hover, setHover] = useState<string | null>(null);

  useEffect(() => { api.models().then(setData); }, []);

  const L = useMemo(() => {
    if (!data) return null;
    const W = 960, H = 480;
    const colX: Record<Tier, number> = { small: 200, medium: 480, large: 760 };
    const rowY = [110, 240, 370];
    const maxQ = Math.max(...data.models.map(m => m.mean_quality ?? 0), 1e-9);
    type N = { m: ModelRow; t: Tier; sh: string; x: number; y: number; r: number };
    const nodes: N[] = [];
    TIERS.forEach(t => data.models.filter(m => m.tier === t).forEach((m, j) => {
      const r = 18 + ((m.mean_quality ?? 0) / maxQ) * 22;
      nodes.push({ m, t, sh: short(m.name), x: colX[t], y: rowY[j] ?? H / 2, r });
    }));
    // resolve each within-tier pair to its two nodes (PairRow.a/b are short labels within a tier)
    const find = (t: Tier, lbl: string) => nodes.find(n => n.t === t && (n.sh === lbl || n.m.name === lbl || n.sh.startsWith(lbl)));
    const sims = data.pairs.map(p => p.similarity);
    const sLo = sims.length ? Math.min(...sims) : 0, sHi = sims.length ? Math.max(...sims) : 1;
    type E = { p: PairRow; a: N; b: N; w: number; o: number };
    const edges: E[] = [];
    data.pairs.forEach(p => {
      const a = find(p.tier, p.a), b = find(p.tier, p.b);
      if (!a || !b) return;
      const t = (p.similarity - sLo) / (sHi - sLo + 1e-9);
      edges.push({ p, a, b, w: 1.2 + t * 8, o: 0.25 + t * 0.55 });
    });
    return { W, H, colX, nodes, edges };
  }, [data]);

  if (!data || !L) return <><div className="ih-h1">Dependency</div><div className="ih-loading">Loading…</div></>;
  const { W, H, colX, nodes, edges } = L;
  const involved = (sh: string) => hover != null && hover !== sh && edges.some(e => (e.a.sh === hover && e.b.sh === sh) || (e.b.sh === hover && e.a.sh === sh));

  // per-tier 3x3 similarity heatmaps
  const tierMatrix = (t: Tier) => {
    const ms = data.models.filter(m => m.tier === t);
    const labels = ms.map(m => m.name);
    const ps = data.pairs.filter(p => p.tier === t);
    const sim = (i: number, j: number) => {
      if (i === j) return 1;
      const ai = short(ms[i].name), aj = short(ms[j].name);
      const hit = ps.find(p => (p.a === ai && p.b === aj) || (p.a === aj && p.b === ai)
        || (ms[i].name === p.a && ms[j].name === p.b) || (ms[i].name === p.b && ms[j].name === p.a));
      return hit ? hit.similarity : 0;
    };
    const matrix = ms.map((_, i) => ms.map((_, j) => sim(i, j)));
    return { labels, matrix };
  };

  // tier cohesion = mean within-tier similarity (1 - mean divergence)
  const cohesion = TIERS.map(t => {
    const ps = data.pairs.filter(p => p.tier === t);
    const v = ps.length ? ps.reduce((s, p) => s + p.similarity, 0) / ps.length : 0;
    return { label: t, value: v, color: TIER_COLOR[t] };
  });

  const allPairs = [...data.pairs].sort((a, b) => b.similarity - a.similarity);

  return (
    <>
      <div className="ih-h1">Dependency</div>
      <div className="ih-sub">How the models relate — within-tier agreement networks. Each node is a model (size = mean judged quality); edges connect the three models inside a tier, with <b>thicker, brighter</b> links meaning the two models <i>agree more</i> on their answers. Cross-tier links aren't measured here.</div>

      <div className="ih-panel" style={{ position: "relative" }}>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxHeight: 540, background: "#141d29", borderRadius: 7, border: "1px solid var(--line)", display: "block" }}>
          {/* tier column headers */}
          {TIERS.map(t => <text key={t} x={colX[t]} y={34} fill={TIER_COLOR[t]} fontSize={13} textAnchor="middle" fontWeight={700}>{t.toUpperCase()}</text>)}
          {TIERS.map(t => <text key={t + "s"} x={colX[t]} y={50} fill="var(--dim)" fontSize={10} textAnchor="middle">cohesion {fmt(cohesion.find(c => c.label === t)?.value)}</text>)}

          {/* within-tier agreement edges */}
          {edges.map((e, k) => {
            const lit = hover == null || hover === e.a.sh || hover === e.b.sh;
            return <line key={"e" + k} x1={e.a.x} y1={e.a.y} x2={e.b.x} y2={e.b.y}
              stroke={TIER_COLOR[e.a.t]} strokeWidth={e.w} strokeOpacity={lit ? e.o : 0.08} strokeLinecap="round" />;
          })}

          {/* model nodes */}
          {nodes.map((n, k) => {
            const hot = hover === n.sh, near = involved(n.sh), dim = hover != null && !hot && !near;
            const fill = MODEL_COLOR[n.m.name] || TIER_COLOR[n.t];
            return <g key={k} style={{ cursor: "pointer" }} onMouseEnter={() => setHover(n.sh)} onMouseLeave={() => setHover(null)}>
              <circle cx={n.x} cy={n.y} r={n.r} fill={fill} fillOpacity={dim ? 0.35 : 0.92}
                stroke={hot ? "#fff" : near ? "#cfe0ff" : "var(--line2)"} strokeWidth={hot ? 3 : near ? 2 : 1} />
              <text x={n.x} y={n.y + 3} fill="#06121f" fontSize={11} textAnchor="middle" fontWeight={700} opacity={dim ? 0.5 : 1}>{fmt(n.m.mean_quality, 1)}</text>
              <text x={n.x} y={n.y + n.r + 15} fill="var(--ink)" fontSize={11} textAnchor="middle" opacity={dim ? 0.5 : 1}>{n.sh}</text>
              <text x={n.x} y={n.y + n.r + 28} fill="var(--dim)" fontSize={9} textAnchor="middle" opacity={dim ? 0.5 : 1}>n={n.m.n}</text>
            </g>;
          })}
        </svg>

        {/* legend */}
        <div style={{ display: "flex", gap: 16, marginTop: 10, flexWrap: "wrap", alignItems: "center" }}>
          {TIERS.map(t => <span key={t} style={{ fontSize: 12, color: "var(--dim)", display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 11, height: 11, borderRadius: 11, background: TIER_COLOR[t] }} />{t} tier</span>)}
          <span style={{ fontSize: 12, color: "var(--dim)" }}>· node size = mean quality · edge thickness = within-tier agreement</span>
        </div>
      </div>

      <div className="ih-panel">
        <h2>Within-tier agreement</h2><div className="pd">per-tier 3×3 answer-similarity matrices (1 = identical, higher = more agreement)</div>
        <div style={{ display: "flex", gap: 26, flexWrap: "wrap" }}>
          {TIERS.map(t => { const tm = tierMatrix(t); return (
            <div key={t}>
              <div style={{ color: TIER_COLOR[t], fontWeight: 700, fontSize: 12, marginBottom: 6 }}>{t.toUpperCase()}</div>
              <Heatmap labels={tm.labels} matrix={tm.matrix} />
            </div>
          ); })}
        </div>
      </div>

      <div className="ih-grid2">
        <div className="ih-panel">
          <h2>Tier cohesion</h2><div className="pd">mean within-tier similarity — how tightly a tier's models agree</div>
          <HBars data={cohesion} max={1} fmt={v => v.toFixed(3)} />
        </div>
        <div className="ih-panel">
          <h2>All within-tier pairs</h2><div className="pd">9 pairs (3 per tier), sorted by agreement</div>
          <table className="ih-table"><thead><tr><th>Tier</th><th>Pair</th><th>Divergence</th><th>Similarity</th></tr></thead>
            <tbody>{allPairs.map((p, k) => <tr key={k}>
              <td style={{ color: TIER_COLOR[p.tier] }}>{p.tier}</td>
              <td>{p.a} ↔ {p.b}</td>
              <td>{fmt(p.divergence)}</td>
              <td><b>{fmt(p.similarity)}</b></td></tr>)}</tbody></table>
        </div>
      </div>
    </>
  );
}

// MUSE InsightHub — Neural Net: one prompt fed through all 9 models as a layered network.
// Input (prompt) → 3 tier columns of 3 model-neurons → synthesis. Neuron size = answer length,
// ring = judged quality; intra-tier edges weighted by agreement (1 - divergence). Shows where the
// council converges or splits, and the 9 answers side by side.
import { useEffect, useMemo, useState } from "react";
import { api, TIER_COLOR, MODEL_COLOR, fmt, type AnswerFull, type PromptRow } from "../api";

const TIERS = ["small", "medium", "large"] as const;
type Tier = typeof TIERS[number];

export default function NeuralNet({ onOpen }: { onOpen: (i: number) => void }) {
  const [i, setI] = useState<number>(0);
  const [data, setData] = useState<{ prompt: PromptRow; answers: AnswerFull[] } | null>(null);
  const [divList, setDivList] = useState<number[]>([]);
  const [hover, setHover] = useState<AnswerFull | null>(null);

  useEffect(() => { api.divergence("large", "desc", 60).then(d => { setDivList(d.prompts.map(p => p.i)); if (d.prompts[0]) setI(d.prompts[0].i); }); }, []);
  useEffect(() => { api.prompt(i).then(setData); }, [i]);

  const layout = useMemo(() => {
    if (!data) return null;
    const W = 960, H = 520, inX = 70, outX = 890, colX: Record<Tier, number> = { small: 320, medium: 540, large: 740 }, rowY = [120, 260, 400];
    const cy = H / 2;
    const div: Record<Tier, number | null> = { small: data.prompt.sm_div, medium: data.prompt.md_div, large: data.prompt.lg_div };
    const neurons: { a: AnswerFull; x: number; y: number; t: Tier; r: number }[] = [];
    TIERS.forEach(t => data.answers.filter(a => a.tier === t).forEach((a, j) => {
      neurons.push({ a, x: colX[t], y: rowY[j] ?? cy, t, r: 13 + Math.min(17, a.length / 420) });
    }));
    return { W, H, inX, outX, colX, rowY, cy, div, neurons };
  }, [data]);

  if (!data || !layout) return <><div className="ih-h1">Neural Net</div><div className="ih-loading">Loading…</div></>;
  const { W, H, inX, outX, colX, cy, div, neurons } = layout;
  const idx = divList.indexOf(i);
  const best = [...data.answers].filter(a => a.quality != null).sort((a, b) => (b.quality! - a.quality!))[0];
  const curve = (x0: number, y0: number, x1: number, y1: number) => `M${x0},${y0} C${(x0 + x1) / 2},${y0} ${(x0 + x1) / 2},${y1} ${x1},${y1}`;

  return (
    <>
      <div className="ih-h1">Neural Net — one prompt across all 9 models</div>
      <div className="ih-sub">The prompt is fed through every model. Neuron = a model's answer (size = length · ring = judged quality); intra-tier edges are weighted by agreement (1 − divergence). Watch where the council converges vs. splits.</div>

      <div className="ih-panel">
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
          <button className="ih-chip" onClick={() => setI(divList[Math.max(0, idx - 1)] ?? i)}>‹ prev</button>
          <button className="ih-chip" onClick={() => setI(divList[Math.min(divList.length - 1, idx + 1)] ?? i)}>next ›</button>
          <span className="ih-muted" style={{ fontSize: 11 }}>most-divergent prompt {idx + 1} / {divList.length}</span>
          <span className="ih-pill" style={{ background: "#1f3a5f", color: "var(--accent)" }}>#{i} · {data.prompt.category}</span>
          <span className="ih-muted" style={{ fontSize: 12, flex: 1 }}>{data.prompt.prompt.slice(0, 96)}</span>
        </div>

        <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxHeight: 540, background: "#141d29", borderRadius: 7, border: "1px solid var(--line)" }}>
          {/* tier band labels */}
          {TIERS.map(t => <text key={t} x={colX[t]} y={28} fill={TIER_COLOR[t]} fontSize={12} textAnchor="middle" fontWeight={700}>{t.toUpperCase()} · div {fmt(div[t])}</text>)}
          {/* input → neurons */}
          {neurons.map((n, k) => <path key={"i" + k} d={curve(inX + 26, cy, n.x - n.r, n.y)} fill="none" stroke="rgba(136,153,170,0.22)" strokeWidth={1} />)}
          {/* neurons → output */}
          {neurons.map((n, k) => <path key={"o" + k} d={curve(n.x + n.r, n.y, outX - 26, cy)} fill="none"
            stroke={n.a.quality != null ? `rgba(96,165,250,${0.1 + (n.a.quality / 5) * 0.35})` : "rgba(136,153,170,0.15)"} strokeWidth={n.a.quality != null ? 0.6 + (n.a.quality / 5) * 2 : 0.6} />)}
          {/* intra-tier agreement edges (thicker = more agreement) */}
          {TIERS.map(t => { const ns = neurons.filter(n => n.t === t); const sim = 1 - (div[t] ?? 0.2);
            return ns.map((a, p) => ns.slice(p + 1).map((b, q) => <line key={`${t}-${p}-${q}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y}
              stroke={TIER_COLOR[t]} strokeOpacity={0.18 + sim * 0.5} strokeWidth={0.5 + sim * 3} />)); })}
          {/* input node */}
          <g><circle cx={inX} cy={cy} r={26} fill="#243044" stroke="var(--accent)" strokeWidth={2} />
            <text x={inX} y={cy - 2} fill="#fff" fontSize={10} textAnchor="middle" fontWeight={700}>PROMPT</text>
            <text x={inX} y={cy + 11} fill="var(--dim)" fontSize={8} textAnchor="middle">{data.prompt.category.slice(0, 9)}</text></g>
          {/* model neurons */}
          {neurons.map((n, k) => <g key={k} style={{ cursor: "pointer" }} onMouseEnter={() => setHover(n.a)} onMouseLeave={() => setHover(null)} onClick={() => onOpen(i)}>
            <circle cx={n.x} cy={n.y} r={n.r} fill={MODEL_COLOR[n.a.model] || TIER_COLOR[n.t]} fillOpacity={0.85}
              stroke={n.a.quality != null ? "#fff" : "var(--line2)"} strokeWidth={n.a.quality != null ? 0.6 + (n.a.quality / 5) * 2.4 : 1} />
            <text x={n.x} y={n.y - n.r - 5} fill="var(--ink)" fontSize={9} textAnchor="middle">{n.a.model.split(":")[0].slice(0, 12)}</text>
            <text x={n.x} y={n.y + 3} fill="#06121f" fontSize={9} textAnchor="middle" fontWeight={700}>{n.a.quality ?? "·"}</text>
          </g>)}
          {/* output node */}
          <g><circle cx={outX} cy={cy} r={28} fill="#243044" stroke="#22c55e" strokeWidth={2} />
            <text x={outX} y={cy - 4} fill="#fff" fontSize={9} textAnchor="middle" fontWeight={700}>SYNTH</text>
            <text x={outX} y={cy + 8} fill="var(--dim)" fontSize={8} textAnchor="middle">q {fmt(data.prompt.avg_quality, 1)}</text></g>
          {best && <text x={outX} y={cy + 44} fill="#22c55e" fontSize={9} textAnchor="middle">best: {best.model.split(":")[0]}</text>}
        </svg>
        {hover && <div className="ih-note" style={{ marginTop: 10 }}><b style={{ color: MODEL_COLOR[hover.model] }}>{hover.model}</b> <span className="ih-muted">({hover.tier} · {hover.length} chars · q {hover.quality ?? "—"})</span><br />{hover.text.slice(0, 320)}…</div>}
      </div>

      <div className="ih-panel">
        <h2>The 9 answers — side by side</h2><div className="pd">click any to open the full blueprint</div>
        <div className="ih-grid3">
          {TIERS.map(t => <div key={t}>
            <div style={{ color: TIER_COLOR[t], fontWeight: 700, fontSize: 12, marginBottom: 6 }}>{t} tier</div>
            {data.answers.filter(a => a.tier === t).map(a => <div key={a.id} className="ex" style={{ cursor: "pointer" }} onClick={() => onOpen(i)}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <b style={{ color: MODEL_COLOR[a.model], fontSize: 12 }}>{a.model}</b>
                <span className="ih-muted" style={{ fontSize: 11 }}>q {a.quality ?? "—"} · {a.length}c</span></div>
              <div className="ih-muted" style={{ fontSize: 11.5, lineHeight: 1.45 }}>{a.text.slice(0, 150)}…</div>
            </div>)}
          </div>)}
        </div>
      </div>
    </>
  );
}

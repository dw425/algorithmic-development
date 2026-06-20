// MUSE InsightHub — Neural Net: one prompt through all 21 models. Click a neuron → popup; SELECT it
// → every other neuron recolors green→yellow→red by similarity, best-match paths highlighted.
import { useEffect, useMemo, useState } from "react";
import { api, TIER_COLOR, MODEL_COLOR, fmt, type AnswerFull, type PromptRow } from "../api";

const TIERS = ["small", "medium", "large"] as const;
type Tier = typeof TIERS[number];
const key = (a: number, b: number) => `${Math.min(a, b)}-${Math.max(a, b)}`;
function matchColor(sim: number, lo: number, hi: number) {
  const t = Math.max(0, Math.min(1, (sim - lo) / (hi - lo + 1e-9)));        // 1=closest, 0=farthest
  const stops = [[239, 68, 68], [234, 179, 8], [34, 197, 94]];              // red → yellow → green
  const x = t * 2, i = Math.min(1, Math.floor(x)), f = x - i, a = stops[i], b = stops[i + 1];
  return `rgb(${Math.round(a[0] + (b[0] - a[0]) * f)},${Math.round(a[1] + (b[1] - a[1]) * f)},${Math.round(a[2] + (b[2] - a[2]) * f)})`;
}

export default function NeuralNet({ onOpen }: { onOpen: (i: number) => void }) {
  const [i, setI] = useState<number>(0);
  const [data, setData] = useState<{ prompt: PromptRow; answers: AnswerFull[] } | null>(null);
  const [divList, setDivList] = useState<number[]>([]);
  const [sims, setSims] = useState<Map<string, number>>(new Map());
  const [sel, setSel] = useState<number | null>(null);
  const [pop, setPop] = useState<AnswerFull | null>(null);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => { api.divergence("large", "desc", 80).then(d => { setDivList(d.prompts.map(p => p.i)); if (d.prompts[0]) setI(d.prompts[0].i); }); }, []);
  useEffect(() => { setSel(null); setPop(null); api.prompt(i).then(setData); api.promptSim(i).then(d => setSims(new Map(d.pairs.map(p => [key(p.a, p.b), p.sim])))); }, [i]);

  const L = useMemo(() => {
    if (!data) return null;
    const W = 960, H = 520, inX = 70, outX = 890, colX: Record<Tier, number> = { small: 320, medium: 540, large: 740 }, rowY = [120, 260, 400], cy = H / 2;
    const div: Record<Tier, number | null> = { small: data.prompt.sm_div, medium: data.prompt.md_div, large: data.prompt.lg_div };
    const neurons: { a: AnswerFull; x: number; y: number; t: Tier; r: number }[] = [];
    TIERS.forEach(t => data.answers.filter(a => a.tier === t).forEach((a, j) => neurons.push({ a, x: colX[t], y: rowY[j] ?? cy, t, r: 14 + Math.min(16, a.length / 440) })));
    return { W, H, inX, outX, colX, cy, div, neurons };
  }, [data]);

  if (!data || !L) return <><div className="ih-h1">Neural Net</div><div className="ih-loading">Loading…</div></>;
  const { W, H, inX, outX, colX, cy, div, neurons } = L;
  const idx = divList.indexOf(i);
  const simTo = (id: number) => (a: number) => a === id ? 1 : (sims.get(key(id, a)) ?? 0);
  const selSims = sel != null ? neurons.map(n => n.a.id).filter(id => id !== sel).map(simTo(sel)) : [];
  const lo = selSims.length ? Math.min(...selSims) : 0, hi = selSims.length ? Math.max(...selSims) : 1;
  const curve = (x0: number, y0: number, x1: number, y1: number) => `M${x0},${y0} C${(x0 + x1) / 2},${y0} ${(x0 + x1) / 2},${y1} ${x1},${y1}`;
  const neuronFill = (n: { a: AnswerFull; t: Tier }) =>
    sel == null ? (MODEL_COLOR[n.a.model] || TIER_COLOR[n.t]) : n.a.id === sel ? "#fff" : matchColor(simTo(sel)(n.a.id), lo, hi);

  return (
    <>
      <div className="ih-h1">Neural Net — one prompt across all 21 models</div>
      <div className="ih-sub">Each neuron is a model's answer (size = length). <b>Click</b> a neuron to read it; <b>select</b> it (click) to recolor every other neuron by how closely it matches — <span style={{ color: "#22c55e" }}>green = closest</span> · <span style={{ color: "#eab308" }}>yellow</span> · <span style={{ color: "#ef4444" }}>red = farthest</span> — with the best-match paths drawn.</div>

      <div className="ih-panel" style={{ position: "relative" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
          <button className="ih-chip" onClick={() => setI(divList[Math.max(0, idx - 1)] ?? i)}>‹ prev</button>
          <button className="ih-chip" onClick={() => setI(divList[Math.min(divList.length - 1, idx + 1)] ?? i)}>next ›</button>
          <span className="ih-muted" style={{ fontSize: 11 }}>most-divergent {idx + 1}/{divList.length}</span>
          <span className="ih-pill" style={{ background: "var(--accentbg)", color: "var(--accent)" }}>#{i} · {data.prompt.category}</span>
          <span className="ih-muted" style={{ fontSize: 12, flex: 1 }}>{data.prompt.prompt.slice(0, 92)}</span>
          {sel != null && <button className="ih-chip on" onClick={() => setSel(null)}>clear selection ✕</button>}
        </div>

        <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxHeight: 560, background: "#141d29", borderRadius: 7, border: "1px solid var(--line)", display: "block" }}>
          {TIERS.map(t => <text key={t} x={colX[t]} y={26} fill={TIER_COLOR[t]} fontSize={12} textAnchor="middle" fontWeight={700}>{t.toUpperCase()} · div {fmt(div[t])}</text>)}
          {/* input/output edges (faded when a neuron is selected) */}
          {neurons.map((n, k) => <path key={"i" + k} d={curve(inX + 26, cy, n.x - n.r, n.y)} fill="none" stroke="rgba(136,153,170,0.18)" strokeWidth={1} opacity={sel == null ? 1 : 0.25} />)}
          {neurons.map((n, k) => <path key={"o" + k} d={curve(n.x + n.r, n.y, outX - 26, cy)} fill="none" stroke="rgba(96,165,250,0.18)" strokeWidth={1} opacity={sel == null ? 1 : 0.25} />)}
          {/* intra-tier agreement edges (only when nothing selected) */}
          {sel == null && TIERS.map(t => { const ns = neurons.filter(n => n.t === t); const sim = 1 - (div[t] ?? 0.2);
            return ns.map((a, p) => ns.slice(p + 1).map((b, q) => <line key={`${t}-${p}-${q}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={TIER_COLOR[t]} strokeOpacity={0.16 + sim * 0.5} strokeWidth={0.5 + sim * 3} />)); })}
          {/* match paths from the selected neuron to all others */}
          {sel != null && neurons.filter(n => n.a.id !== sel).map((n, k) => { const s = neurons.find(x => x.a.id === sel)!; const sm = simTo(sel)(n.a.id);
            return <line key={"m" + k} x1={s.x} y1={s.y} x2={n.x} y2={n.y} stroke={matchColor(sm, lo, hi)} strokeOpacity={0.35 + (sm - lo) / (hi - lo + 1e-9) * 0.5} strokeWidth={0.6 + ((sm - lo) / (hi - lo + 1e-9)) * 4} />; })}
          {/* input + output nodes */}
          <g><circle cx={inX} cy={cy} r={26} fill="#243044" stroke="var(--accent)" strokeWidth={2} /><text x={inX} y={cy - 2} fill="#fff" fontSize={10} textAnchor="middle" fontWeight={700}>PROMPT</text><text x={inX} y={cy + 11} fill="var(--dim)" fontSize={8} textAnchor="middle">{data.prompt.category.slice(0, 9)}</text></g>
          <g><circle cx={outX} cy={cy} r={28} fill="#243044" stroke="#22c55e" strokeWidth={2} /><text x={outX} y={cy - 4} fill="#fff" fontSize={9} textAnchor="middle" fontWeight={700}>SYNTH</text><text x={outX} y={cy + 8} fill="var(--dim)" fontSize={8} textAnchor="middle">q {fmt(data.prompt.avg_quality, 1)}</text></g>
          {/* neurons */}
          {neurons.map((n, k) => <g key={k} style={{ cursor: "pointer" }} onMouseEnter={() => setHover(n.a.id)} onMouseLeave={() => setHover(null)}
            onClick={() => { setPop(n.a); setSel(n.a.id); }}>
            <circle cx={n.x} cy={n.y} r={n.r} fill={neuronFill(n)} fillOpacity={n.a.id === sel ? 1 : 0.9}
              stroke={n.a.id === sel ? "#fff" : hover === n.a.id ? "#fff" : "var(--line2)"} strokeWidth={n.a.id === sel ? 3 : hover === n.a.id ? 2 : 1} />
            <text x={n.x} y={n.y - n.r - 5} fill="var(--ink)" fontSize={9} textAnchor="middle">{n.a.model.split(":")[0].slice(0, 12)}</text>
            <text x={n.x} y={n.y + 3} fill={sel != null && n.a.id !== sel ? "#06121f" : "#06121f"} fontSize={9} textAnchor="middle" fontWeight={700}>
              {sel != null && n.a.id !== sel ? simTo(sel)(n.a.id).toFixed(2) : (n.a.quality ?? "·")}</text>
          </g>)}
        </svg>

        {pop && <div style={{ position: "absolute", right: 24, top: 60, width: 360, background: "#0f1722", border: "1px solid var(--line2)", borderRadius: 8, padding: 13, boxShadow: "0 10px 30px #0009", zIndex: 5 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <b style={{ color: MODEL_COLOR[pop.model] }}>{pop.model}</b>
            <span style={{ cursor: "pointer", color: "var(--dim)" }} onClick={() => setPop(null)}>✕</span></div>
          <div className="ih-muted" style={{ fontSize: 11, marginBottom: 7 }}>{pop.tier} tier · {pop.length} chars · judged quality {pop.quality ?? "—"}</div>
          <div style={{ fontSize: 12, color: "#cdd6e6", maxHeight: 220, overflow: "auto", lineHeight: 1.5 }}>{pop.text.slice(0, 700)}{pop.text.length > 700 ? "…" : ""}</div>
          <button className="ih-chip" style={{ marginTop: 9 }} onClick={() => onOpen(i)}>open full blueprint →</button>
        </div>}
      </div>

      {sel != null && (() => { const others = neurons.filter(n => n.a.id !== sel).map(n => ({ n, s: simTo(sel)(n.a.id) })).sort((a, b) => b.s - a.s);
        const selN = neurons.find(n => n.a.id === sel)!;
        return <div className="ih-panel"><h2>Closest matches to <span style={{ color: MODEL_COLOR[selN.a.model] }}>{selN.a.model}</span></h2>
          <div className="pd">ranked by answer-embedding similarity</div>
          <table className="ih-table click"><thead><tr><th>Rank</th><th>Model</th><th>Tier</th><th>Similarity</th><th>Quality</th></tr></thead>
            <tbody>{others.map((o, r) => <tr key={o.n.a.id} onClick={() => { setPop(o.n.a); }}>
              <td>{r + 1}</td><td style={{ color: MODEL_COLOR[o.n.a.model] }}>{o.n.a.model}</td><td>{o.n.t}</td>
              <td><span style={{ color: matchColor(o.s, lo, hi), fontWeight: 700 }}>{o.s.toFixed(3)}</span></td><td>{o.n.a.quality ?? "—"}</td></tr>)}</tbody></table>
        </div>; })()}
    </>
  );
}

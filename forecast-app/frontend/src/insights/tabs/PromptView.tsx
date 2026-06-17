// MUSE InsightHub — Prompt: a full-page deep view of one prompt across all 9 models,
// with prompt-by-prompt drill navigation (prev/next/jump) through the ordered prompt list.
import { useEffect, useMemo, useState } from "react";
import { api, TIER_COLOR, MODEL_COLOR, fmt, type AnswerFull, type PromptRow } from "../api";
import { HBars, Bars } from "../charts";

const TIERS = ["small", "medium", "large"] as const;
type Tier = typeof TIERS[number];

export default function PromptView({ onOpen }: { onOpen: (i: number) => void }) {
  const [i, setI] = useState<number>(0);
  const [list, setList] = useState<PromptRow[]>([]);
  const [data, setData] = useState<{ prompt: PromptRow; answers: AnswerFull[] } | null>(null);
  const [jump, setJump] = useState<string>("");

  useEffect(() => { api.prompts("", "i", "asc").then(d => { setList(d.prompts); if (d.prompts[0]) setI(d.prompts[0].i); }); }, []);
  useEffect(() => { setData(null); api.prompt(i).then(setData); }, [i]);

  const pos = useMemo(() => list.findIndex(p => p.i === i), [list, i]);

  const byTier = useMemo(() => {
    const m: Record<Tier, AnswerFull[]> = { small: [], medium: [], large: [] };
    if (data) data.answers.forEach(a => { if (a.tier in m) m[a.tier as Tier].push(a); });
    return m;
  }, [data]);

  const go = (delta: number) => {
    if (!list.length) return;
    const next = list[Math.max(0, Math.min(list.length - 1, pos + delta))];
    if (next) setI(next.i);
  };
  const doJump = () => {
    const n = parseInt(jump, 10);
    if (Number.isFinite(n) && list.some(p => p.i === n)) setI(n);
    setJump("");
  };

  if (!data) return <><div className="ih-h1">Prompt</div><div className="ih-loading">Loading…</div></>;
  const p = data.prompt;

  return (
    <>
      <div className="ih-h1">Prompt — one prompt, all 9 answers in full</div>
      <div className="ih-sub">The deep view: drill prompt-by-prompt through the corpus and read every model's complete answer side by side, with judged quality and length.</div>

      <div className="ih-panel">
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <button className="ih-chip" onClick={() => go(-1)} disabled={pos <= 0}>‹ prev</button>
          <button className="ih-chip" onClick={() => go(1)} disabled={pos >= list.length - 1}>next ›</button>
          <span className="ih-muted" style={{ fontSize: 12 }}>prompt {pos < 0 ? "?" : pos + 1} of {list.length || "…"}</span>
          <span className="ih-pill" style={{ background: "var(--accentbg)", color: "var(--accent)" }}>#{p.i}</span>
          <span style={{ flex: 1 }} />
          <input className="ih-input" type="number" placeholder="jump to #" value={jump}
            onChange={e => setJump(e.target.value)} onKeyDown={e => { if (e.key === "Enter") doJump(); }}
            style={{ width: 110, padding: "5px 9px", background: "#0f1722", color: "var(--ink)", border: "1px solid var(--line2)", borderRadius: 6, fontSize: 12 }} />
          <button className="ih-chip" onClick={doJump}>go</button>
          <button className="ih-chip" onClick={() => onOpen(i)}>open blueprint →</button>
        </div>
      </div>

      <div className="ih-cards">
        <div className="ih-card"><div className="v">{p.category}</div><div className="l">category</div></div>
        <div className="ih-card"><div className="v" style={{ color: TIER_COLOR.small }}>{fmt(p.sm_div)}</div><div className="l">small-tier divergence</div></div>
        <div className="ih-card"><div className="v" style={{ color: TIER_COLOR.medium }}>{fmt(p.md_div)}</div><div className="l">medium-tier divergence</div></div>
        <div className="ih-card"><div className="v" style={{ color: TIER_COLOR.large }}>{fmt(p.lg_div)}</div><div className="l">large-tier divergence</div></div>
        <div className="ih-card"><div className="v">{fmt(p.avg_quality, 2)}</div><div className="l">avg judged quality</div><div className="d ih-muted">{p.n_judged} judged</div></div>
      </div>

      <div className="ih-panel">
        <h2>Prompt text</h2>
        <div style={{ fontSize: 14, color: "#cdd6e6", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{p.prompt}</div>
      </div>

      <div className="ih-grid3">
        {TIERS.map(t => (
          <div key={t} className="ih-panel">
            <h2 style={{ color: TIER_COLOR[t] }}>{t} tier</h2>
            <div className="pd">{byTier[t].length} answers</div>
            {byTier[t].map(a => (
              <div key={a.id} style={{ marginBottom: 12, border: "1px solid var(--line)", borderRadius: 7, padding: 10, background: "#0f1722" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                  <span className="ih-pill" style={{ background: "#1a2433", color: MODEL_COLOR[a.model] || TIER_COLOR[t] }}>{a.model}</span>
                  <span className="ih-muted" style={{ fontSize: 11 }}>{a.tier} · {a.length} chars · q {a.quality ?? "—"}</span>
                </div>
                <pre style={{ margin: 0, fontSize: 12, color: "#cdd6e6", lineHeight: 1.5, maxHeight: 280, overflow: "auto", whiteSpace: "pre-wrap", wordBreak: "break-word", fontFamily: "inherit" }}>{a.text}</pre>
              </div>
            ))}
            {byTier[t].length === 0 && <div className="ih-muted" style={{ fontSize: 12 }}>no answers</div>}
          </div>
        ))}
      </div>

      <div className="ih-grid2">
        <div className="ih-panel">
          <h2>Judged quality per model</h2><div className="pd">independent judge, 1–5</div>
          <HBars max={5} fmt={v => v.toFixed(2)} data={data.answers.map(a => ({ label: a.model, value: a.quality ?? 0, color: TIER_COLOR[a.tier as Tier] }))} />
        </div>
        <div className="ih-panel">
          <h2>Answer length per model</h2><div className="pd">characters</div>
          <Bars height={220} fmt={v => v.toFixed(0)} data={data.answers.map(a => ({ label: a.model, value: a.length, color: TIER_COLOR[a.tier as Tier] }))} />
        </div>
      </div>
    </>
  );
}

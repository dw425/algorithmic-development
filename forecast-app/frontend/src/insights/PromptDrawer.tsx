// MUSE InsightHub — Prompt Blueprint: a prompt's 9 answers side-by-side with scores + divergence.
import { useEffect, useState } from "react";
import { api, TIER_COLOR, MODEL_COLOR, fmt, type AnswerFull, type PromptRow } from "./api";

export default function PromptDrawer({ i, onClose }: { i: number; onClose: () => void }) {
  const [data, setData] = useState<{ prompt: PromptRow; answers: AnswerFull[] } | null>(null);
  useEffect(() => { setData(null); api.prompt(i).then(setData); }, [i]);

  return (
    <>
      <div className="ih-drawer-bg" onClick={onClose} />
      <div className="ih-drawer">
        <div className="x" onClick={onClose}>×</div>
        {!data ? <div className="ih-loading">Loading prompt #{i}…</div> : <>
          <div className="ih-muted" style={{ fontSize: 12 }}>Prompt #{i} · {data.prompt.category}</div>
          <h2 style={{ margin: "4px 0 12px", fontSize: 18, lineHeight: 1.35 }}>{data.prompt.prompt}</h2>
          <div className="ih-cards" style={{ marginBottom: 16 }}>
            {([["small", data.prompt.sm_div], ["medium", data.prompt.md_div], ["large", data.prompt.lg_div]] as const).map(([t, d]) =>
              <div className="ih-card" key={t}><div className="v" style={{ color: TIER_COLOR[t] }}>{fmt(d)}</div>
                <div className="l">{t}-tier divergence</div><div className="d ih-muted">similarity {fmt(d == null ? null : 1 - d)}</div></div>)}
            <div className="ih-card"><div className="v">{fmt(data.prompt.avg_quality, 2)}</div><div className="l">avg judged quality</div>
              <div className="d ih-muted">{data.prompt.n_judged} ratings</div></div>
          </div>
          {(["small", "medium", "large"] as const).map(t => {
            const group = data.answers.filter(a => a.tier === t);
            if (!group.length) return null;
            return <div key={t}>
              <h3 style={{ margin: "16px 0 4px", color: TIER_COLOR[t] }}>{t} tier</h3>
              {group.map(a => <div className="ih-ans" key={a.id}>
                <div className="hd">
                  <span className="ih-pill" style={{ background: (MODEL_COLOR[a.model] || "#555") + "33", color: MODEL_COLOR[a.model] || "#ccc" }}>{a.model}</span>
                  <span className="ih-muted" style={{ fontSize: 12 }}>{a.length} chars</span>
                  {a.quality != null && <span className="ih-muted" style={{ fontSize: 12 }}>· judged quality <b style={{ color: "#cfe8ff" }}>{a.quality}/5</b></span>}
                </div>
                <pre>{a.text}</pre>
              </div>)}
            </div>;
          })}
        </>}
      </div>
    </>
  );
}

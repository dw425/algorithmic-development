import { useEffect, useState } from "react";
import { api, TIER_COLOR, fmt, type Overview as OV } from "../api";
import { Bars } from "../charts";

export default function Overview({ onOpen, go }: { onOpen: (i: number) => void; go: (t: string) => void }) {
  const [d, setD] = useState<OV | null>(null);
  useEffect(() => { api.overview().then(setD); }, []);
  if (!d) return <div className="ih-loading">Loading…</div>;
  const lg = d.tiers.find(t => t.tier === "large")!, sm = d.tiers.find(t => t.tier === "small")!;
  return (
    <>
      <div className="ih-h1">Overview</div>
      <div className="ih-sub">The same 1,005 prompts (stratified from a 100,000-prompt corpus) answered by three tiers of local model councils. How much they disagree, by task, and how good the answers are.</div>
      <div className="ih-cards">
        <div className="ih-card"><div className="v">{d.meta.n_prompts}</div><div className="l">prompts × 15 categories</div></div>
        <div className="ih-card"><div className="v">{Number(d.meta.n_answers).toLocaleString()}</div><div className="l">answer nodes (9 models)</div></div>
        <div className="ih-card"><div className="v" style={{ color: TIER_COLOR.large }}>{fmt(lg.divergence)}</div><div className="l">large-tier divergence (lowest)</div><div className="d ih-muted">vs small {fmt(sm.divergence)}</div></div>
        <div className="ih-card"><div className="v">{fmt(lg.quality, 2)}</div><div className="l">large-tier quality (highest)</div><div className="d ih-muted">vs small {fmt(sm.quality, 2)}</div></div>
      </div>

      <div className="ih-panel">
        <h2>Headline</h2>
        <div className="pd">Small ≈ medium on divergence, but the large tier converges more <b>and</b> scores higher quality — stronger models agree more <i>and</i> are better. Disagreement is task-dependent and replicates across tiers.</div>
      </div>

      <div className="ih-grid2">
        <div className="ih-panel">
          <h2>Divergence by tier</h2><div className="pd">mean pairwise cosine distance (0 = identical answers)</div>
          <Bars height={200} fmt={v => v.toFixed(3)} data={d.tiers.map(t => ({ label: t.tier, value: t.divergence, color: TIER_COLOR[t.tier] }))} />
        </div>
        <div className="ih-panel">
          <h2>Judged quality by tier</h2><div className="pd">independent Phi-4 judge, 1–5</div>
          <Bars height={200} fmt={v => v.toFixed(2)} data={d.tiers.map(t => ({ label: t.tier, value: t.quality || 0, color: TIER_COLOR[t.tier] }))} />
        </div>
      </div>

      <div className="ih-panel">
        <h2>Most-divergent prompts</h2><div className="pd">where the large-tier models disagree most — click to open the blueprint</div>
        <table className="ih-table click"><thead><tr><th>#</th><th>Category</th><th>Prompt</th><th>Divergence</th></tr></thead>
          <tbody>{d.top_divergent.map(p => <tr key={p.i} onClick={() => onOpen(p.i)}>
            <td>{p.i}</td><td>{p.category}</td><td>{p.prompt.slice(0, 90)}</td><td><b>{fmt(p.lg_div)}</b></td></tr>)}</tbody></table>
        <a className="ih-link" onClick={() => go("constellation")}>→ explore the full constellation</a>
      </div>
    </>
  );
}

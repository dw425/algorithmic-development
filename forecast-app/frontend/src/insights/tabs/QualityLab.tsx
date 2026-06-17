import { useEffect, useState } from "react";
import { api, TIER_COLOR, fmt, type ModelRow, type CatRow, type PromptRow } from "../api";
import { HBars, GroupedBars } from "../charts";

interface QualityData {
  model_leaderboard: ModelRow[];
  by_category: CatRow[];
  most_accurate: PromptRow[];
  least_accurate: PromptRow[];
}

const PROXY_NOTE =
  "Judged “quality” is a model-judged proxy: an independent Phi-4 judge scores each answer 1–5. " +
  "It is NOT ground truth — these open-ended prompts have no gold answers. True accuracy lives on the " +
  "verifiable-cohort path, where outputs can be checked against known-correct results.";

export default function QualityLab({ onOpen }: { onOpen: (i: number) => void }) {
  const [d, setD] = useState<QualityData | null>(null);
  useEffect(() => { api.quality().then(setD); }, []);
  if (!d) return <div className="ih-loading">Loading…</div>;

  const ranked = d.model_leaderboard.filter((m): m is ModelRow & { mean_quality: number } => m.mean_quality != null);
  const top = ranked.reduce<(ModelRow & { mean_quality: number }) | null>(
    (best, m) => (best == null || m.mean_quality > best.mean_quality ? m : best), null);
  const overallMean = ranked.length ? ranked.reduce((s, m) => s + m.mean_quality, 0) / ranked.length : null;

  return (
    <>
      <div className="ih-h1">Quality Lab</div>
      <div className="ih-sub">{PROXY_NOTE}</div>

      <div className="ih-cards">
        <div className="ih-card">
          <div className="v" style={{ color: top ? TIER_COLOR[top.tier] : undefined }}>{top ? fmt(top.mean_quality, 2) : "—"}</div>
          <div className="l">top model{top ? `: ${top.name}` : ""}</div>
          {top && <div className="d ih-muted">{top.tier} tier · judged 1–5</div>}
        </div>
        <div className="ih-card">
          <div className="v">{fmt(overallMean, 2)}</div>
          <div className="l">overall mean quality</div>
          <div className="d ih-muted">across {ranked.length} judged models</div>
        </div>
        <div className="ih-card">
          <div className="v">150</div>
          <div className="l">stratified prompts judged</div>
          <div className="d ih-muted">model-judged proxy, not gold</div>
        </div>
      </div>

      <div className="ih-panel">
        <h2>Quality leaderboard</h2>
        <div className="pd">mean judged quality per model (independent Phi-4 judge, 1–5)</div>
        <HBars max={5} fmt={v => v.toFixed(2)}
          data={ranked.map(m => ({ label: `${m.name} (${m.tier})`, value: m.mean_quality, color: TIER_COLOR[m.tier] }))} />
      </div>

      <div className="ih-panel">
        <h2>Quality by category × tier</h2>
        <div className="pd">mean judged quality, per category, split by council tier</div>
        <GroupedBars
          groups={d.by_category.map(c => c.name)}
          fmt={v => v.toFixed(2)}
          series={[
            { name: "small", color: TIER_COLOR.small, values: d.by_category.map(c => c.sm_qual) },
            { name: "medium", color: TIER_COLOR.medium, values: d.by_category.map(c => c.md_qual) },
            { name: "large", color: TIER_COLOR.large, values: d.by_category.map(c => c.lg_qual) },
          ]} />
      </div>

      <div className="ih-grid2">
        <div className="ih-panel">
          <h2>Highest judged quality</h2>
          <div className="pd">click a prompt to open its blueprint</div>
          <table className="ih-table click"><thead><tr><th>#</th><th>Category</th><th>Avg quality</th><th>Prompt</th></tr></thead>
            <tbody>{d.most_accurate.map(p => <tr key={p.i} onClick={() => onOpen(p.i)}>
              <td>{p.i}</td><td>{p.category}</td><td><b>{fmt(p.avg_quality, 2)}</b></td><td>{p.prompt.slice(0, 64)}</td></tr>)}</tbody></table>
        </div>
        <div className="ih-panel">
          <h2>Lowest judged quality</h2>
          <div className="pd">click a prompt to open its blueprint</div>
          <table className="ih-table click"><thead><tr><th>#</th><th>Category</th><th>Avg quality</th><th>Prompt</th></tr></thead>
            <tbody>{d.least_accurate.map(p => <tr key={p.i} onClick={() => onOpen(p.i)}>
              <td>{p.i}</td><td>{p.category}</td><td><b>{fmt(p.avg_quality, 2)}</b></td><td>{p.prompt.slice(0, 64)}</td></tr>)}</tbody></table>
        </div>
      </div>

      <div className="ih-panel">
        <h2>How to read this</h2>
        <div className="pd">{PROXY_NOTE}</div>
      </div>
    </>
  );
}

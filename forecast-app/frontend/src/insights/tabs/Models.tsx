import { useEffect, useState } from "react";
import { api, MODEL_COLOR, TIER_COLOR, fmt } from "../api";
import type { ModelRow, PairRow } from "../api";
import { HBars, Heatmap } from "../charts";

export default function Models() {
  const [d, setD] = useState<{ models: ModelRow[]; pairs: PairRow[] } | null>(null);
  useEffect(() => { api.models().then(setD); }, []);
  if (!d) return <div className="ih-loading">Loading…</div>;

  const label = (m: ModelRow) => `${m.name} (${m.tier})`;

  const withQuality = d.models.filter((m): m is ModelRow & { mean_quality: number } => m.mean_quality != null);
  const withLen = d.models.filter((m): m is ModelRow & { mean_len: number } => m.mean_len != null);

  const topQuality = withQuality.length
    ? withQuality.reduce((a, b) => (b.mean_quality > a.mean_quality ? b : a))
    : null;
  const longest = withLen.length
    ? withLen.reduce((a, b) => (b.mean_len > a.mean_len ? b : a))
    : null;

  const qualityBars = withQuality
    .slice()
    .sort((a, b) => b.mean_quality - a.mean_quality)
    .map(m => ({ label: label(m), value: m.mean_quality, color: TIER_COLOR[m.tier] }));

  const lenBars = withLen
    .slice()
    .sort((a, b) => b.mean_len - a.mean_len)
    .map(m => ({ label: label(m), value: m.mean_len, color: TIER_COLOR[m.tier] }));

  const tierOrder: Record<string, number> = { small: 0, medium: 1, large: 2 };
  const pairs = d.pairs
    .slice()
    .sort((a, b) => (tierOrder[a.tier] - tierOrder[b.tier]) || (b.similarity - a.similarity));

  // Large-tier 3×3 similarity matrix (diagonal forced to 1.0).
  const largeNames = Array.from(new Set(d.models.filter(m => m.tier === "large").map(m => m.name)));
  const largePairs = d.pairs.filter(p => p.tier === "large");
  const simOf = (a: string, b: string) => {
    if (a === b) return 1.0;
    const p = largePairs.find(q => (q.a === a && q.b === b) || (q.a === b && q.b === a));
    return p ? p.similarity : 0;
  };
  const matrix = largeNames.map(a => largeNames.map(b => simOf(a, b)));
  const showHeatmap = largeNames.length >= 2;

  return (
    <>
      <div className="ih-h1">Models</div>
      <div className="ih-sub">Nine local models across three tiers — which write longer, which are judged better, and which agree with each other.</div>

      <div className="ih-cards">
        <div className="ih-card"><div className="v">{d.models.length}</div><div className="l">models (3 per tier)</div></div>
        <div className="ih-card">
          <div className="v" style={{ color: topQuality ? TIER_COLOR[topQuality.tier] : undefined }}>{topQuality ? fmt(topQuality.mean_quality, 2) : "—"}</div>
          <div className="l">top-quality model</div>
          <div className="d ih-muted">{topQuality ? label(topQuality) : "—"}</div>
        </div>
        <div className="ih-card">
          <div className="v" style={{ color: longest ? TIER_COLOR[longest.tier] : undefined }}>{longest ? Math.round(longest.mean_len).toLocaleString() : "—"}</div>
          <div className="l">longest-answering model</div>
          <div className="d ih-muted">{longest ? label(longest) : "—"}</div>
        </div>
      </div>

      <div className="ih-grid2">
        <div className="ih-panel">
          <h2>Quality leaderboard</h2><div className="pd">judged mean quality (1–5), highest first</div>
          <HBars data={qualityBars} fmt={v => v.toFixed(2)} max={5} />
        </div>
        <div className="ih-panel">
          <h2>Answer length by model</h2><div className="pd">mean answer length, longest first</div>
          <HBars data={lenBars} fmt={v => Math.round(v).toString()} />
        </div>
      </div>

      <div className="ih-panel">
        <h2>Model agreement (pairwise similarity)</h2>
        <div className="pd">how alike two models' answers are within a tier — higher = more agreement</div>
        <table className="ih-table">
          <thead><tr><th>Tier</th><th>Pair</th><th>Divergence</th><th>Similarity</th></tr></thead>
          <tbody>{pairs.map((p, i) => (
            <tr key={i}>
              <td><span style={{ color: TIER_COLOR[p.tier] }}>{p.tier}</span></td>
              <td>{p.a} – {p.b}</td>
              <td>{fmt(p.divergence)}</td>
              <td><b>{fmt(p.similarity)}</b></td>
            </tr>
          ))}</tbody>
        </table>
        {showHeatmap && (
          <>
            <div className="pd" style={{ marginTop: 16 }}>Large-tier similarity matrix (diagonal = 1.0)</div>
            <Heatmap labels={largeNames} matrix={matrix} fmt={v => v.toFixed(3)} />
          </>
        )}
      </div>

      <div className="ih-panel">
        <h2>All models</h2><div className="pd">per-model judged quality, answer length, and answer count</div>
        <table className="ih-table">
          <thead><tr><th>Model</th><th>Tier</th><th>Judged quality</th><th>Mean length</th><th>N</th></tr></thead>
          <tbody>{d.models.map((m, i) => (
            <tr key={i}>
              <td><span style={{ color: MODEL_COLOR[m.name] }}>{m.name}</span></td>
              <td><span style={{ color: TIER_COLOR[m.tier] }}>{m.tier}</span></td>
              <td>{fmt(m.mean_quality, 2)}</td>
              <td>{m.mean_len == null ? "—" : Math.round(m.mean_len).toLocaleString()}</td>
              <td>{m.n}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </>
  );
}

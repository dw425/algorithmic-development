import { useEffect, useState } from "react";
import { api, TIER_COLOR, fmt, type TierRow, type PairRow, type Tier } from "../api";
import { Bars, Heatmap, Line2Axis } from "../charts";

const TIER_ORDER: Tier[] = ["small", "medium", "large"];

// Build a 3×3 similarity matrix for one tier from its pairs.
function tierMatrix(pairs: PairRow[]): { labels: string[]; matrix: number[][] } {
  const labels: string[] = [];
  for (const p of pairs) {
    if (!labels.includes(p.a)) labels.push(p.a);
    if (!labels.includes(p.b)) labels.push(p.b);
  }
  const idx = (m: string) => labels.indexOf(m);
  const matrix: number[][] = labels.map((_, i) => labels.map((__, j) => (i === j ? 1.0 : 0)));
  for (const p of pairs) {
    const i = idx(p.a), j = idx(p.b);
    if (i < 0 || j < 0) continue;
    matrix[i][j] = p.similarity;
    matrix[j][i] = p.similarity;
  }
  return { labels, matrix };
}

export default function Tiers() {
  const [d, setD] = useState<{ tiers: TierRow[]; pairs: PairRow[] } | null>(null);
  useEffect(() => { api.tiers().then(setD); }, []);
  if (!d) return <div className="ih-loading">Loading…</div>;

  const tierRow = (t: Tier): TierRow | undefined => d.tiers.find(r => r.tier === t);
  const ordered: TierRow[] = TIER_ORDER.map(tierRow).filter((r): r is TierRow => r != null);

  const sortedPairs: PairRow[] = [...d.pairs].sort((x, y) => y.similarity - x.similarity);

  return (
    <>
      <div className="ih-h1">Tiers</div>
      <div className="ih-sub">Three councils of growing capability — a <b>small</b> council of compact models, a <b>medium</b> council of mid-size models, and a <b>large</b> council of the strongest local models. Each tier answers the same prompts; we compare how much its models diverge and how good their answers are.</div>

      <div className="ih-cards">
        {ordered.map(t => (
          <div className="ih-card" key={t.tier}>
            <div className="v" style={{ color: TIER_COLOR[t.tier] }}>{fmt(t.divergence)}</div>
            <div className="l">{t.tier} divergence</div>
            <div className="d ih-muted">similarity {fmt(t.similarity)} · quality {fmt(t.quality, 2)}</div>
          </div>
        ))}
      </div>

      <div className="ih-panel">
        <h2>Divergence vs quality across tiers</h2>
        <div className="pd">As councils get stronger, models converge (divergence falls) while judged quality rises.</div>
        <Line2Axis
          labels={TIER_ORDER}
          a={{ name: "divergence", color: "#22d3a8", values: ordered.map(t => t.divergence) }}
          b={{ name: "quality", color: "#dc3c50", values: ordered.map(t => t.quality ?? 0) }}
        />
      </div>

      <div className="ih-grid2">
        <div className="ih-panel">
          <h2>Divergence by tier</h2>
          <div className="pd">mean pairwise cosine distance (0 = identical answers)</div>
          <Bars height={200} fmt={v => v.toFixed(3)} data={ordered.map(t => ({ label: t.tier, value: t.divergence, color: TIER_COLOR[t.tier] }))} />
        </div>
        <div className="ih-panel">
          <h2>Judged quality by tier</h2>
          <div className="pd">independent judge, 1–5 (higher is better)</div>
          <Bars height={200} fmt={v => v.toFixed(2)} data={ordered.map(t => ({ label: t.tier, value: t.quality ?? 0, color: TIER_COLOR[t.tier] }))} />
        </div>
      </div>

      <div className="ih-panel">
        <h2>Model-to-model similarity</h2>
        <div className="pd">how similar each pair of models' answers are within a tier (1.0 = identical)</div>
        <div className="ih-grid3" style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
          {TIER_ORDER.map(t => {
            const tierPairs = d.pairs.filter(p => p.tier === t);
            const { labels, matrix } = tierMatrix(tierPairs);
            return (
              <div key={t}>
                <div className="ih-muted" style={{ marginBottom: 6, color: TIER_COLOR[t], fontWeight: 600 }}>{t}</div>
                <Heatmap labels={labels} matrix={matrix} fmt={v => v.toFixed(2)} />
              </div>
            );
          })}
        </div>
      </div>

      <div className="ih-panel">
        <h2>All model pairs</h2>
        <div className="pd">every model pair across all tiers, sorted by similarity</div>
        <table className="ih-table">
          <thead><tr><th>Tier</th><th>Model A</th><th>Model B</th><th>Divergence</th><th>Similarity</th></tr></thead>
          <tbody>
            {sortedPairs.map((p, i) => (
              <tr key={`${p.tier}-${p.a}-${p.b}-${i}`}>
                <td style={{ color: TIER_COLOR[p.tier] }}>{p.tier}</td>
                <td>{p.a}</td>
                <td>{p.b}</td>
                <td>{fmt(p.divergence)}</td>
                <td><b>{fmt(p.similarity)}</b></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

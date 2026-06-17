import { useEffect, useState } from "react";
import { api, TIER_COLOR, fmt, heat, type Tier } from "../api";

interface DivRow { i: number; category: string; prompt: string; div: number }

const TIERS: Tier[] = ["small", "medium", "large"];

export default function DivergenceLab({ onOpen }: { onOpen: (i: number) => void }) {
  const [tier, setTier] = useState<Tier>("large");
  const [most, setMost] = useState<DivRow[]>([]);
  const [least, setLeast] = useState<DivRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let live = true;
    setLoading(true);
    Promise.all([api.divergence(tier, "desc"), api.divergence(tier, "asc")]).then(([d, a]) => {
      if (!live) return;
      setMost(d.prompts); setLeast(a.prompts); setLoading(false);
    });
    return () => { live = false; };
  }, [tier]);

  return (
    <>
      <div className="ih-h1">Divergence Lab</div>
      <div className="ih-sub">Where models disagree most vs. converge — the structure of disagreement.</div>

      <div className="ih-panel">
        <div className="ih-seg" style={{ maxWidth: 360 }}>
          {TIERS.map(t => (
            <button key={t} className={tier === t ? "on" : ""} onClick={() => setTier(t)}
              style={{ color: tier === t ? "#fff" : TIER_COLOR[t] }}>
              {t}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="ih-panel ih-muted">Loading divergence for {tier} tier…</div>
      ) : (
        <div className="ih-grid2">
          <div className="ih-panel">
            <h2>Most divergent</h2>
            <div className="pd">Prompts where the {tier}-tier council fractures — highest cross-model divergence.</div>
            <table className="ih-table click">
              <thead><tr><th>#</th><th>Category</th><th>Prompt</th><th>Divergence</th></tr></thead>
              <tbody>{most.map(r => (
                <tr key={r.i} onClick={() => onOpen(r.i)}>
                  <td>{r.i}</td><td>{r.category}</td><td>{r.prompt.slice(0, 80)}</td>
                  <td style={{ fontWeight: 700, color: heat(r.div) }}>{fmt(r.div)}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>

          <div className="ih-panel">
            <h2>Most similar / convergent</h2>
            <div className="pd">Prompts where the {tier}-tier council agrees — lowest divergence, highest similarity.</div>
            <table className="ih-table click">
              <thead><tr><th>#</th><th>Category</th><th>Prompt</th><th>Divergence</th><th>Similarity</th></tr></thead>
              <tbody>{least.map(r => (
                <tr key={r.i} onClick={() => onOpen(r.i)}>
                  <td>{r.i}</td><td>{r.category}</td><td>{r.prompt.slice(0, 80)}</td>
                  <td style={{ fontWeight: 700, color: heat(r.div) }}>{fmt(r.div)}</td>
                  <td style={{ color: heat(1 - r.div) }}>{fmt(1 - r.div)}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </div>
      )}

      <div className="ih-panel">
        <h2>What this means</h2>
        <div className="ih-muted" style={{ fontSize: 13, lineHeight: 1.6 }}>
          High-divergence prompts are ambiguous and open-ended — communication, creative, and
          opinion tasks where there is no single correct answer, so each model resolves the gap
          differently. Low-divergence prompts are well-scoped and factual — definitions, lookups,
          and constrained problems that pull every model toward the same response. This pattern
          holds across the small, medium, and large tiers: scaling the council changes the
          magnitude of disagreement, not its shape.
        </div>
      </div>
    </>
  );
}

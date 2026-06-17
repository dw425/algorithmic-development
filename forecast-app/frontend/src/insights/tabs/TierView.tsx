import { useEffect, useState } from "react";
import { api, TIER_COLOR, MODEL_COLOR, fmt, type TierRow, type PairRow, type ModelRow, type CatRow, type SearchHit } from "../api";
import { Heatmap, HBars, Bars } from "../charts";

type Tier = "small" | "medium" | "large";
const TIER_ORDER: Tier[] = ["small", "medium", "large"];

// Per-tier divergence column on a category row.
function catDiv(c: CatRow, t: Tier): number {
  return t === "small" ? c.sm_div : t === "medium" ? c.md_div : c.lg_div;
}

// Build a 3×3 similarity matrix for one tier from its pairs (diagonal = 1.0).
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

export default function TierView({ onOpen }: { onOpen: (i: number) => void }) {
  const [tier, setTier] = useState<Tier>("large");
  const [d, setD] = useState<{ tiers: TierRow[]; pairs: PairRow[] } | null>(null);
  const [models, setModels] = useState<ModelRow[] | null>(null);
  const [cats, setCats] = useState<CatRow[] | null>(null);
  const [hits, setHits] = useState<SearchHit[] | null>(null);

  useEffect(() => { api.tiers().then(setD); }, []);
  useEffect(() => { api.models().then(r => setModels(r.models)); }, []);
  useEffect(() => { api.categories().then(r => setCats(r.categories)); }, []);
  useEffect(() => {
    let live = true;
    setHits(null);
    api.search({ tier, size: 25 }).then(r => { if (live) setHits(r.results); });
    return () => { live = false; };
  }, [tier]);

  if (!d) return <div className="ih-loading">Loading…</div>;

  const row: TierRow | undefined = d.tiers.find(r => r.tier === tier);
  const tierPairs: PairRow[] = d.pairs.filter(p => p.tier === tier);
  const { labels, matrix } = tierMatrix(tierPairs);
  const color = TIER_COLOR[tier];

  const tierModels: ModelRow[] = (models ?? []).filter(m => m.tier === tier);

  const catBars = (cats ?? [])
    .map(c => ({ label: c.name, value: catDiv(c, tier), color }))
    .sort((a, b) => b.value - a.value);

  return (
    <>
      <div className="ih-h1">Tier</div>
      <div className="ih-sub">A single council in focus — its three models, how much they agree, how good their answers are, and where they diverge by task. Pick a tier to compare its <b>small</b>, <b>medium</b>, or <b>large</b> council.</div>

      <div className="ih-seg" style={{ display: "flex", gap: 8, margin: "4px 0 14px" }}>
        {TIER_ORDER.map(t => (
          <button
            key={t}
            onClick={() => setTier(t)}
            style={{
              padding: "6px 16px", borderRadius: 7, cursor: "pointer", fontWeight: 600,
              textTransform: "capitalize", fontSize: 13,
              border: `1px solid ${t === tier ? TIER_COLOR[t] : "#2a3648"}`,
              background: t === tier ? TIER_COLOR[t] : "#151d2b",
              color: t === tier ? "#06241c" : "#cfe0ff",
            }}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="ih-cards">
        <div className="ih-card"><div className="v" style={{ color }}>{fmt(row?.divergence)}</div><div className="l">{tier} divergence</div></div>
        <div className="ih-card"><div className="v">{fmt(row?.similarity)}</div><div className="l">mean similarity</div></div>
        <div className="ih-card"><div className="v">{fmt(row?.quality, 2)}</div><div className="l">judged quality (1–5)</div></div>
        <div className="ih-card"><div className="v" style={{ fontSize: 14, lineHeight: 1.5 }}>{row?.models ?? "—"}</div><div className="l">the 3 models</div></div>
      </div>

      <div className="ih-grid2">
        <div className="ih-panel">
          <h2>Model-to-model similarity</h2>
          <div className="pd">how similar each pair of this tier's models' answers are (1.0 = identical)</div>
          {labels.length ? <Heatmap labels={labels} matrix={matrix} fmt={v => v.toFixed(2)} /> : <div className="ih-muted">no pairs</div>}
        </div>
        <div className="ih-panel">
          <h2>Per-model quality &amp; length</h2>
          <div className="pd">judged quality (1–5) and mean answer length (chars) for each model</div>
          {tierModels.length ? (
            <>
              <div className="ih-muted" style={{ margin: "2px 0 4px", fontWeight: 600, color }}>quality</div>
              <HBars data={tierModels.map(m => ({ label: m.name, value: m.mean_quality ?? 0, color: MODEL_COLOR[m.name] ?? color }))} max={5} fmt={v => v.toFixed(2)} />
              <div className="ih-muted" style={{ margin: "12px 0 4px", fontWeight: 600, color }}>mean length</div>
              <HBars data={tierModels.map(m => ({ label: m.name, value: m.mean_len ?? 0, color: MODEL_COLOR[m.name] ?? color }))} fmt={v => v.toFixed(0)} />
            </>
          ) : <div className="ih-muted">{models ? "no models" : "Loading…"}</div>}
        </div>
      </div>

      <div className="ih-panel">
        <h2>Divergence by category — {tier} tier</h2>
        <div className="pd">where this council's models disagree most, by task (mean pairwise cosine distance)</div>
        {cats ? (
          catBars.length > 12
            ? <HBars data={catBars} fmt={v => v.toFixed(3)} />
            : <Bars height={220} fmt={v => v.toFixed(3)} data={catBars} />
        ) : <div className="ih-muted">Loading…</div>}
      </div>

      <div className="ih-panel">
        <h2>Example prompts — {tier} tier</h2>
        <div className="pd">a sample of answers from this tier — click to open the blueprint</div>
        {hits == null ? <div className="ih-muted">Loading…</div> : hits.length === 0 ? <div className="ih-muted">no results</div> : (
          <table className="ih-table click">
            <thead><tr><th>Category</th><th>Prompt</th><th>Quality</th></tr></thead>
            <tbody>
              {hits.map((h, i) => (
                <tr key={`${h.id}-${i}`} onClick={() => onOpen(h.prompt_i)}>
                  <td>{h.category}</td>
                  <td>{h.prompt.slice(0, 100)}</td>
                  <td><b>{fmt(h.quality, 2)}</b></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

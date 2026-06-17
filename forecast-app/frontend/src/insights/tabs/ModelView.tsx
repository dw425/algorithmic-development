import { useEffect, useState } from "react";
import { api, TIER_COLOR, MODEL_COLOR, fmt, type ModelRow, type CatRow, type SearchHit } from "../api";
import { HBars, Bars, Histogram } from "../charts";

const SIZE = 60;

export default function ModelView({ onOpen }: { onOpen: (i: number) => void }) {
  const [models, setModels] = useState<ModelRow[] | null>(null);
  const [cats, setCats] = useState<CatRow[]>([]);
  // Identity is (tier, name) — a model name can appear in two tiers.
  const [sel, setSel] = useState<{ name: string; tier: ModelRow["tier"] } | null>(null);
  const [page, setPage] = useState(0);
  const [results, setResults] = useState<SearchHit[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.models().then(d => {
      setModels(d.models);
      // Default to the highest-quality model.
      const withQ = d.models.filter((m): m is ModelRow & { mean_quality: number } => m.mean_quality != null);
      const top = withQ.length ? withQ.reduce((a, b) => (b.mean_quality > a.mean_quality ? b : a)) : d.models[0];
      if (top) setSel({ name: top.name, tier: top.tier });
    }).catch(() => setModels([]));
    api.categories().then(d => setCats(d.categories)).catch(() => setCats([]));
  }, []);

  // Reset to first page whenever the selected model changes.
  useEffect(() => { setPage(0); }, [sel]);

  useEffect(() => {
    if (!sel) return;
    setLoading(true);
    api.search({ model: sel.name, tier: sel.tier, size: SIZE, page }).then(d => {
      setResults(d.results ?? []);
      setTotal(d.total ?? 0);
    }).catch(() => {
      setResults([]);
      setTotal(0);
    }).finally(() => setLoading(false));
  }, [sel, page]);

  if (!models) return <div className="ih-loading">Loading…</div>;

  const label = (m: { name: string; tier: ModelRow["tier"] }) => `${m.name} (${m.tier})`;
  const cur = sel ? models.find(m => m.name === sel.name && m.tier === sel.tier) ?? null : null;

  const nPages = Math.max(1, Math.ceil(total / SIZE));
  const hasPrev = page > 0;
  const hasNext = (page + 1) * SIZE < total;
  const lengths = results.map(r => r.length);

  // This model's mean_quality vs the other 8 (highlight the selected).
  const withQuality = models.filter((m): m is ModelRow & { mean_quality: number } => m.mean_quality != null);
  const compareBars = withQuality
    .slice()
    .sort((a, b) => b.mean_quality - a.mean_quality)
    .map(m => {
      const isSel = !!cur && m.name === cur.name && m.tier === cur.tier;
      return { label: label(m), value: m.mean_quality, color: isSel ? "#22d3a8" : TIER_COLOR[m.tier] };
    });

  // Per-category answer counts within the fetched sample, ordered by the global category list.
  const catCounts = new Map<string, number>();
  results.forEach(r => catCounts.set(r.category, (catCounts.get(r.category) ?? 0) + 1));
  const catBars = cats
    .map(c => ({ label: c.name, value: catCounts.get(c.name) ?? 0, color: "#4C72B0" }))
    .filter(b => b.value > 0)
    .sort((a, b) => b.value - a.value);

  return (
    <>
      <div className="ih-h1">Model</div>
      <div className="ih-sub">A single model's profile — its behavior across all 1,005 prompts: judged quality, answer length, and the answers themselves.</div>

      <div className="ih-panel">
        <div className="pd">Pick a model — each is identified by (name, tier)</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {models.map(m => {
            const isSel = !!sel && m.name === sel.name && m.tier === sel.tier;
            return (
              <button
                key={`${m.tier}:${m.name}`}
                onClick={() => setSel({ name: m.name, tier: m.tier })}
                style={{
                  padding: "6px 12px", cursor: "pointer", fontSize: 12,
                  border: `1px solid ${isSel ? "#22d3a8" : "#2a3140"}`, borderRadius: 6,
                  background: isSel ? "#22d3a8" : "transparent",
                  color: isSel ? "#0a0e14" : (MODEL_COLOR[m.name] ?? "#cbd5e1"),
                  fontWeight: isSel ? 600 : 400,
                }}
              >{label(m)}</button>
            );
          })}
        </div>
      </div>

      <div className="ih-cards">
        <div className="ih-card">
          <div className="v" style={{ color: cur ? TIER_COLOR[cur.tier] : undefined }}>{cur ? cur.tier : "—"}</div>
          <div className="l">tier</div>
          <div className="d ih-muted">{cur ? cur.name : "—"}</div>
        </div>
        <div className="ih-card"><div className="v">{cur ? fmt(cur.mean_quality, 2) : "—"}</div><div className="l">mean judged quality (1–5)</div></div>
        <div className="ih-card"><div className="v">{cur && cur.mean_len != null ? Math.round(cur.mean_len).toLocaleString() : "—"}</div><div className="l">mean answer length</div></div>
        <div className="ih-card"><div className="v">{cur ? cur.n.toLocaleString() : "—"}</div><div className="l">answers</div></div>
      </div>

      <div className="ih-grid2">
        <div className="ih-panel">
          <h2>Answer-length distribution</h2>
          <div className="pd">lengths from a sample of {lengths.length} of this model's answers (current page)</div>
          {lengths.length
            ? <Histogram values={lengths} color={cur ? (MODEL_COLOR[cur.name] ?? "#4C72B0") : "#4C72B0"} />
            : <div className="ih-muted" style={{ fontSize: 12 }}>{loading ? "loading…" : "no answers"}</div>}
        </div>
        <div className="ih-panel">
          <h2>Quality vs other models</h2>
          <div className="pd">judged mean quality (1–5) — selected model highlighted</div>
          <Bars height={200} fmt={v => v.toFixed(2)} data={compareBars.map(b => ({ label: b.label, value: b.value, color: b.color }))} />
        </div>
      </div>

      <div className="ih-grid2">
        <div className="ih-panel">
          <h2>Quality leaderboard</h2>
          <div className="pd">where this model ranks against the other eight — selected highlighted</div>
          <HBars data={compareBars} fmt={v => v.toFixed(2)} max={5} />
        </div>
        <div className="ih-panel">
          <h2>Answers by category</h2>
          <div className="pd">categories covered in this model's current sample of {results.length}</div>
          {catBars.length
            ? <HBars data={catBars} fmt={v => v.toString()} />
            : <div className="ih-muted" style={{ fontSize: 12 }}>{loading ? "loading…" : "no answers"}</div>}
        </div>
      </div>

      <div className="ih-panel">
        <h2>This model's answers</h2>
        <div className="pd">click a row to open the prompt blueprint</div>
        <div className="ih-muted" style={{ fontSize: 12, marginBottom: 8 }}>
          {loading ? "loading…" : `${total.toLocaleString()} answers`} · page {page + 1} of {nPages}
        </div>
        <div style={{ maxHeight: "calc(100vh - 420px)", overflow: "auto" }}>
          <table className="ih-table click">
            <thead><tr><th>Category</th><th>Quality</th><th>Length</th><th>Prompt</th><th>Snippet</th></tr></thead>
            <tbody>
              {results.map(r => (
                <tr key={r.id} onClick={() => onOpen(r.prompt_i)}>
                  <td>{r.category}</td>
                  <td>{fmt(r.quality, 2)}</td>
                  <td>{r.length.toLocaleString()}</td>
                  <td>{r.prompt ? r.prompt.slice(0, 60) : "—"}</td>
                  <td className="ih-muted" style={{ fontSize: 12 }}>{r.snippet ? r.snippet.slice(0, 120) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && results.length === 0 && (
            <div className="ih-muted" style={{ padding: 12, fontSize: 12 }}>no answers</div>
          )}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 12 }}>
          <button
            disabled={!hasPrev}
            onClick={() => setPage(p => Math.max(0, p - 1))}
            style={{
              padding: "6px 14px", cursor: hasPrev ? "pointer" : "not-allowed",
              border: "1px solid #2a3140", borderRadius: 6,
              background: "transparent", color: hasPrev ? "#cbd5e1" : "#555",
            }}
          >← Prev</button>
          <span className="ih-muted" style={{ fontSize: 12 }}>page {page + 1} of {nPages}</span>
          <button
            disabled={!hasNext}
            onClick={() => setPage(p => p + 1)}
            style={{
              padding: "6px 14px", cursor: hasNext ? "pointer" : "not-allowed",
              border: "1px solid #2a3140", borderRadius: 6,
              background: "transparent", color: hasNext ? "#cbd5e1" : "#555",
            }}
          >Next →</button>
        </div>
      </div>
    </>
  );
}

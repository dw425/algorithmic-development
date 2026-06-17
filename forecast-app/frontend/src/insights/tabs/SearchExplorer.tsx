import { useEffect, useState } from "react";
import { api, fmt, TIER_COLOR, MODEL_COLOR, type SearchHit } from "../api";

type Scope = "both" | "prompt" | "answer";
type TierFilter = "all" | "small" | "medium" | "large";

export default function SearchExplorer({ onOpen }: { onOpen: (i: number) => void }) {
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<Scope>("both");
  const [tier, setTier] = useState<TierFilter>("all");
  const [category, setCategory] = useState("");
  const [minQ, setMinQ] = useState(0);
  const [page, setPage] = useState(0);
  const [results, setResults] = useState<SearchHit[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [cats, setCats] = useState<string[]>([]);
  const size = 50;

  useEffect(() => {
    api.categories().then(d => setCats(d.categories.map(c => c.name))).catch(() => setCats([]));
  }, []);

  // Reset to page 0 whenever any filter (other than page itself) changes.
  useEffect(() => { setPage(0); }, [query, scope, tier, category, minQ]);

  // Debounced fetch (300ms) — covers query typing and all filters + page.
  useEffect(() => {
    const t = setTimeout(() => {
      setLoading(true);
      api.search({
        q: query || undefined,
        scope,
        tier: tier === "all" ? undefined : tier,
        category: category || undefined,
        min_quality: minQ > 0 ? minQ : undefined,
        page,
        size,
      }).then(d => {
        setResults(d.results ?? []);
        setTotal(d.total ?? 0);
      }).catch(() => {
        setResults([]);
        setTotal(0);
      }).finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(t);
  }, [query, scope, tier, category, minQ, page]);

  const nPages = Math.max(1, Math.ceil(total / size));
  const hasPrev = page > 0;
  const hasNext = (page + 1) * size < total;

  const seg = (val: Scope, label: string) => (
    <button
      key={val}
      className={`ih-seg-btn${scope === val ? " active" : ""}`}
      onClick={() => setScope(val)}
      style={{
        padding: "6px 12px", marginRight: 4, cursor: "pointer",
        border: "1px solid #2a3140", borderRadius: 6,
        background: scope === val ? "#22d3a8" : "transparent",
        color: scope === val ? "#0a0e14" : "#cbd5e1", fontSize: 12,
      }}
    >{label}</button>
  );

  return (
    <>
      <div className="ih-h1">Search</div>
      <div className="ih-sub">Full-text search across prompts and answers, filtered and paginated.</div>

      <div className="ih-panel">
        <input
          className="ih-input"
          placeholder="search prompts and answer text…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          style={{ marginBottom: 12, maxWidth: 480 }}
        />
        <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center", marginBottom: 8 }}>
          <div>
            <span className="ih-muted" style={{ fontSize: 11, marginRight: 8 }}>scope</span>
            {seg("both", "both")}{seg("prompt", "prompt")}{seg("answer", "answer")}
          </div>
          <div>
            <span className="ih-muted" style={{ fontSize: 11, marginRight: 8 }}>tier</span>
            <select className="ih-input" value={tier} onChange={e => setTier(e.target.value as TierFilter)} style={{ width: "auto" }}>
              <option value="all">all</option>
              <option value="small">small</option>
              <option value="medium">medium</option>
              <option value="large">large</option>
            </select>
          </div>
          <div>
            <span className="ih-muted" style={{ fontSize: 11, marginRight: 8 }}>category</span>
            <select className="ih-input" value={category} onChange={e => setCategory(e.target.value)} style={{ width: "auto" }}>
              <option value="">all</option>
              {cats.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <span className="ih-muted" style={{ fontSize: 11, marginRight: 8 }}>min quality</span>
            {[0, 1, 2, 3, 4, 5].map(q => (
              <button
                key={q}
                onClick={() => setMinQ(q)}
                style={{
                  padding: "4px 9px", marginRight: 3, cursor: "pointer",
                  border: "1px solid #2a3140", borderRadius: 6, fontSize: 12,
                  background: minQ === q ? "#4C72B0" : "transparent",
                  color: minQ === q ? "#fff" : "#cbd5e1",
                }}
              >{q === 0 ? "any" : q}</button>
            ))}
          </div>
        </div>

        <div className="ih-muted" style={{ fontSize: 12, marginBottom: 8 }}>
          {loading ? "searching…" : `${total.toLocaleString()} matches`} · page {page + 1} of {nPages}
        </div>

        <div style={{ maxHeight: "calc(100vh - 360px)", overflow: "auto" }}>
          <table className="ih-table click">
            <thead>
              <tr>
                <th>Category</th><th>Model</th><th>Tier</th><th>Quality</th><th>Prompt</th><th>Snippet</th>
              </tr>
            </thead>
            <tbody>
              {results.map(r => (
                <tr key={r.id} onClick={() => onOpen(r.prompt_i)}>
                  <td>{r.category}</td>
                  <td>
                    <span style={{
                      background: MODEL_COLOR[r.model] ?? "#4C72B0", color: "#0a0e14",
                      borderRadius: 10, padding: "2px 8px", fontSize: 11, whiteSpace: "nowrap",
                    }}>{r.model}</span>
                  </td>
                  <td><span style={{ color: TIER_COLOR[r.tier] }}>{r.tier}</span></td>
                  <td>{fmt(r.quality, 2)}</td>
                  <td>{r.prompt ? r.prompt.slice(0, 60) : "—"}</td>
                  <td className="ih-muted" style={{ fontSize: 12 }}>{r.snippet ? r.snippet.slice(0, 120) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && results.length === 0 && (
            <div className="ih-muted" style={{ padding: 12, fontSize: 12 }}>no matches</div>
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

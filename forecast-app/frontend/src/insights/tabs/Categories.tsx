import { useEffect, useState } from "react";
import { api, TIER_COLOR, fmt, heat, type CatRow } from "../api";
import { GroupedBars } from "../charts";

export default function Categories(_props: { onOpen: (i: number) => void }) {
  const [rows, setRows] = useState<CatRow[] | null>(null);
  useEffect(() => { api.categories().then(d => setRows(d.categories)); }, []);
  if (!rows) return <div className="ih-loading">Loading…</div>;

  const groups = rows.map(r => r.name);
  const divSeries = [
    { name: "small", color: TIER_COLOR.small, values: rows.map(r => r.sm_div) },
    { name: "medium", color: TIER_COLOR.medium, values: rows.map(r => r.md_div) },
    { name: "large", color: TIER_COLOR.large, values: rows.map(r => r.lg_div) },
  ];
  const qualSeries = [
    { name: "small", color: TIER_COLOR.small, values: rows.map(r => r.sm_qual) },
    { name: "medium", color: TIER_COLOR.medium, values: rows.map(r => r.md_qual) },
    { name: "large", color: TIER_COLOR.large, values: rows.map(r => r.lg_qual) },
  ];

  return (
    <>
      <div className="ih-h1">Categories</div>
      <div className="ih-sub">Task category drives disagreement; the rank order replicates across tiers.</div>

      <div className="ih-panel">
        <h2>Divergence by category × tier</h2>
        <div className="pd">mean pairwise cosine distance per category, split by council tier (0 = identical answers)</div>
        <GroupedBars groups={groups} series={divSeries} height={300} fmt={v => v.toFixed(3)} />
      </div>

      <div className="ih-panel">
        <h2>Judged quality by category × tier</h2>
        <div className="pd">independent Phi-4 judge, 1–5, per category and tier</div>
        <GroupedBars groups={groups} series={qualSeries} height={300} fmt={v => v.toFixed(2)} />
      </div>

      <div className="ih-panel">
        <h2>All categories</h2>
        <div className="pd">{rows.length} categories, sorted by large-tier divergence</div>
        <table className="ih-table">
          <thead><tr>
            <th>Category</th><th>N</th>
            <th>Sm div</th><th>Md div</th><th>Lg div</th>
            <th>Sm qual</th><th>Md qual</th><th>Lg qual</th>
          </tr></thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.name}>
                <td>{r.name}</td>
                <td>{r.n}</td>
                {(["sm_div", "md_div", "lg_div"] as const).map(k => (
                  <td key={k}><span style={{ color: heat(r[k]) }}>{fmt(r[k])}</span></td>
                ))}
                {(["sm_qual", "md_qual", "lg_qual"] as const).map(k => (
                  <td key={k}>{r[k] == null ? <span className="ih-muted">—</span> : fmt(r[k], 2)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="ih-panel">
        <h2>Insight</h2>
        <div className="pd">
          The most-divergent categories (top of the list — e.g. <b>{rows[0]?.name}</b>, <b>{rows[1]?.name}</b>, <b>{rows[2]?.name}</b>)
          and the least-divergent (e.g. <b>{rows[rows.length - 1]?.name}</b>) hold the <i>same rank order across all three tiers</i>.
          Stronger councils converge more in absolute terms, but <i>which</i> tasks provoke disagreement is a property of the task, not the model size.
        </div>
      </div>
    </>
  );
}

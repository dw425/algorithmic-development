import { useEffect, useMemo, useState } from "react";
import { api, fmt, heat, type PromptRow } from "../api";

export default function PromptExplorer({ onOpen }: { onOpen: (i: number) => void }) {
  const [rows, setRows] = useState<PromptRow[]>([]);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<keyof PromptRow>("lg_div");
  const [desc, setDesc] = useState(true);
  useEffect(() => { api.prompts("", "i", "asc").then(d => setRows(d.prompts)); }, []);

  const view = useMemo(() => {
    const f = rows.filter(r => !q || r.prompt.toLowerCase().includes(q.toLowerCase()) || r.category.includes(q.toLowerCase()));
    return f.sort((a, b) => { const av = (a[sort] ?? -1) as number, bv = (b[sort] ?? -1) as number;
      return typeof av === "number" ? (desc ? bv - av : av - bv) : 0; });
  }, [rows, q, sort, desc]);

  const Th = (k: keyof PromptRow, label: string) => (
    <th style={{ cursor: "pointer" }} onClick={() => { sort === k ? setDesc(!desc) : setSort(k); }}>
      {label}{sort === k ? (desc ? " ↓" : " ↑") : ""}</th>);

  return (
    <>
      <div className="ih-h1">Prompt Explorer</div>
      <div className="ih-sub">All 1,005 prompts with their cross-tier divergence + judged quality. Search, sort, click a row to open the 9-answer blueprint.</div>
      <div className="ih-panel">
        <input className="ih-input" placeholder="search prompts or category…" value={q} onChange={e => setQ(e.target.value)} style={{ marginBottom: 12, maxWidth: 420 }} />
        <div className="ih-muted" style={{ fontSize: 12, marginBottom: 8 }}>{view.length} prompts</div>
        <div style={{ maxHeight: "calc(100vh - 290px)", overflow: "auto" }}>
          <table className="ih-table click">
            <thead><tr><th>#</th><th>Category</th><th>Prompt</th>{Th("sm_div", "Sm div")}{Th("md_div", "Md div")}{Th("lg_div", "Lg div")}{Th("avg_quality", "Quality")}</tr></thead>
            <tbody>{view.slice(0, 400).map(r => <tr key={r.i} onClick={() => onOpen(r.i)}>
              <td>{r.i}</td><td>{r.category}</td><td>{r.prompt.slice(0, 86)}</td>
              {(["sm_div", "md_div", "lg_div"] as const).map(k => <td key={k}>
                <span style={{ color: r[k] == null ? "#555" : heat((r[k] as number)) }}>{fmt(r[k])}</span></td>)}
              <td>{fmt(r.avg_quality, 2)}</td></tr>)}</tbody>
          </table>
          {view.length > 400 && <div className="ih-muted" style={{ padding: 10, fontSize: 12 }}>showing first 400 — refine your search</div>}
        </div>
      </div>
    </>
  );
}

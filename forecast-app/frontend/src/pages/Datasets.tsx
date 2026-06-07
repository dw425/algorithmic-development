import { useState, useEffect, useCallback } from "react";
import { getDatasets, loadBuiltin, loadStockDataset, getProfile, uploadDataset } from "../api";
import { useGlobal } from "../GlobalControls";
import { Card, KPI, PageTitle, Button, ErrorBox } from "../ui";

const STAGES = ["ingest", "profile", "harmonize", "sample", "model", "forecast"];

export default function Datasets() {
  const g = useGlobal();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [list, setList] = useState<any>({ datasets: [], pipeline: [] });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [prof, setProf] = useState<any>(null);
  const [stock, setStock] = useState("AAPL");
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const refresh = useCallback(() => getDatasets().then(setList).catch((e) => setErr(String(e))), []);
  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => { if (g.dataset) getProfile(g.dataset).then(setProf).catch(() => setProf(null)); else setProf(null); }, [g.dataset]);

  const doLoad = async (fn: () => Promise<{ id: string }>, label: string) => {
    setBusy(label); setErr(null);
    try { const m = await fn(); g.set({ dataset: m.id }); await refresh(); }
    catch (e) { setErr(String(e)); } finally { setBusy(""); }
  };
  const pipeOf = (id: string) => list.pipeline.find((p: { id: string }) => p.id === id);

  return (
    <div className="space-y-4">
      <PageTitle title="Datasets" subtitle="Ingest data, then it flows through the pipeline: profile → harmonize → sample → model → forecast." />
      <Card title="Ingest">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" disabled={!!busy} onClick={() => doLoad(() => loadBuiltin("synthetic_series"), "synthetic")}>+ Synthetic series</Button>
          <Button variant="ghost" disabled={!!busy} onClick={() => doLoad(() => loadBuiltin("diabetes"), "diabetes")}>+ Diabetes</Button>
          <span className="inline-flex gap-1">
            <input value={stock} onChange={(e) => setStock(e.target.value.toUpperCase())}
              className="w-24 rounded-md border border-border bg-background px-2 py-1.5 text-sm" />
            <Button variant="ghost" disabled={!!busy} onClick={() => doLoad(() => loadStockDataset(stock), "stock")}>+ Stock</Button>
          </span>
          <label className="rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-accent cursor-pointer">+ Upload CSV/JSON
            <input type="file" hidden accept=".csv,.json,.parquet" onChange={(e) => { const f = e.target.files?.[0]; if (f) doLoad(() => uploadDataset(f, f.name), "upload"); }} />
          </label>
          {busy && <span className="text-sm text-muted-foreground animate-pulse">loading {busy}…</span>}
        </div>
        {err && <div className="mt-2"><ErrorBox msg={err} /></div>}
      </Card>

      <Card title={`Loaded datasets (${list.datasets.length})`}>
        <table className="w-full text-sm">
          <thead><tr className="text-left text-muted-foreground border-b border-border">
            <th className="py-1.5">Dataset</th><th>Source</th><th>Rows</th><th>Cols</th><th>Pipeline</th><th></th></tr></thead>
          <tbody>{list.datasets.map((d: { id: string; name: string; source: string; rows: number; cols: number }) => {
            const p = pipeOf(d.id); const done = p ? STAGES.filter((s) => p.stages[s] === "done") : [];
            return (
              <tr key={d.id} className={`border-b border-border/50 ${g.dataset === d.id ? "bg-accent/40" : ""}`}>
                <td className="py-1.5 font-semibold">{d.name}</td><td className="text-muted-foreground">{d.source}</td>
                <td className="mono">{d.rows}</td><td className="mono">{d.cols}</td>
                <td><div className="flex items-center gap-1">{STAGES.map((s) => (
                  <span key={s} title={s} className={`h-2 w-2 rounded-full ${done.includes(s) ? "bg-success" : "bg-muted"}`} />))}
                  <span className="ml-2 text-xs text-muted-foreground mono">{done.length}/6</span></div></td>
                <td><Button variant={g.dataset === d.id ? "primary" : "ghost"} onClick={() => g.set({ dataset: d.id })}>{g.dataset === d.id ? "active" : "select"}</Button></td>
              </tr>); })}</tbody>
        </table>
      </Card>

      {prof ? (
        <Card title={`Profile — ${g.dataset}`}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <KPI label="rows" value={prof.rows} /><KPI label="columns" value={prof.cols} />
            <KPI label="missing" value={`${prof.missing_total_pct}%`} tone={prof.missing_total_pct > 0 ? "bad" : "good"} />
            <KPI label="target candidate" value={prof.target_candidate ?? "—"} />
          </div>
          <table className="w-full text-sm">
            <thead><tr className="text-left text-muted-foreground border-b border-border">
              <th className="py-1.5">Column</th><th>Kind</th><th>Missing</th><th>Unique</th><th>Mean</th><th>Min</th><th>Max</th></tr></thead>
            <tbody>{prof.columns.map((c: { name: string; kind: string; missing_pct: number; n_unique: number; mean?: number; min?: number; max?: number }) => (
              <tr key={c.name} className="border-b border-border/40">
                <td className="py-1">{c.name}</td>
                <td><span className="rounded px-1.5 py-0.5 text-xs bg-accent text-accent-foreground">{c.kind}</span></td>
                <td className="mono">{c.missing_pct}%</td><td className="mono">{c.n_unique}</td>
                <td className="mono">{c.mean ?? "—"}</td><td className="mono">{c.min ?? "—"}</td><td className="mono">{c.max ?? "—"}</td></tr>))}</tbody>
          </table>
        </Card>
      ) : <Card><div className="text-sm text-muted-foreground">Select a dataset to see its profile.</div></Card>}
    </div>
  );
}

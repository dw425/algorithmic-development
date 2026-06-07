import { useState, useEffect } from "react";
import { automlDataset, importanceDataset, getZooModels, getProfile, getModels } from "../api";
import { useGlobal } from "../GlobalControls";
import { Card, KPI, PageTitle, Field, Select, Button, Loading, ErrorBox } from "../ui";
import Plot from "../Plot";

export function AutoML() {
  const g = useGlobal();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [r, setR] = useState<any>(null); const [busy, setBusy] = useState(false); const [e, setE] = useState<string | null>(null);
  async function run() { if (!g.dataset) { setE("Pick a dataset on the Data tab first."); return; } setBusy(true); setE(null);
    try { setR(await automlDataset(g.dataset)); } catch (x) { setE(String(x)); } finally { setBusy(false); } }
  const lb = r?.leaderboard || [];
  return (<div className="space-y-4"><PageTitle title="AutoML leaderboard" subtitle={`Run a curated model set on ${g.dataset || "(no dataset)"} and rank by R².`} />
    <Card><Button onClick={run} disabled={busy}>{busy ? "running…" : "Run AutoML"}</Button>{e && <div className="mt-2"><ErrorBox msg={e} /></div>}</Card>
    {lb.length > 0 && <><div className="grid grid-cols-2 gap-3"><KPI label="models run" value={r.n_models} /><KPI label="best" value={r.best_model} tone="good" /></div>
      <Card title="Leaderboard"><Plot height={300} data={[{ type: "bar", orientation: "h", y: lb.map((x: { model: string }) => x.model).reverse(), x: lb.map((x: { r2: number }) => x.r2).reverse(), marker: { color: "#6366f1" } }]} layout={{ xaxis: { title: "R²" } }} />
        <table className="w-full text-sm mt-3"><thead><tr className="text-left text-muted-foreground border-b border-border"><th className="py-1.5">Model</th><th>R²</th><th>RMSE</th><th>MAPE</th></tr></thead>
          <tbody>{lb.map((x: { model: string; r2: number; rmse: number; mape_pct: number }) => <tr key={x.model} className="border-b border-border/40"><td className="py-1">{x.model}</td><td className={`mono ${x.r2 > 0 ? "text-success" : "text-destructive"}`}>{x.r2}</td><td className="mono">{x.rmse}</td><td className="mono">{x.mape_pct}%</td></tr>)}</tbody></table></Card></>}</div>);
}

export function Importance() {
  const g = useGlobal();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [zoo, setZoo] = useState<any>({ models: [] }); const [model, setModel] = useState("random_forest");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [r, setR] = useState<any>(null); const [busy, setBusy] = useState(false); const [e, setE] = useState<string | null>(null);
  useEffect(() => { getZooModels().then(setZoo).catch(() => undefined); }, []);
  async function run() { if (!g.dataset) { setE("Pick a dataset on the Data tab first."); return; } setBusy(true); setE(null);
    try { setR(await importanceDataset(g.dataset, model)); } catch (x) { setE(String(x)); } finally { setBusy(false); } }
  const imp = r?.importances || [];
  return (<div className="space-y-4"><PageTitle title="Explainability" subtitle="Permutation feature importance — drop in R² when each feature is shuffled." />
    <Card><div className="flex items-end gap-3"><Field label="Model"><Select value={model} onChange={setModel}>{zoo.models.map((m: { name: string }) => <option key={m.name}>{m.name}</option>)}</Select></Field><Button onClick={run} disabled={busy}>{busy ? "computing…" : "Compute importance"}</Button></div>{e && <div className="mt-2"><ErrorBox msg={e} /></div>}</Card>
    {imp.length > 0 && <Card title={`${r.model} — feature importance (baseline R² ${r.baseline_r2})`}><Plot height={320} data={[{ type: "bar", orientation: "h", y: imp.map((x: { feature: string }) => x.feature).reverse(), x: imp.map((x: { importance: number }) => x.importance).reverse(), marker: { color: "#fbbf24" } }]} layout={{ xaxis: { title: "importance (R² drop)" } }} /></Card>}</div>);
}

export function BasePool() {
  const g = useGlobal(); const [t, setT] = useState(g.stocks[0] || "AAPL");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [d, setD] = useState<any>(null); const [e, setE] = useState<string | null>(null);
  useEffect(() => { setD(null); getModels(t, g.granularity, g.params).then(setD).catch((x) => setE(String(x))); }, [t, g.runKey]); // eslint-disable-line
  const fc = d?.forecasts || {}; const names = Object.keys(fc);
  return (<div className="space-y-4"><PageTitle title="Base pool & ρ" subtitle="The 11-model base pool and how correlated their errors are (low ρ = real diversity)." />
    <Field label="Stock"><Select value={t} onChange={setT}>{g.stocks.map((s) => <option key={s}>{s}</option>)}</Select></Field>{e && <ErrorBox msg={e} />}{!d && !e && <Loading />}
    {d && <><div className="grid grid-cols-3 gap-3"><KPI label="mean error ρ" value={d.rho.mean_rho} /><KPI label="effective models" value={d.rho.effective_models} /><KPI label="pool" value={d.rho.pool} /></div>
      <Card title={`${t} — model forecasts vs actual`}><Plot data={[{ x: d.dates, y: d.actual, mode: "lines", name: "actual", line: { color: "#e5e7eb", width: 2 } }, ...names.slice(0, 11).map((m, i) => ({ x: d.dates, y: fc[m], mode: "lines", name: m, line: { width: 1, color: `hsl(${(i * 33) % 360} 60% 60%)` } }))]} layout={{ yaxis: { title: "$" } }} /></Card></>}</div>);
}

import { useState, useEffect } from "react";
import { getZooModels, getProfile, runZooModel } from "../api";
import { useGlobal } from "../GlobalControls";
import { Card, KPI, PageTitle, Field, Select, Button, ErrorBox } from "../ui";
import Plot from "../Plot";

export default function ModelLabView() {
  const g = useGlobal();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [zoo, setZoo] = useState<any>({ models: [], n: 0, families: {} });
  const [model, setModel] = useState("random_forest");
  const [target, setTarget] = useState("");
  const [cols, setCols] = useState<string[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [runs, setRuns] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => { getZooModels().then(setZoo).catch((e) => setErr(String(e))); }, []);
  useEffect(() => {
    if (!g.dataset) { setCols([]); return; }
    getProfile(g.dataset).then((p) => { setCols(p.numeric_columns || []); setTarget(p.target_candidate || (p.numeric_columns || [])[0] || ""); }).catch(() => undefined);
  }, [g.dataset]);

  async function run() {
    if (!g.dataset) { setErr("Pick a dataset on the Data tab first."); return; }
    setBusy(true); setErr(null);
    try { const r = await runZooModel(g.dataset, model, target, 0.2, false); setRuns((p) => [{ ...r, _m: model }, ...p].slice(0, 12)); }
    catch (e) { setErr(String(e)); } finally { setBusy(false); }
  }
  const last = runs[0];
  return (
    <div className="space-y-4">
      <PageTitle title="Model Lab" subtitle={`Run any of the ${zoo.n || 49} Project Zoo models on the active dataset and compare.`} />
      <Card>
        <div className="flex flex-wrap items-end gap-3">
          <Field label={`Model (${zoo.models.length})`}><Select value={model} onChange={setModel}>{zoo.models.map((m: { name: string; family: string }) => <option key={m.name} value={m.name}>{m.name} — {m.family}</option>)}</Select></Field>
          <Field label="Target"><Select value={target} onChange={setTarget}>{cols.map((c) => <option key={c}>{c}</option>)}</Select></Field>
          <Button onClick={run} disabled={busy}>{busy ? "fitting…" : "Run model"}</Button>
          <span className="text-xs text-muted-foreground">dataset: {g.dataset || "(none)"}</span>
        </div>
        {err && <div className="mt-2"><ErrorBox msg={err} /></div>}
      </Card>
      {last && last.metrics && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KPI label="R²" value={last.metrics.r2} tone={last.metrics.r2 > 0 ? "good" : "bad"} />
            <KPI label="RMSE" value={last.metrics.rmse} />
            <KPI label="MAPE" value={`${last.metrics.mape_pct}%`} />
            <KPI label="R² vs naive" value={(last.metrics.r2 - last.naive_metrics.r2).toFixed(3)} tone={last.metrics.r2 > last.naive_metrics.r2 ? "good" : "bad"} />
          </div>
          <Card title={`${last._m} — actual vs predicted`}>
            <Plot data={[
              { y: last.sample.map((s: { actual: number }) => s.actual), mode: "lines+markers", name: "actual", line: { color: "#e5e7eb" } },
              { y: last.sample.map((s: { pred: number }) => s.pred), mode: "lines+markers", name: last._m, line: { color: "#a855f7" } },
            ]} layout={{ xaxis: { title: "test row" } }} />
          </Card>
        </>
      )}
      {runs.length > 1 && (
        <Card title="Run comparison">
          <table className="w-full text-sm"><thead><tr className="text-left text-muted-foreground border-b border-border"><th className="py-1.5">Model</th><th>R²</th><th>RMSE</th><th>MAPE</th><th>vs naive</th></tr></thead>
            <tbody>{runs.filter((r) => r.metrics).map((r, i) => (
              <tr key={i} className="border-b border-border/40"><td className="py-1">{r._m}</td>
                <td className={`mono ${r.metrics.r2 > 0 ? "text-success" : "text-destructive"}`}>{r.metrics.r2}</td>
                <td className="mono">{r.metrics.rmse}</td><td className="mono">{r.metrics.mape_pct}%</td>
                <td className={`mono ${r.metrics.r2 > r.naive_metrics.r2 ? "text-success" : "text-destructive"}`}>{(r.metrics.r2 - r.naive_metrics.r2).toFixed(3)}</td></tr>))}</tbody></table>
        </Card>
      )}
    </div>
  );
}

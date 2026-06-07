import { useState, useEffect } from "react";
import { harmonizeDataset, sampleDataset, getClean, getStationarity } from "../api";
import { useGlobal } from "../GlobalControls";
import { Card, KPI, PageTitle, Field, Select, Button, Loading, ErrorBox } from "../ui";
import Plot from "../Plot";

export function Harmonize() {
  const g = useGlobal();
  const [cfg, setCfg] = useState({ missing: "mean", outliers: "hampel", normalize: "none", encode: "none" });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [r, setR] = useState<any>(null); const [busy, setBusy] = useState(false); const [e, setE] = useState<string | null>(null);
  const set = (k: string, v: string) => setCfg((c) => ({ ...c, [k]: v }));
  async function run() { if (!g.dataset) { setE("Pick a dataset on the Data tab first."); return; } setBusy(true); setE(null);
    try { setR(await harmonizeDataset(g.dataset, { ...cfg, hampel_k: 3 })); } catch (x) { setE(String(x)); } finally { setBusy(false); } }
  return (<div className="space-y-4"><PageTitle title="Harmonize & Condition" subtitle={`Active dataset: ${g.dataset || "(none)"} — coerce, fill missing, condition outliers, normalize, encode.`} />
    <Card><div className="flex flex-wrap items-end gap-3">
      <Field label="Missing"><Select value={cfg.missing} onChange={(v) => set("missing", v)}>{["mean", "median", "ffill", "interpolate", "zero", "drop"].map((o) => <option key={o}>{o}</option>)}</Select></Field>
      <Field label="Outliers"><Select value={cfg.outliers} onChange={(v) => set("outliers", v)}>{["hampel", "winsorize", "none"].map((o) => <option key={o}>{o}</option>)}</Select></Field>
      <Field label="Normalize"><Select value={cfg.normalize} onChange={(v) => set("normalize", v)}>{["none", "zscore", "minmax", "robust", "log"].map((o) => <option key={o}>{o}</option>)}</Select></Field>
      <Field label="Encode"><Select value={cfg.encode} onChange={(v) => set("encode", v)}>{["none", "onehot", "ordinal"].map((o) => <option key={o}>{o}</option>)}</Select></Field>
      <Button onClick={run} disabled={busy}>{busy ? "conditioning…" : "Condition"}</Button></div>{e && <div className="mt-2"><ErrorBox msg={e} /></div>}</Card>
    {r && r.before && <><div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <KPI label="rows before" value={r.before.rows} /><KPI label="rows after" value={r.after.rows} />
      <KPI label="missing before" value={`${r.before.missing_pct}%`} tone={r.before.missing_pct > 0 ? "bad" : "good"} />
      <KPI label="outliers conditioned" value={r.after.outliers_conditioned} /></div>
      <Card title={`Saved → ${r.output_id} · preview`}><table className="w-full text-sm"><thead><tr className="text-left text-muted-foreground border-b border-border">{Object.keys(r.preview[0] || {}).slice(0, 8).map((k) => <th key={k} className="py-1.5">{k}</th>)}</tr></thead>
        <tbody>{r.preview.slice(0, 10).map((row: Record<string, unknown>, i: number) => <tr key={i} className="border-b border-border/40">{Object.keys(r.preview[0] || {}).slice(0, 8).map((k) => <td key={k} className="py-1 mono">{String(row[k]).slice(0, 10)}</td>)}</tr>)}</tbody></table></Card></>}</div>);
}

export function SampleView() {
  const g = useGlobal();
  const [cfg, setCfg] = useState({ method: "time", test_size: 0.2, folds: 5, embargo: 0 });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [r, setR] = useState<any>(null); const [busy, setBusy] = useState(false); const [e, setE] = useState<string | null>(null);
  async function run() { if (!g.dataset) { setE("Pick a dataset on the Data tab first."); return; } setBusy(true); setE(null);
    try { setR(await sampleDataset(g.dataset, cfg)); } catch (x) { setE(String(x)); } finally { setBusy(false); } }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let plot: any = null; const p = r?.plan;
  if (p?.folds) plot = <Plot height={260} data={p.folds.flatMap((f: { fold: number; train: number[]; test: number[] }) => [
    { x: [f.train[1] - f.train[0]], y: [`fold ${f.fold}`], base: [f.train[0]], orientation: "h", type: "bar", marker: { color: "#2dd4bf" }, name: "train", showlegend: f.fold === 1 },
    { x: [f.test[1] - f.test[0]], y: [`fold ${f.fold}`], base: [f.test[0]], orientation: "h", type: "bar", marker: { color: "#fbbf24" }, name: "test", showlegend: f.fold === 1 }])} layout={{ barmode: "overlay", xaxis: { title: "row index", range: [0, r.n] } }} />;
  else if (p?.n_train != null) plot = <Plot height={130} data={[{ x: [p.n_train], y: ["split"], base: [0], orientation: "h", type: "bar", marker: { color: "#2dd4bf" }, name: "train" }, { x: [p.n_test ?? r.n - p.n_train], y: ["split"], base: [p.n_train], orientation: "h", type: "bar", marker: { color: "#fbbf24" }, name: "test" }]} layout={{ barmode: "overlay", xaxis: { range: [0, r.n] } }} />;
  return (<div className="space-y-4"><PageTitle title="Sample" subtitle={`Active dataset: ${g.dataset || "(none)"} — build a split plan.`} />
    <Card><div className="flex flex-wrap items-end gap-3">
      <Field label="Method"><Select value={cfg.method} onChange={(v) => setCfg((c) => ({ ...c, method: v }))}>{["time", "rolling_origin", "bootstrap", "stratified", "random"].map((o) => <option key={o}>{o}</option>)}</Select></Field>
      <Field label="Test size"><Select value={String(cfg.test_size)} onChange={(v) => setCfg((c) => ({ ...c, test_size: Number(v) }))}>{[0.1, 0.2, 0.3, 0.4].map((o) => <option key={o}>{o}</option>)}</Select></Field>
      <Field label="Folds"><Select value={String(cfg.folds)} onChange={(v) => setCfg((c) => ({ ...c, folds: Number(v) }))}>{[3, 4, 5, 6, 8].map((o) => <option key={o}>{o}</option>)}</Select></Field>
      <Field label="Embargo"><Select value={String(cfg.embargo)} onChange={(v) => setCfg((c) => ({ ...c, embargo: Number(v) }))}>{[0, 5, 10, 20].map((o) => <option key={o}>{o}</option>)}</Select></Field>
      <Button onClick={run} disabled={busy}>{busy ? "…" : "Build split"}</Button></div>{e && <div className="mt-2"><ErrorBox msg={e} /></div>}</Card>
    {p && <Card title={`${p.method} — ${r.n} rows`}>{plot}<div className="text-sm text-muted-foreground mt-2">{p.note || (p.n_folds ? `${p.n_folds} folds, embargo ${p.embargo}` : "")}</div></Card>}</div>);
}

export function CleanStationarity() {
  const g = useGlobal(); const [t, setT] = useState(g.stocks[0] || "AAPL");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [cl, setCl] = useState<any>(null); const [st, setSt] = useState<any>(null); const [e, setE] = useState<string | null>(null);
  useEffect(() => { setCl(null); setSt(null);
    getClean(t, g.granularity, g.params).then(setCl).catch((x) => setE(String(x)));
    getStationarity(t, g.granularity, g.params).then(setSt).catch((x) => setE(String(x)));
  }, [t, g.runKey]); // eslint-disable-line
  return (<div className="space-y-4"><PageTitle title="Clean & Stationarity" subtitle="Benford/Hampel cleaning + ADF/KPSS/STL for the chosen series." />
    <Field label="Stock"><Select value={t} onChange={setT}>{g.stocks.map((s) => <option key={s}>{s}</option>)}</Select></Field>{e && <ErrorBox msg={e} />}
    {cl && <><div className="grid grid-cols-2 md:grid-cols-3 gap-3"><KPI label="Hampel outliers" value={cl.hampel_outliers} /><KPI label="quarantined" value={cl.n_quarantined} /><KPI label="Benford max-dev" value={cl.benford?.max_dev ?? "—"} /></div>
      <Card title={`${t} — cleaned close`}><Plot height={240} data={[{ x: cl.rows.map((r: { date: string }) => r.date), y: cl.rows.map((r: { close: number }) => r.close), mode: "lines", line: { color: "#2dd4bf" } }]} layout={{}} /></Card></>}
    {st && st.stl && <Card title={`${t} — STL trend · ADF p=${st.stationarity.adf_p ?? "—"} KPSS p=${st.stationarity.kpss_p ?? "—"} → ${st.stationarity.recommend}`}>
      <Plot height={240} data={[{ x: st.dates, y: st.stl.trend, mode: "lines", line: { color: "#a855f7" }, name: "trend" }]} layout={{}} /></Card>}</div>);
}

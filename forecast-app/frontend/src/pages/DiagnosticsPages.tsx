import { useState, useEffect } from "react";
import { getPredictability, getDiagnostics } from "../api";
import { useGlobal } from "../GlobalControls";
import { Card, KPI, PageTitle, Field, Select, Loading, ErrorBox } from "../ui";
import Plot from "../Plot";

function useStockDiag() {
  const g = useGlobal(); const [t, setT] = useState(g.stocks[0] || "AAPL");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [d, setD] = useState<any>(null); const [e, setE] = useState<string | null>(null);
  useEffect(() => { setD(null); getDiagnostics(t, g.target / 100, g.granularity).then(setD).catch((x) => setE(String(x))); }, [t, g.runKey]); // eslint-disable-line
  const picker = <Field label="Stock"><Select value={t} onChange={setT}>{g.stocks.map((s) => <option key={s}>{s}</option>)}</Select></Field>;
  return { t, d, e, picker };
}

export function Predictability() {
  const g = useGlobal(); const [t, setT] = useState(g.stocks[0] || "AAPL");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [d, setD] = useState<any>(null); const [e, setE] = useState<string | null>(null);
  useEffect(() => { setD(null); getPredictability(t, g.granularity).then(setD).catch((x) => setE(String(x))); }, [t, g.runKey]); // eslint-disable-line
  const tk = d?.takens || [];
  return (<div className="space-y-4"><PageTitle title="Predictability" subtitle="Hurst (DFA), Lyapunov, and the Takens delay-embedding attractor." />
    <Field label="Stock"><Select value={t} onChange={setT}>{g.stocks.map((s) => <option key={s}>{s}</option>)}</Select></Field>{e && <ErrorBox msg={e} />}{!d && !e && <Loading />}
    {d && <><div className="grid grid-cols-2 md:grid-cols-4 gap-3"><KPI label="Hurst" value={d.predictability.hurst} /><KPI label="Lyapunov" value={d.predictability.lyapunov} /><KPI label="horizon (d)" value={d.predictability.horizon_days} /><KPI label="regime" value={d.predictability.label} /></div>
      <Card title={`${t} — Takens attractor`}><Plot height={420} data={[{ type: "scatter3d", mode: "markers", x: tk.map((p: number[]) => p[0]), y: tk.map((p: number[]) => p[1]), z: tk.map((p: number[]) => p[2]), marker: { size: 2, color: "#2dd4bf" } }]} layout={{ scene: {} }} /></Card></>}</div>);
}

export function Calibration() {
  const { t, d, e, picker } = useStockDiag(); const cal = d?.calibration || {};
  return (<div className="space-y-4"><PageTitle title="Calibration" subtitle="Empirical vs nominal coverage — is the band honest?" />{picker}{e && <ErrorBox msg={e} />}{!d && !e && <Loading />}
    {d && <div className="grid grid-cols-2 md:grid-cols-3 gap-3"><KPI label="nominal" value={`${cal.nominal ?? "—"}%`} /><KPI label="empirical" value={`${cal.empirical ?? "—"}%`} tone={cal.calibrated ? "good" : "bad"} /><KPI label="verdict" value={cal.calibrated ? "calibrated" : "off"} tone={cal.calibrated ? "good" : "bad"} /></div>}
    {d && <Card title={`${t} — reliability`}><Plot height={260} data={[{ x: ["nominal", "empirical"], y: [cal.nominal, cal.empirical], type: "bar", marker: { color: ["#64748b", "#2dd4bf"] } }]} layout={{ yaxis: { title: "%" } }} /></Card>}</div>);
}

export function MCS() {
  const { d, e, picker } = useStockDiag(); const surv = d?.mcs_survivors || [];
  return (<div className="space-y-4"><PageTitle title="Model Confidence Set" subtitle="Which models survive the MCS at the chosen margin." />{picker}{e && <ErrorBox msg={e} />}{!d && !e && <Loading />}
    {d && <><div className="grid grid-cols-2 gap-3"><KPI label="survivors" value={surv.length} tone="good" /><KPI label="pool" value={d.mcs_pool} /></div>
      <Card title="Survivors"><div className="flex flex-wrap gap-2">{surv.map((m: string) => <span key={m} className="rounded px-2 py-1 text-sm bg-success/15 text-success">{m}</span>)}</div></Card></>}</div>);
}

export function Drift() {
  const { d, e, picker } = useStockDiag(); const o = d?.outward || {};
  return (<div className="space-y-4"><PageTitle title="Drift & shift" subtitle="Page-Hinkley drift, PSI distribution shift, recent volatility — the outward eye." />{picker}{e && <ErrorBox msg={e} />}{!d && !e && <Loading />}
    {d && <div className="grid grid-cols-2 md:grid-cols-3 gap-3"><KPI label="Page-Hinkley" value={o.drift?.drift ? "DRIFT" : "stable"} tone={o.drift?.drift ? "bad" : "good"} /><KPI label="PSI (recent)" value={o.psi_recent} tone={o.psi_recent > 0.2 ? "warn" : "good"} /><KPI label="recent vol" value={`${o.vol_recent}%`} /></div>}
    {d && d.net_results && <Card title="Net-results convergence (inverse drift)"><div className="text-sm">convergence <b>{d.net_results.convergence_pct}%</b> · mode ${d.net_results.mode} · robust mean ${d.net_results.robust_mean} · consensus ${d.net_results.consensus}</div></Card>}</div>);
}

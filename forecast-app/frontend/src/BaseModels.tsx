import { useState, useEffect } from "react";
import { getModels } from "./api";
import { useGlobal } from "./GlobalControls";
import PageArchetype from "./PageArchetype";
import Plot from "./Plot";

const COLORS = ["#3b82f6", "#34d399", "#f0b429", "#f87171", "#a78bfa", "#22d3ee", "#fb923c", "#e879f9", "#60a5fa", "#4ade80", "#fca5a5"];

export default function BaseModels() {
  const g = useGlobal();
  const ticker = g.stocks[0] || "MSFT";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [d, setD] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { setErr(null); getModels(ticker, g.granularity).then(setD).catch((e) => setErr(String(e))); }, [g.runKey]); // eslint-disable-line
  if (err) return <div className="err">{err}</div>;
  if (!d) return <PageArchetype title={`Base models — ${ticker}`} viz={<div className="kv">loading…</div>} />;

  const names = Object.keys(d.forecasts);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const traces: any[] = [{ x: d.dates, y: d.actual, mode: "lines", name: "ACTUAL", line: { color: "#fff", width: 2 } }];
  names.forEach((m, i) => traces.push({ x: d.dates, y: d.forecasts[m], mode: "lines", name: m, line: { color: COLORS[i % COLORS.length], width: 1 }, opacity: 0.7 }));
  const viz = <>
    <div className="kv">11 models · mean ρ <b>{d.rho.mean_rho}</b> → effective models <b>{d.rho.effective_models}</b> of {d.rho.pool}</div>
    <Plot height={460} data={traces} layout={{ yaxis: { title: "$ close" } }} />
  </>;
  const data = <table className="mini"><thead><tr><th>Model</th><th>Last forecast</th></tr></thead>
    <tbody>{names.map((m) => <tr key={m}><td>{m}</td><td>${d.forecasts[m].at(-1)}</td></tr>)}</tbody></table>;
  const note = <div className="kv">Mean error-correlation ρ = {d.rho.mean_rho}: the 11 models behave like ~{d.rho.effective_models} independent ones — diversity (low ρ), not count, lowers the error floor.</div>;
  return <PageArchetype title={`Base models — ${ticker}`} viz={viz} data={data} control={note} adjustment={note} />;
}

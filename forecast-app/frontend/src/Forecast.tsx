import { useState, useEffect } from "react";
import { getForecast } from "./api";
import { useGlobal } from "./GlobalControls";
import PageArchetype from "./PageArchetype";
import Plot from "./Plot";

const COLORS = ["#3b82f6", "#34d399", "#f0b429", "#f87171", "#a78bfa", "#22d3ee", "#fb923c", "#e879f9", "#60a5fa", "#4ade80"];

export default function Forecast() {
  const g = useGlobal();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [res, setRes] = useState<Record<string, any>>({});
  const [focus, setFocus] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!g.stocks.length) return;
    setLoading(true); setErr(null);
    Promise.all(g.stocks.map((t) => getForecast(t, g.target / 100, g.granularity).then((r) => [t, r])))
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then((pairs: any[]) => { setRes(Object.fromEntries(pairs)); setFocus(g.stocks[0]); })
      .catch((e) => setErr(String(e))).finally(() => setLoading(false));
  }, [g.runKey]); // eslint-disable-line react-hooks/exhaustive-deps

  if (err) return <div className="err">{err}</div>;
  const tk = Object.keys(res);
  if (!tk.length) return <PageArchetype title="Forecast" viz={<div className="kv">{loading ? "computing…" : "pick stocks + Apply"}</div>} />;
  const cc = (c: number) => (c >= g.target ? "good" : c >= g.target - 8 ? "mid" : "bad");

  const overlay = tk.map((t, i) => {
    const rows = res[t].rows; const b = rows[0]?.actual || 1;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return { x: rows.map((r: any) => r.date), y: rows.map((r: any) => (r.actual / b) * 100), name: t, mode: "lines", line: { color: COLORS[i % COLORS.length] } };
  });
  const fr = focus ? res[focus] : null;

  const viz = <>
    <h2>Accuracy across {tk.length} stocks</h2>
    <table className="mini"><thead><tr><th>Ticker</th><th>Coverage</th><th>Width</th><th></th></tr></thead>
      <tbody>{tk.map((t) => (
        <tr key={t} className={focus === t ? "miss" : ""}><td>{t}</td>
          <td className={cc(res[t].coverage)}>{res[t].coverage}%</td><td>{res[t].avg_width_pct}%</td>
          <td><button className="sg" onClick={() => setFocus(t)}>focus</button></td></tr>))}</tbody></table>
    <h2>Performance (rebased 100)</h2>
    <Plot data={overlay} layout={{ yaxis: { title: "indexed" } }} />
    {fr ? <>
      <h2>{focus} — range vs actual</h2>
      <Plot data={[
        { x: fr.rows.map((r: { date: string }) => r.date), y: fr.rows.map((r: { hi: number }) => r.hi), mode: "lines", line: { width: 0 }, showlegend: false },
        { x: fr.rows.map((r: { date: string }) => r.date), y: fr.rows.map((r: { lo: number }) => r.lo), name: `${fr.target}% range`, mode: "lines", line: { width: 0 }, fill: "tonexty", fillcolor: "rgba(59,130,246,0.18)" },
        { x: fr.rows.map((r: { date: string }) => r.date), y: fr.rows.map((r: { pred: number }) => r.pred), name: "forecast", mode: "lines", line: { color: "#3b82f6" } },
        { x: fr.rows.map((r: { date: string }) => r.date), y: fr.rows.map((r: { actual: number }) => r.actual), name: "actual", mode: "lines", line: { color: "#34d399" } },
      ]} layout={{ yaxis: { title: "$ close" } }} />
    </> : null}
  </>;
  const data = fr ? <table className="mini"><thead><tr><th>Date</th><th>Range</th><th>Actual</th><th>Hit</th></tr></thead>
    <tbody>{fr.rows.slice(-40).map((r: { date: string; lo: number; hi: number; actual: number; hit: boolean }) => (
      <tr key={r.date} className={r.hit ? "" : "miss"}><td>{r.date}</td><td>${r.lo}–${r.hi}</td><td>${r.actual}</td><td>{r.hit ? "✓" : "✗"}</td></tr>))}</tbody></table> : null;
  const note = <div className="kv">Range = conformal + ACI (target {g.target}%) with debiasing; ensemble of 7 models. Pick stocks/target/granularity on the left.</div>;
  return <PageArchetype title="Forecast" viz={viz} data={data} control={note} adjustment={note} />;
}

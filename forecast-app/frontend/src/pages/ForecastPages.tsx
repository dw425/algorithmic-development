import { useState, useEffect } from "react";
import { getPredict, getHorizons, getBacktest, getTPA } from "../api";
import { useGlobal } from "../GlobalControls";
import { Card, KPI, PageTitle, Field, Select, Loading, ErrorBox } from "../ui";
import Plot from "../Plot";

function Picker({ t, set }: { t: string; set: (v: string) => void }) {
  const g = useGlobal();
  return <Field label="Stock"><Select value={t} onChange={set}>{g.stocks.map((s) => <option key={s}>{s}</option>)}</Select></Field>;
}

export function Predictions() {
  const g = useGlobal();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [res, setRes] = useState<any>({}); const [err, setErr] = useState<string | null>(null); const [loading, setLoading] = useState(false);
  useEffect(() => { setLoading(true); setErr(null);
    Promise.all(g.stocks.map((t) => getPredict(t, g.target / 100, g.granularity, g.params).then((r) => [t, r])))
      .then((p) => setRes(Object.fromEntries(p))).catch((e) => setErr(String(e))).finally(() => setLoading(false));
  }, [g.runKey]); // eslint-disable-line
  const tk = Object.keys(res);
  return (<div className="space-y-4"><PageTitle title="Predictions" subtitle="Next-step forecast per stock: point + range + 1,980-vector cloud consensus." />
    {err && <ErrorBox msg={err} />}{loading && <Loading what="computing" />}
    {tk.length > 0 && <Card title={`Forecast for the next close — ${tk.length} stocks`}>
      <table className="w-full text-sm"><thead><tr className="text-left text-muted-foreground border-b border-border"><th className="py-1.5">Ticker</th><th>Last</th><th>Forecast</th><th>Move</th><th>{g.target}% range</th><th>Cloud consensus</th></tr></thead>
        <tbody>{tk.map((t) => { const r = res[t]; return <tr key={t} className="border-b border-border/40"><td className="py-1 font-semibold">{t}</td><td className="mono">${r.last_close}</td><td className="mono">${r.point}</td><td className={`mono ${r.move_pct >= 0 ? "text-success" : "text-destructive"}`}>{r.move_pct >= 0 ? "+" : ""}{r.move_pct}%</td><td className="mono">${r.lo}–${r.hi}</td><td className="mono">${r.cloud_consensus}</td></tr>; })}</tbody></table></Card>}
    {tk.length > 0 && res[tk[0]] && <Card title={`${tk[0]} — recent close + next-step forecast`}>
      <Plot data={[{ x: res[tk[0]].recent_dates, y: res[tk[0]].recent_close, mode: "lines+markers", name: "recent", line: { color: "#e5e7eb" } },
        { x: [res[tk[0]].last_date + " +1"], y: [res[tk[0]].point], mode: "markers", name: "forecast", marker: { color: "#2dd4bf", size: 12, symbol: "diamond" } }]} layout={{ yaxis: { title: "$ close" } }} /></Card>}</div>);
}

export function MultiHorizon() {
  const g = useGlobal(); const [t, setT] = useState(g.stocks[0] || "AAPL");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [d, setD] = useState<any>(null); const [e, setE] = useState<string | null>(null);
  useEffect(() => { setD(null); getHorizons(t, g.target / 100, g.granularity, g.params).then(setD).catch((x) => setE(String(x))); }, [t, g.runKey]); // eslint-disable-line
  const hz = d?.horizons || {}; const ks = Object.keys(hz);
  return (<div className="space-y-4"><PageTitle title="Multi-horizon" subtitle="Coverage + width at 7 / 30 / 90 days, leakage-free (purge/embargo)." /><Picker t={t} set={setT} />
    {e && <ErrorBox msg={e} />}{!d && !e && <Loading />}
    {ks.length > 0 && <><div className="grid grid-cols-3 gap-3">{ks.map((k) => <KPI key={k} label={`${k} coverage`} value={`${hz[k].coverage}%`} tone={hz[k].coverage >= g.target ? "good" : "warn"} />)}</div>
      <Card title={`${t} — coverage & width by horizon`}><Plot data={[{ x: ks, y: ks.map((k) => hz[k].coverage), type: "bar", name: "coverage %", marker: { color: "#2dd4bf" } }, { x: ks, y: ks.map((k) => hz[k].avg_width_pct), type: "bar", name: "width %", marker: { color: "#fbbf24" } }]} layout={{ barmode: "group" }} /></Card></>}</div>);
}

export function Backtest() {
  const g = useGlobal(); const [t, setT] = useState(g.stocks[0] || "AAPL");
  const [dates] = useState("2025-01-15,2025-02-03,2025-02-18,2025-03-05,2025-03-20");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [d, setD] = useState<any>(null); const [e, setE] = useState<string | null>(null);
  useEffect(() => { setD(null); getBacktest(t, dates, "1,7,30,90", g.target / 100).then(setD).catch((x) => setE(String(x))); }, [t, g.runKey]); // eslint-disable-line
  const acc = d?.accuracy_by_horizon || {}; const hs = ["1", "7", "30", "90"];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows: any[] = []; (d?.origins || []).forEach((o: { horizons: { available: boolean }[] }) => o.horizons.forEach((r) => { if (r.available) rows.push(r); }));
  return (<div className="space-y-4"><PageTitle title="Backtest" subtitle="Anchor at 5 dates (Jan–Mar 2025), forecast 1/7/30/90d, compare to actuals." /><Picker t={t} set={setT} />
    {e && <ErrorBox msg={e} />}{!d && !e && <Loading what="backtesting" />}
    {Object.keys(acc).length > 0 && <><Card title="Accuracy by horizon (100 − mean abs % error)"><Plot data={[{ x: hs, y: hs.map((h) => acc[h]?.accuracy_pct ?? null), mode: "lines+markers", line: { color: "#2dd4bf" } }]} layout={{ xaxis: { title: "horizon (days)", type: "category" }, yaxis: { title: "accuracy %" } }} /></Card>
      <Card title="Inverse-drift rating"><div className="text-sm">lean <b>{d.inverse_drift?.lean}</b> · {d.inverse_drift?.coherence_pct}% coherence</div></Card>
      <Card title="Predicted vs actual"><table className="w-full text-sm"><thead><tr className="text-left text-muted-foreground border-b border-border"><th className="py-1.5">Origin</th><th>+H</th><th>Target</th><th>Pred</th><th>Actual</th><th>Err%</th><th>In band</th></tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i} className="border-b border-border/40"><td className="py-1">{r.origin_date}</td><td>+{r.h}d</td><td>{r.target_date}</td><td className="mono">${r.pred}</td><td className="mono">${r.actual}</td><td className={`mono ${r.abs_error_pct < 5 ? "text-success" : r.abs_error_pct < 12 ? "text-warning" : "text-destructive"}`}>{r.error_pct}%</td><td className={r.hit ? "text-success" : "text-destructive"}>{r.hit ? "✓" : "✗"}</td></tr>)}</tbody></table></Card></>}</div>);
}

export function TPA() {
  const g = useGlobal(); const [t, setT] = useState(g.stocks[0] || "AAPL");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [d, setD] = useState<any>(null); const [e, setE] = useState<string | null>(null);
  useEffect(() => { setD(null); getTPA(t, g.granularity, g.params).then(setD).catch((x) => setE(String(x))); }, [t, g.runKey]); // eslint-disable-line
  const f = d?.fan;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const traces: any[] = [];
  if (f) { for (let k = -f.m; k <= f.m; k++) traces.push({ x: f.dates, y: f.center.map((c: number) => +(c * (1 + k * f.c)).toFixed(3)), mode: "lines", hoverinfo: "skip", showlegend: false, line: { color: "rgba(99,102,241,0.07)", width: 0.4 } });
    const freq: Record<string, number> = {}; f.winner_offset_pct.forEach((o: number) => { freq[o] = (freq[o] || 0) + 1; });
    Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 3).forEach(([off, cnt], i) => traces.push({ x: f.dates, y: f.center.map((c: number) => +(c * (1 + Number(off) / 100)).toFixed(3)), mode: "lines", name: `#${i + 1} ${Number(off) >= 0 ? "+" : ""}${off}% (${cnt}×)`, line: { color: ["#22c55e", "#fbbf24", "#fb923c"][i], width: 2 } }));
    traces.push({ x: f.dates, y: f.actual, mode: "lines", name: "ACTUAL", line: { color: "#ef4444", width: 2.4 } });
    traces.push({ x: f.dates, y: f.winner_value, mode: "markers", name: "per-step best", marker: { color: "#fff", size: 4 } });
  }
  return (<div className="space-y-4"><PageTitle title="Threaded Point Analysis" subtitle="The 201 fan vectors, actual in red, and the top-3 winning offset lines over the period." /><Picker t={t} set={setT} />
    {e && <ErrorBox msg={e} />}{!d && !e && <Loading />}
    {d && <><div className="grid grid-cols-2 md:grid-cols-4 gap-3"><KPI label="fan vectors" value={d.points} /><KPI label="modifier" value={`${d.modifier_pct}%`} tone={d.significant ? "good" : "bad"} /><KPI label="significant" value={d.significant ? "YES" : "NO"} tone={d.significant ? "good" : "bad"} /><KPI label="thread autocorr" value={d.thread_autocorr} /></div>
      {f && <Card title={`${t} — ${d.points} threaded point vectors`}><Plot height={460} data={traces} layout={{ yaxis: { title: "$ close" }, legend: { orientation: "h", y: -0.15 } }} /></Card>}</>}</div>);
}

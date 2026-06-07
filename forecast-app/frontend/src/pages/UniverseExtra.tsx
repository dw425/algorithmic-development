import { useState, useEffect } from "react";
import { getPredict, getForecast, getPredictability, getTPA, getRuns } from "../api";
import { useGlobal } from "../GlobalControls";
import { Card, KPI, PageTitle, Loading, ErrorBox } from "../ui";
import Plot from "../Plot";

export function Compare() {
  const g = useGlobal();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [rows, setRows] = useState<any[] | null>(null); const [e, setE] = useState<string | null>(null);
  useEffect(() => { setRows(null);
    Promise.all(g.stocks.map((t) => Promise.all([getPredict(t, g.target / 100, g.granularity, g.params), getForecast(t, g.target / 100, g.granularity, g.params), getPredictability(t, g.granularity), getTPA(t, g.granularity, g.params)])
      .then(([pred, fc, pb, tpa]) => ({ t, pred, fc, pb, tpa })).catch(() => null))).then((r) => setRows(r.filter(Boolean))).catch((x) => setE(String(x)));
  }, [g.runKey]); // eslint-disable-line
  if (e) return <ErrorBox msg={e} />; if (!rows) return <Loading what="comparing" />;
  const ok = rows.filter((r) => r.pred && r.fc);
  return (<div className="space-y-4"><PageTitle title="Compare" subtitle="Side-by-side metrics + rebased performance across your selected stocks." />
    <Card title={`Metrics — ${ok.length} stocks`}><table className="w-full text-sm"><thead><tr className="text-left text-muted-foreground border-b border-border"><th className="py-1.5">Ticker</th><th>Last</th><th>Next</th><th>Move</th><th>Coverage</th><th>Width</th><th>Hurst</th><th>TPA</th></tr></thead>
      <tbody>{ok.map((r) => <tr key={r.t} className="border-b border-border/40"><td className="py-1 font-semibold">{r.t}</td><td className="mono">${r.pred.last_close}</td><td className="mono">${r.pred.point}</td><td className={`mono ${r.pred.move_pct >= 0 ? "text-success" : "text-destructive"}`}>{r.pred.move_pct}%</td><td className={`mono ${r.fc.coverage >= g.target ? "text-success" : "text-warning"}`}>{r.fc.coverage}%</td><td className="mono">{r.fc.avg_width_pct}%</td><td className="mono">{r.pb?.predictability?.hurst ?? "—"}</td><td className={r.tpa?.significant ? "text-success" : "text-destructive"}>{r.tpa?.significant ? "sig" : "no"}</td></tr>)}</tbody></table></Card>
    <Card title="Rebased performance (=100)"><Plot data={ok.map((r, i) => { const rw = r.fc.rows; const b = rw[0]?.actual || 1; return { x: rw.map((x: { date: string }) => x.date), y: rw.map((x: { actual: number }) => (x.actual / b) * 100), mode: "lines", name: r.t, line: { color: ["#2dd4bf", "#22c55e", "#fbbf24", "#f87171", "#a855f7", "#22d3ee"][i % 6] } }; })} layout={{ yaxis: { title: "indexed" } }} /></Card></div>);
}

export function Repository() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [d, setD] = useState<any>(null); const [q, setQ] = useState(""); const [e, setE] = useState<string | null>(null);
  useEffect(() => { getRuns().then(setD).catch((x) => setE(String(x))); }, []);
  if (e) return <ErrorBox msg={e} />; if (!d) return <Loading what="loading batch validation" />;
  const s = d.summary || {}; const rows = (d.rows || []).filter((r: { ticker: string }) => r.ticker.includes(q.toUpperCase())).slice(0, 300);
  return (<div className="space-y-4"><PageTitle title="Repository" subtitle="Full batch held-out validation across the cached universe." />
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3"><KPI label="stocks validated" value={s.n ?? 0} /><KPI label="mean coverage" value={`${s.mean_coverage ?? 0}%`} tone="good" /><KPI label="mean lift vs naive" value={`${s.mean_naive_lift ?? 0}%`} tone={(s.mean_naive_lift ?? 0) > 0 ? "good" : "bad"} /><KPI label="% beating naive" value={`${s.pct_beating_naive ?? 0}%`} /></div>
    <Card title="Per-stock validation" right={<input value={q} onChange={(ev) => setQ(ev.target.value)} placeholder="search" className="rounded-md border border-border bg-background px-2 py-1 text-sm w-40" />}>
      <table className="w-full text-sm"><thead><tr className="text-left text-muted-foreground border-b border-border"><th className="py-1.5">Ticker</th><th>Coverage</th><th>Width</th><th>Lift vs naive</th></tr></thead>
        <tbody>{rows.map((r: { ticker: string; coverage: number; avg_width_pct: number; naive_lift_pct: number }) => <tr key={r.ticker} className="border-b border-border/40"><td className="py-1 font-semibold">{r.ticker}</td><td className={`mono ${r.coverage >= 65 ? "text-success" : "text-warning"}`}>{r.coverage}%</td><td className="mono">{r.avg_width_pct}%</td><td className={`mono ${r.naive_lift_pct > 0 ? "text-success" : "text-destructive"}`}>{r.naive_lift_pct}%</td></tr>)}</tbody></table></Card></div>);
}

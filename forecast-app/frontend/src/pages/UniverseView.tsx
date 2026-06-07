import { useState, useEffect } from "react";
import { getPredictionsAll } from "../api";
import { Card, KPI, PageTitle, Loading, ErrorBox } from "../ui";
import Plot from "../Plot";

interface Row { ticker: string; last_close: number; point: number; lo: number; hi: number; move_pct: number; range_pct: number; cloud_consensus: number; }

export default function UniverseView() {
  const [d, setD] = useState<{ n: number; rows: Row[] } | null>(null);
  const [q, setQ] = useState("");
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { getPredictionsAll().then(setD).catch((e) => setErr(String(e))); }, []);
  if (err) return <ErrorBox msg={err} />;
  if (!d) return <Loading what="loading all predictions" />;
  const up = d.rows.filter((r) => r.move_pct > 0).length;
  const shown = d.rows.filter((r) => r.ticker.includes(q.toUpperCase())).slice(0, 400);
  return (
    <div className="space-y-4">
      <PageTitle title={`Universe — ${d.n} stocks`} subtitle="Next-step forecast for every loaded stock, precomputed." />
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <KPI label="stocks with forecast" value={d.n} />
        <KPI label="forecast up" value={up} tone="good" />
        <KPI label="forecast down/flat" value={d.n - up} tone="bad" />
      </div>
      <Card title={`Next-step move distribution — all ${d.n}`}>
        <Plot height={220} data={[{ x: d.rows.map((r) => r.move_pct), type: "histogram", nbinsx: 80, marker: { color: "#fbbf24" } }]} layout={{ xaxis: { title: "forecast move %" } }} />
      </Card>
      <Card title="Forecasts" right={<input value={q} onChange={(e) => setQ(e.target.value)} placeholder="search" className="rounded-md border border-border bg-background px-2 py-1 text-sm w-40" />}>
        <div className="text-xs text-muted-foreground mb-2">showing {shown.length} of {d.rows.filter((r) => r.ticker.includes(q.toUpperCase())).length}</div>
        <table className="w-full text-sm"><thead><tr className="text-left text-muted-foreground border-b border-border">
          <th className="py-1.5">Ticker</th><th>Last</th><th>Forecast</th><th>Move</th><th>Range</th><th>Width</th><th>Consensus</th></tr></thead>
          <tbody>{shown.map((r) => (
            <tr key={r.ticker} className="border-b border-border/40">
              <td className="py-1 font-semibold">{r.ticker}</td><td className="mono">${r.last_close}</td><td className="mono">${r.point}</td>
              <td className={`mono ${r.move_pct >= 0 ? "text-success" : "text-destructive"}`}>{r.move_pct >= 0 ? "+" : ""}{r.move_pct}%</td>
              <td className="mono">${r.lo}–${r.hi}</td><td className="mono">{r.range_pct}%</td><td className="mono">${r.cloud_consensus}</td></tr>))}</tbody></table>
      </Card>
    </div>
  );
}

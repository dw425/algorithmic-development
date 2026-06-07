import { useState, useEffect } from "react";
import { useGlobal } from "./GlobalControls";
import PageArchetype from "./PageArchetype";

const BASE = "http://127.0.0.1:8000";

export default function Repository() {
  const g = useGlobal();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [d, setD] = useState<any>(null);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"coverage" | "naive_lift_pct" | "avg_width_pct">("coverage");
  useEffect(() => { fetch(`${BASE}/api/runs`).then((r) => r.json()).then(setD).catch(() => undefined); }, [g.runKey]);
  if (!d) return <PageArchetype title="Repository" viz={<div className="kv">loading…</div>} />;
  if (!d.rows.length) return <PageArchetype title="Repository" viz={<div className="kv">batch still running… ({d.summary?.n || 0} so far)</div>} />;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = (d.rows as any[]).filter((r) => r.ticker.includes(q.toUpperCase()))
    .sort((a, b) => (b[sort] as number) - (a[sort] as number)).slice(0, 200);
  const s = d.summary;
  const viz = <>
    <div className="cards">
      <div className="card"><div className="cnum">{s.n}</div><div className="clab">stocks validated</div></div>
      <div className="card"><div className={`cnum ${s.mean_coverage >= 65 ? "good" : "mid"}`}>{s.mean_coverage}%</div><div className="clab">mean coverage</div></div>
      <div className="card"><div className={`cnum ${s.mean_naive_lift > 0 ? "good" : "bad"}`}>{s.mean_naive_lift}%</div><div className="clab">mean lift vs naive (OOS)</div></div>
      <div className="card"><div className={`cnum ${s.pct_beating_naive >= 50 ? "good" : "bad"}`}>{s.pct_beating_naive}%</div><div className="clab">% beating naive</div></div>
    </div>
    <div className="controls">
      <input className="ctrl-in" style={{ maxWidth: 200 }} placeholder="search ticker" value={q} onChange={(e) => setQ(e.target.value)} />
      <select className="ctrl-in" style={{ maxWidth: 160 }} value={sort} onChange={(e) => setSort(e.target.value as "coverage")}>
        <option value="coverage">Coverage</option><option value="naive_lift_pct">Lift vs naive</option><option value="avg_width_pct">Width</option>
      </select>
    </div>
    <table className="mini"><thead><tr><th>Ticker</th><th>Coverage</th><th>Width</th><th>Lift vs naive</th><th></th></tr></thead>
      <tbody>{rows.map((r) => (
        <tr key={r.ticker}><td>{r.ticker}</td><td className={r.coverage >= 65 ? "good" : "mid"}>{r.coverage}%</td>
          <td>{r.avg_width_pct}%</td><td className={r.naive_lift_pct > 0 ? "good" : "bad"}>{r.naive_lift_pct}%</td>
          <td><button className="sg" onClick={() => { if (!g.stocks.includes(r.ticker) && g.stocks.length < 10) g.set({ stocks: [...g.stocks, r.ticker] }); }}>+ add</button></td></tr>))}</tbody></table>
  </>;
  const note = <div className="kv">Full batch held-out validation: coverage + lift vs the naive (prev-close) forecast. Lift&gt;0 = beats naive out-of-sample.</div>;
  return <PageArchetype title={`Repository — ${s.n}-stock validation`} viz={viz} data={note} control={note} adjustment={note} />;
}

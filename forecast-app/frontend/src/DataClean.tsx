import { useState, useEffect } from "react";
import { getClean, type CleanResult } from "./api";
import { useGlobal } from "./GlobalControls";
import PageArchetype from "./PageArchetype";
import Plot from "./Plot";

export default function DataClean() {
  const g = useGlobal();
  const ticker = g.stocks[0] || "MSFT";
  const [k, setK] = useState(3.0);
  const [res, setRes] = useState<CleanResult | null>(null);
  const [err, setErr] = useState<string | null>(null);

  function load(kk = k) {
    setErr(null);
    getClean(ticker, kk, g.granularity).then(setRes).catch((e) => setErr(String(e)));
  }
  useEffect(() => { load(k); }, [g.runKey]); // eslint-disable-line react-hooks/exhaustive-deps

  if (err) return <div className="err">{err}</div>;
  if (!res) return <PageArchetype title={`Data clean — ${ticker}`} viz={<div className="kv">loading…</div>} />;

  const dates = res.rows.map((r) => r.date);
  const flagged = res.rows.filter((r) => r.flag);

  const viz = (
    <>
      <div className="kv">Quarantined {res.n_quarantined} · Hampel outliers flagged {res.hampel_outliers} · Benford max-dev {res.benford.max_dev ?? "n/a"}</div>
      <Plot data={[
        { x: dates, y: res.rows.map((r) => r.close), mode: "lines", name: "close", line: { color: "#3b82f6" } },
        { x: flagged.map((r) => r.date), y: flagged.map((r) => r.close), mode: "markers", name: "Hampel flag", marker: { color: "#f87171", size: 7 } },
      ]} layout={{ yaxis: { title: "$ close" } }} />
    </>
  );
  const data = (
    <table className="mini"><thead><tr><th>Date</th><th>Close</th><th>Flag</th></tr></thead>
      <tbody>{res.rows.slice(-60).map((r) => (
        <tr key={r.date} className={r.flag ? "miss" : ""}><td>{r.date}</td><td>${r.close}</td><td>{r.flag ? "⚠ outlier" : ""}</td></tr>
      ))}</tbody></table>
  );
  const control = (
    <div>
      <div className="kv">Hampel sensitivity k = <b>{k}</b> (lower = more flags)</div>
      <input type="range" min={1.5} max={6} step={0.5} value={k}
        onChange={(e) => { const v = Number(e.target.value); setK(v); load(v); }} />
      <div className="kv">{res.hampel_outliers} outliers at k={res.k}</div>
    </div>
  );
  const adjustment = (
    <div className="kv">Outlier count vs sensitivity — lower k flags more.<br />
      Current k={res.k} → {res.hampel_outliers} flags. Move the Control slider to compare.</div>
  );

  return <PageArchetype title={`Data clean — ${ticker}`} viz={viz} data={data} control={control} adjustment={adjustment} />;
}

import { useState, useEffect } from "react";
import { getHorizons } from "./api";
import { useGlobal } from "./GlobalControls";
import PageArchetype from "./PageArchetype";

export default function MultiHorizon() {
  const g = useGlobal();
  const ticker = g.stocks[0] || "MSFT";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [d, setD] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { setErr(null); getHorizons(ticker, g.target / 100, g.granularity).then(setD).catch((e) => setErr(String(e))); }, [g.runKey]); // eslint-disable-line
  if (err) return <div className="err">{err}</div>;
  if (!d) return <PageArchetype title={`Multi-horizon — ${ticker}`} viz={<div className="kv">loading…</div>} />;
  const H = ["7d", "30d", "90d"];
  const cc = (c: number) => (c >= g.target - 5 ? "good" : "mid");
  const viz = <div className="cards">{H.map((h) => {
    const m = d.horizons[h];
    return <div key={h} className="card"><div className="clab">{h} out</div>
      <div className={`cnum ${m ? cc(m.coverage) : ""}`}>{m ? m.coverage + "%" : "–"}</div>
      <div className="clab">width {m ? m.avg_width_pct + "%" : "–"}</div></div>;
  })}</div>;
  const data = <table className="mini"><thead><tr><th>Horizon</th><th>Coverage</th><th>Width</th><th>n</th></tr></thead>
    <tbody>{H.filter((h) => d.horizons[h]).map((h) => <tr key={h}><td>{h}</td><td>{d.horizons[h].coverage}%</td><td>{d.horizons[h].avg_width_pct}%</td><td>{d.horizons[h].n}</td></tr>)}</tbody></table>;
  const note = <div className="kv">Vol-scaled bands + reversion tilt + horizon bias, calibrated leakage-free (purge/embargo). Longer horizons → wider bands.</div>;
  return <PageArchetype title={`Multi-horizon — ${ticker}`} viz={viz} data={data} control={note} adjustment={note} />;
}

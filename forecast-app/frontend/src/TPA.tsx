import { useState, useEffect } from "react";
import { getTPA } from "./api";
import { useGlobal } from "./GlobalControls";
import PageArchetype from "./PageArchetype";

export default function TPA() {
  const g = useGlobal();
  const ticker = g.stocks[0] || "MSFT";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [d, setD] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { setErr(null); getTPA(ticker, g.granularity).then(setD).catch((e) => setErr(String(e))); }, [g.runKey]); // eslint-disable-line
  if (err) return <div className="err">{err}</div>;
  if (!d) return <PageArchetype title={`TPA — ${ticker}`} viz={<div className="kv">loading…</div>} />;
  const viz = <>
    <div className="cards">
      <div className="card"><div className={`cnum ${d.significant ? "good" : "bad"}`}>{d.modifier_pct}%</div><div className="clab">threaded modifier</div></div>
      <div className="card"><div className={`cnum ${d.significant ? "good" : "bad"}`}>{d.significant ? "YES" : "NO"}</div><div className="clab">significant</div></div>
      <div className="card"><div className="cnum">{d.points}</div><div className="clab">fan points (±10%)</div></div>
      <div className="card"><div className="cnum">{d.breach_rate_pct}%</div><div className="clab">breach rate</div></div>
      <div className="card"><div className="cnum">{d.thread_autocorr}</div><div className="clab">thread autocorr</div></div>
    </div>
    {!d.significant ? <div className="kv" style={{ color: "#f0b429" }}>⚠ Thread autocorrelation ≈ {d.thread_autocorr} — winners don't connect cycle-to-cycle, so the modifier is withheld (no fake lift).</div> : null}
  </>;
  const data = <table className="mini"><thead><tr><th>Field</th><th>Value</th></tr></thead><tbody>
    <tr><td>Fan points</td><td>{d.points}</td></tr>
    <tr><td>Steps</td><td>{d.n}</td></tr>
    <tr><td>Modifier</td><td>{d.modifier_pct}%</td></tr>
    <tr><td>Significant</td><td>{String(d.significant)}</td></tr>
    <tr><td>Thread autocorr</td><td>{d.thread_autocorr}</td></tr>
    <tr><td>Breach rate</td><td>{d.breach_rate_pct}%</td></tr>
  </tbody></table>;
  const note = <div className="kv">Threaded Point Analysis: fan ±% offsets from the basis, thread the winning offset, ship the modifier ONLY if forward-significant.</div>;
  return <PageArchetype title={`TPA — ${ticker}`} viz={viz} data={data} control={note} adjustment={note} />;
}

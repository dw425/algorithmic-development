import { useState, useEffect } from "react";
import { getDiagnostics } from "./api";
import { useGlobal } from "./GlobalControls";
import PageArchetype from "./PageArchetype";

export default function Diagnostics() {
  const g = useGlobal();
  const ticker = g.stocks[0] || "MSFT";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [d, setD] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { setErr(null); getDiagnostics(ticker, g.target / 100, g.granularity).then(setD).catch((e) => setErr(String(e))); }, [g.runKey]); // eslint-disable-line
  if (err) return <div className="err">{err}</div>;
  if (!d) return <PageArchetype title={`Diagnostics — ${ticker}`} viz={<div className="kv">loading…</div>} />;
  const nr = d.net_results || {}; const cal = d.calibration || {}; const ow = d.outward || {};
  const viz = <>
    <h2>Net results (C17) — do mode / robust / consensus converge?</h2>
    <div className="cards">
      <div className="card"><div className="cnum">${nr.mode}</div><div className="clab">mode</div></div>
      <div className="card"><div className="cnum">${nr.robust_mean}</div><div className="clab">robust mean</div></div>
      <div className="card"><div className="cnum">${nr.consensus}</div><div className="clab">consensus</div></div>
      <div className="card"><div className={`cnum ${nr.convergence_pct > 99 ? "good" : "mid"}`}>{nr.convergence_pct}%</div><div className="clab">convergence</div></div>
    </div>
    <h2>Model Confidence Set (C19) — survivors</h2>
    <div className="kv">{(d.mcs_survivors || []).join(", ")} ({(d.mcs_survivors || []).length} of {d.mcs_pool})</div>
    <h2>Calibration (C20)</h2>
    <div className="cards">
      <div className="card"><div className={`cnum ${cal.calibrated ? "good" : "mid"}`}>{cal.empirical}%</div><div className="clab">empirical (target {cal.nominal}%)</div></div>
    </div>
    <h2>Outward eye (C22)</h2>
    <div className="cards">
      <div className="card"><div className={`cnum ${ow.drift?.drift ? "bad" : "good"}`}>{ow.drift?.drift ? "DRIFT" : "stable"}</div><div className="clab">Page-Hinkley</div></div>
      <div className="card"><div className="cnum">{ow.psi_recent}</div><div className="clab">PSI (shift)</div></div>
      <div className="card"><div className="cnum">{ow.vol_recent}%</div><div className="clab">recent vol</div></div>
    </div>
  </>;
  const note = <div className="kv">Combined outward-eye + selection + calibration diagnostics: net-result convergence (C17), MCS survivors (C19), coverage calibration (C20), drift/PSI (C22).</div>;
  return <PageArchetype title={`Diagnostics — ${ticker}`} viz={viz} data={note} control={note} adjustment={note} />;
}

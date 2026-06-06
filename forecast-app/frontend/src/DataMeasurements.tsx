import { useState, useEffect } from "react";
import { getForecast, type RunResult } from "./api";
import { useGlobal } from "./GlobalControls";

function Metric({ label, value, hint, cls }: { label: string; value: React.ReactNode; hint?: string; cls?: string }) {
  return (
    <div className="card" style={{ minWidth: 150 }}>
      <div className={`cnum ${cls || ""}`} style={{ fontSize: 18 }}>{value}</div>
      <div className="clab">{label}</div>
      {hint && <div style={{ fontSize: 10, color: "#6b7280", marginTop: 2 }}>{hint}</div>}
    </div>
  );
}

export default function DataMeasurements() {
  const g = useGlobal();
  const ticker = g.stocks[0] || "MSFT";
  const [r, setR] = useState<RunResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    setLoading(true); setErr(null);
    try { setR(await getForecast(ticker, g.target / 100, g.start, g.end, g.granularity)); }
    catch (e) { setErr(String(e)); }
    setLoading(false);
  }
  useEffect(() => { load(); }, [g.runKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const dq = r?.data_quality;
  const st = dq?.stationarity;

  return (
    <div>
      <h1>Data measurements — {ticker}</h1>
      <p className="sub">Every diagnostic the engine computes (first selected stock) — data quality,
        stationarity, predictability ceilings, model diversity, calibration, bias/drift audits.</p>
      {loading && <div className="kv">computing…</div>}
      {err && <div className="err">{err}</div>}

      {r && <>
        <h2>Data quality (Steps 1–3)</h2>
        <div className="cards">
          <Metric label="Quarantined rows" value={dq?.n_quarantined ?? "–"} />
          <Metric label="Hampel outliers (flagged)" value={dq?.hampel_outliers ?? "–"} />
          <Metric label="Benford max dev" value={dq?.benford?.max_dev ?? "–"} />
          <Metric label="ADF p-value" value={st?.adf_p ?? "–"} hint=">0.05 = non-stationary" />
          <Metric label="KPSS p-value" value={st?.kpss_p ?? "–"} hint="<0.05 = non-stationary" />
          <Metric label="Recommendation" value={<span style={{ fontSize: 12 }}>{st?.recommend ?? "–"}</span>} />
        </div>

        <h2>Predictability ceiling</h2>
        <div className="cards">
          <Metric label="Hurst exponent" value={r.predictability?.hurst ?? "–"}
            hint="0.5=random · >0.5 trend · <0.5 revert"
            cls={r.predictability && Math.abs(r.predictability.hurst - 0.5) > 0.05 ? "good" : "mid"} />
          <Metric label="Lyapunov (Rosenstein)" value={r.lyapunov ?? "–"} hint=">0 = chaotic/sensitive" />
          <Metric label="Forecast horizon" value={`${r.predictability?.horizon_days ?? "–"}d`} />
        </div>

        <h2>Model diversity (the ρ lever)</h2>
        <div className="cards">
          <Metric label="Mean ρ (error corr)" value={r.rho?.mean_rho ?? "–"}
            cls={r.rho && r.rho.mean_rho < 0.4 ? "good" : "bad"} hint="lower = more independent" />
          <Metric label="Effective models" value={r.rho?.effective_models ?? "–"}
            hint={`of ${r.rho?.pool ?? "?"} in pool`} />
        </div>

        <h2>Calibration & audits (outward eye)</h2>
        <div className="cards">
          <Metric label="Coverage (empirical)" value={`${r.calibration?.empirical ?? r.coverage}%`}
            cls={r.calibration?.calibrated ? "good" : "mid"} hint={`target ${r.calibration?.nominal ?? 70}%`} />
          <Metric label="O6 narrow-band hit" value={`${r.confidence_audit?.narrow_hitrate ?? "–"}%`} />
          <Metric label="O6 wide-band hit" value={`${r.confidence_audit?.wide_hitrate ?? "–"}%`} />
          <Metric label="O7 our drift" value={`${r.triangulation?.our_drift_pct ?? "–"}%`} />
          <Metric label="O7 market drift" value={`${r.triangulation?.market_drift_pct ?? "–"}%`} />
          <Metric label="O7 divergence" value={r.triangulation?.divergence_flag ? "⚠ yes" : "no"}
            cls={r.triangulation?.divergence_flag ? "bad" : "good"} />
        </div>

        <h2>Drift & risk</h2>
        <div className="cards">
          <Metric label="Drift flags (Page-Hinkley)" value={r.drift_flags ?? "–"} />
          <Metric label="Avg PSI (shift sentinel)" value={r.avg_psi ?? "–"} hint=">0.25 = shift" />
          <Metric label="Risk flags (SPC 3σ)" value={r.risk_flags ?? "–"} />
          <Metric label="Exogenous" value={<span style={{ fontSize: 11 }}>{r.exogenous ?? "–"}</span>} />
        </div>

        <h2>Cross-method point estimates</h2>
        <div className="cards">
          <Metric label="THieF reconciled" value={`$${r.thief_reconciled ?? "–"}`} hint="multi-scale" />
          <Metric label="Signal-decomp (STL)" value={`$${r.signal_decomp_next ?? "–"}`} />
        </div>
      </>}
    </div>
  );
}

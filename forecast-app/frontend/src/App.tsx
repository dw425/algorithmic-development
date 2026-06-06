import { useState } from "react";
import { runAll, runOne, runAllVectors, type RunResult, type Summary, type VSummary } from "./api";
import Walkthrough from "./Walkthrough";
import Forecast from "./Forecast";
import Constellation from "./Constellation";
import DataMeasurements from "./DataMeasurements";
import TPA from "./TPA";
import "./App.css";

export default function App() {
  const [view, setView] = useState<"forecast" | "measurements" | "tpa" | "constellation" | "summary" | "full" | "walk">("forecast");
  const [target, setTarget] = useState(70);
  const [summaries, setSummaries] = useState<Summary[]>([]);
  const [detail, setDetail] = useState<RunResult | null>(null);
  const [vsum, setVsum] = useState<VSummary[]>([]);
  const [vstatus, setVstatus] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handleFull() {
    setLoading(true); setErr(null);
    try {
      const res = await runAllVectors();
      setVsum(res.results); setVstatus(res.status || "");
    } catch (e) { setErr(String(e)); }
    setLoading(false);
  }

  async function handleRunAll() {
    setLoading(true); setErr(null); setDetail(null);
    try {
      const res = await runAll(target / 100);
      setSummaries(res.results);
    } catch (e) { setErr(String(e)); }
    setLoading(false);
  }

  async function handleDetail(ticker: string) {
    setLoading(true); setErr(null);
    try { setDetail(await runOne(ticker, target / 100)); }
    catch (e) { setErr(String(e)); }
    setLoading(false);
  }

  const covClass = (cov: number) => (cov >= target ? "good" : cov >= target - 10 ? "mid" : "bad");

  return (
    <div className="wrap">
      <h1>Range Forecast Engine</h1>
      <p className="sub">
        Trains on 2024 daily closes, walk-forward predicts the first 90 days of 2025.
        A <b>hit</b> = actual close landed inside the predicted range. Goal: ≥{target}% hits
        at the tightest width. <i>Coverage and width must always be read together.</i>
      </p>

      <div className="tabs">
        <button className={view === "forecast" ? "on" : ""} onClick={() => setView("forecast")}>
          📈 Forecast (range · accuracy · 90-day series)</button>
        <button className={view === "full" ? "on" : ""} onClick={() => setView("full")}>
          Full engine — all 10</button>
        <button className={view === "measurements" ? "on" : ""} onClick={() => setView("measurements")}>
          📊 Data measurements</button>
        <button className={view === "tpa" ? "on" : ""} onClick={() => setView("tpa")}>
          🧵 Threaded Point Analysis</button>
        <button className={view === "constellation" ? "on" : ""} onClick={() => setView("constellation")}>
          🌌 Constellation & dependency</button>
        <button className={view === "walk" ? "on" : ""} onClick={() => setView("walk")}>
          Step-by-step walkthrough</button>
        <button className={view === "summary" ? "on" : ""} onClick={() => setView("summary")}>
          Baseline (7-model)</button>
      </div>

      {view === "forecast" && <Forecast />}

      {view === "measurements" && <DataMeasurements />}

      {view === "tpa" && <TPA />}

      {view === "constellation" && <Constellation />}

      {view === "walk" && <Walkthrough />}

      {view === "full" && <>
        <p className="sub">Full pipeline: 1,800 vectors → 3D clustering consensus → debiasing →
          adaptive conformal (ACI) → risk gates. Coverage should now track the 70% target.
          Day / week / month horizons shown per stock.</p>
        <button onClick={handleFull} disabled={loading}>
          {loading ? "Loading…" : "Load full-engine results (all 10)"}</button>
        {vstatus && <div className="kv" style={{ marginTop: 10 }}>⏳ {vstatus}</div>}
        {vsum.length > 0 && (
          <table style={{ marginTop: 14 }}>
            <thead><tr><th>Ticker</th><th>Day cov</th><th>Day width</th>
              <th>Week cov</th><th>Month cov</th><th>Hurst</th><th>Risk flags</th></tr></thead>
            <tbody>
              {vsum.map((s) => (
                <tr key={s.ticker}>
                  <td className="tk">{s.ticker}</td>
                  {s.error ? <td colSpan={6} className="bad">{s.error}</td> : <>
                    <td className={s.coverage >= 67 ? "good" : s.coverage >= 60 ? "mid" : "bad"}>{s.coverage}%</td>
                    <td>{s.avg_width_pct}%</td>
                    <td>{s.multi_horizon?.week?.coverage ?? "–"}%</td>
                    <td>{s.multi_horizon?.month?.coverage ?? "–"}%</td>
                    <td>{s.predictability?.hurst ?? "–"}</td>
                    <td>{s.risk_flags ?? 0}</td>
                  </>}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </>}

      {view === "summary" && <>
      <div className="controls">
        <label>Target coverage:&nbsp;
          <select value={target} onChange={(e) => setTarget(Number(e.target.value))}>
            {[50, 60, 70, 80, 90, 95].map((t) => <option key={t} value={t}>{t}%</option>)}
          </select>
        </label>
        <button onClick={handleRunAll} disabled={loading}>
          {loading ? "Running…" : "Run all 10 stocks"}
        </button>
      </div>

      {err && <div className="err">{err}</div>}

      {summaries.length > 0 && (
        <>
          <h2>Summary — coverage vs width per stock</h2>
          <table>
            <thead>
              <tr><th>Ticker</th><th>Eval days</th><th>Coverage</th>
                <th>Target</th><th>Avg width</th><th></th></tr>
            </thead>
            <tbody>
              {summaries.map((s) => (
                <tr key={s.ticker}>
                  <td className="tk">{s.ticker}</td>
                  {s.error ? <td colSpan={5} className="bad">{s.error}</td> : <>
                    <td>{s.n_eval}</td>
                    <td className={covClass(s.coverage)}>{s.coverage}%</td>
                    <td>{s.target}%</td>
                    <td>{s.avg_width_pct}%</td>
                    <td><button className="link" onClick={() => handleDetail(s.ticker)}>
                      view 90-day table →</button></td>
                  </>}
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {detail && (
        <>
          <h2>{detail.ticker} — forecast range vs actual (first 90 days 2025)</h2>
          <div className="badges">
            <span className={covClass(detail.coverage)}>
              Coverage {detail.coverage}% (target {detail.target}%)</span>
            <span>Avg width {detail.avg_width_pct}%</span>
            <span>{detail.n_eval} days</span>
          </div>

          <div className="weights">
            <b>Learned ensemble weights (from 2024):</b>{" "}
            {Object.entries(detail.weights)
              .sort((a, b) => b[1] - a[1])
              .map(([m, w]) => <span key={m} className="chip">{m} {(w * 100).toFixed(1)}%</span>)}
          </div>

          <table className="detail">
            <thead>
              <tr><th>Date</th><th>Forecast range</th><th>Point</th>
                <th>Actual</th><th>Result</th><th>Width</th></tr>
            </thead>
            <tbody>
              {detail.rows.map((r) => (
                <tr key={r.date} className={r.hit ? "" : "miss"}>
                  <td>{r.date}</td>
                  <td>${r.lo.toFixed(2)} – ${r.hi.toFixed(2)}</td>
                  <td>${r.pred.toFixed(2)}</td>
                  <td>${r.actual.toFixed(2)}</td>
                  <td className={r.hit ? "good" : "bad"}>{r.hit ? "✓ hit" : "✗ miss"}</td>
                  <td>{r.width_pct.toFixed(2)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
      </>}
    </div>
  );
}

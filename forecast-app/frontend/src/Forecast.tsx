import { useState, useEffect } from "react";
import { getForecast, getHorizons, type RunResult, type HorizonsResult, TICKERS } from "./api";
import Plot from "./Plot";

const HZ = ["7d", "30d", "90d"];

export default function Forecast() {
  const [ticker, setTicker] = useState("MSFT");
  const [target, setTarget] = useState(70);
  const [fc, setFc] = useState<RunResult | null>(null);
  const [hz, setHz] = useState<HorizonsResult | null>(null);
  const [horizon, setHorizon] = useState("30d");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function load(t = ticker, tg = target) {
    setLoading(true); setErr(null);
    try {
      const [a, b] = await Promise.all([getForecast(t, tg / 100), getHorizons(t, tg / 100)]);
      setFc(a); setHz(b);
    } catch (e) { setErr(String(e)); }
    setLoading(false);
  }
  useEffect(() => { load("MSFT", 70); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const rows = fc?.rows ?? [];
  const dates = rows.map((r) => r.date);
  const last = rows[rows.length - 1];
  const hser = hz?.series?.[horizon] ?? [];
  const covCls = (c: number) => (c >= target ? "good" : c >= target - 8 ? "mid" : "bad");

  return (
    <div>
      <div className="controls">
        <label>Stock:&nbsp;
          <select value={ticker} onChange={(e) => { setTicker(e.target.value); load(e.target.value, target); }}>
            {TICKERS.map((t) => <option key={t}>{t}</option>)}
          </select></label>
        <label>Prediction range (target coverage):&nbsp;
          <select value={target} onChange={(e) => { const v = Number(e.target.value); setTarget(v); load(ticker, v); }}>
            {[50, 60, 70, 80, 90, 95].map((t) => <option key={t} value={t}>{t}%</option>)}
          </select></label>
        {loading && <span className="kv">computing…</span>}
      </div>
      {err && <div className="err">{err}</div>}

      {fc && <>
        {/* ---- headline accuracy cards ---- */}
        <div className="cards">
          <div className="card"><div className="cnum">{fc.coverage}%</div><div className="clab">1-day accuracy (coverage)</div></div>
          <div className="card"><div className="cnum">{fc.avg_width_pct}%</div><div className="clab">avg range width</div></div>
          {last && <div className="card"><div className="cnum">${last.lo}–${last.hi}</div><div className="clab">latest predicted range</div></div>}
          {fc.predictability && <div className="card"><div className="cnum">{fc.predictability.hurst}</div><div className="clab">Hurst ({fc.predictability.label.split("—")[0].trim()})</div></div>}
          {fc.risk_flags !== undefined && <div className="card"><div className="cnum">{fc.risk_flags}</div><div className="clab">drift / risk flags</div></div>}
        </div>

        {/* ---- multi-horizon accuracy 7/30/90 ---- */}
        {hz && <>
          <h2>Forecast accuracy at 7 / 30 / 90 days out</h2>
          <div className="cards">
            {HZ.map((h) => {
              const m = hz.horizons[h];
              return <div key={h} className={`card sel ${horizon === h ? "on" : ""}`} onClick={() => setHorizon(h)}>
                <div className="clab">{h} out</div>
                <div className={`cnum ${m ? covCls(m.coverage) : ""}`}>{m ? m.coverage + "%" : "–"}</div>
                <div className="clab">width {m ? m.avg_width_pct + "%" : "–"}</div>
              </div>;
            })}
          </div>
        </>}

        {/* ---- 1-day forecast chart ---- */}
        <h2>{fc.ticker} — 1-day forecast range vs actual (90-day backtest)</h2>
        <Plot height={420} data={[
          { x: dates, y: rows.map((r) => r.hi), mode: "lines", line: { width: 0 }, showlegend: false, hoverinfo: "skip" },
          { x: dates, y: rows.map((r) => r.lo), name: `${fc.target}% range`, mode: "lines", line: { width: 0 }, fill: "tonexty", fillcolor: "rgba(59,130,246,0.18)" },
          { x: dates, y: rows.map((r) => r.pred), name: "forecast", mode: "lines", line: { color: "#3b82f6", width: 2 } },
          { x: dates, y: rows.map((r) => r.actual), name: "actual", mode: "lines+markers", line: { color: "#34d399", width: 1.5 }, marker: { size: 3 } },
        ]} layout={{ yaxis: { title: "$ close" } }} />

        {/* ---- selected horizon chart ---- */}
        {hser.length > 0 && <>
          <h2>{horizon}-out forecast: predicted range vs eventual actual</h2>
          <Plot height={380} data={[
            { x: hser.map((r) => r.target_date), y: hser.map((r) => r.hi), mode: "lines", line: { width: 0 }, showlegend: false, hoverinfo: "skip" },
            { x: hser.map((r) => r.target_date), y: hser.map((r) => r.lo), name: `${horizon} ${target}% range`, mode: "lines", line: { width: 0 }, fill: "tonexty", fillcolor: "rgba(240,180,41,0.16)" },
            { x: hser.map((r) => r.target_date), y: hser.map((r) => r.pred), name: "forecast", mode: "lines", line: { color: "#f0b429", width: 2 } },
            { x: hser.map((r) => r.target_date), y: hser.map((r) => r.actual), name: "actual", mode: "lines+markers", line: { color: "#34d399", width: 1.5 }, marker: { size: 3 } },
          ]} layout={{ yaxis: { title: "$ close" } }} />
        </>}

        {/* ---- full data table for the selected horizon ---- */}
        {hser.length > 0 && <>
          <h2>{horizon}-out data — made-on date → target date, range vs actual ({hser.length} rows)</h2>
          <table className="detail">
            <thead><tr><th>Forecast made</th><th>Target date</th><th>Predicted range</th><th>Point</th><th>Actual</th><th>Result</th></tr></thead>
            <tbody>
              {hser.map((r, i) => (
                <tr key={i} className={r.hit ? "" : "miss"}>
                  <td>{r.date}</td><td>{r.target_date}</td>
                  <td>${r.lo.toFixed(2)} – ${r.hi.toFixed(2)}</td>
                  <td>${r.pred.toFixed(2)}</td><td>${r.actual.toFixed(2)}</td>
                  <td className={r.hit ? "good" : "bad"}>{r.hit ? "✓ hit" : "✗ miss"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>}

        {/* ---- full 1-day data table ---- */}
        <h2>1-day data — full 90-day series ({rows.length} rows)</h2>
        <table className="detail">
          <thead><tr><th>Date</th><th>Predicted range</th><th>Point</th><th>Actual</th><th>Result</th><th>Width</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.date} className={r.hit ? "" : "miss"}>
                <td>{r.date}</td>
                <td>${r.lo.toFixed(2)} – ${r.hi.toFixed(2)}</td>
                <td>${r.pred.toFixed(2)}</td><td>${r.actual.toFixed(2)}</td>
                <td className={r.hit ? "good" : "bad"}>{r.hit ? "✓" : "✗"}</td>
                <td>{r.width_pct.toFixed(2)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </>}
    </div>
  );
}

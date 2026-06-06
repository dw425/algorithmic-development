import { useState, useEffect } from "react";
import { getForecast, type RunResult } from "./api";
import { useGlobal } from "./GlobalControls";
import Plot from "./Plot";

const COLORS = ["#3b82f6", "#34d399", "#f0b429", "#f87171", "#a78bfa", "#22d3ee", "#fb923c", "#e879f9", "#60a5fa", "#4ade80"];

export default function Forecast() {
  const g = useGlobal();
  const [results, setResults] = useState<Record<string, RunResult>>({});
  const [focus, setFocus] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    if (!g.stocks.length) return;
    setLoading(true); setErr(null);
    try {
      const out: Record<string, RunResult> = {};
      await Promise.all(g.stocks.map(async (t) => {
        out[t] = await getForecast(t, g.target / 100, g.start, g.end, g.granularity);
      }));
      setResults(out); setFocus(g.stocks[0]);
    } catch (e) { setErr(String(e)); }
    setLoading(false);
  }
  useEffect(() => { load(); }, [g.runKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const tickers = Object.keys(results);
  const covCls = (c: number) => (c >= g.target ? "good" : c >= g.target - 8 ? "mid" : "bad");

  // normalized (rebased to 100) actual close overlay across all selected stocks
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const overlay: any[] = tickers.map((t, i) => {
    const rows = results[t].rows;
    const base = rows[0]?.actual || 1;
    return { x: rows.map((r) => r.date), y: rows.map((r) => (r.actual / base) * 100),
      name: t, mode: "lines", line: { color: COLORS[i % COLORS.length], width: 1.6 } };
  });

  const fr = focus ? results[focus] : null;

  return (
    <div>
      <h1>Forecast — {tickers.length} stock{tickers.length !== 1 ? "s" : ""} · range + accuracy + 90-day series</h1>
      <p className="sub">Multi-stock. Pick stocks/date/granularity/target on the left, hit <b>Apply</b>.
        A hit = actual landed in the predicted range. Coverage & width read together.</p>
      {loading && <div className="kv">computing {g.stocks.length} forecasts…</div>}
      {err && <div className="err">{err}</div>}

      {tickers.length > 0 && <>
        <h2>Accuracy across selected stocks</h2>
        <table>
          <thead><tr><th>Ticker</th><th>Coverage</th><th>Width</th><th>Drift</th><th></th></tr></thead>
          <tbody>
            {tickers.map((t) => (
              <tr key={t} className={focus === t ? "miss" : ""}>
                <td className="tk">{t}</td>
                <td className={covCls(results[t].coverage)}>{results[t].coverage}%</td>
                <td>{results[t].avg_width_pct}%</td>
                <td>{results[t].rows.length ? (((results[t].rows.at(-1)!.actual / results[t].rows[0].actual) - 1) * 100).toFixed(1) : "–"}%</td>
                <td><button className="link" onClick={() => setFocus(t)}>focus →</button></td>
              </tr>
            ))}
          </tbody>
        </table>

        <h2>How the selected stocks performed (actual close, rebased to 100)</h2>
        <Plot height={380} data={overlay} layout={{ yaxis: { title: "indexed (start=100)" } }} />

        {fr && <>
          <h2>{focus} — forecast range vs actual</h2>
          <div className="badges">
            <span className={covCls(fr.coverage)}>Coverage {fr.coverage}%</span>
            <span>Width {fr.avg_width_pct}%</span>
            {fr.predictability && <span>Hurst {fr.predictability.hurst}</span>}
          </div>
          <Plot height={380} data={[
            { x: fr.rows.map((r) => r.date), y: fr.rows.map((r) => r.hi), mode: "lines", line: { width: 0 }, showlegend: false, hoverinfo: "skip" },
            { x: fr.rows.map((r) => r.date), y: fr.rows.map((r) => r.lo), name: `${fr.target}% range`, mode: "lines", line: { width: 0 }, fill: "tonexty", fillcolor: "rgba(59,130,246,0.18)" },
            { x: fr.rows.map((r) => r.date), y: fr.rows.map((r) => r.pred), name: "forecast", mode: "lines", line: { color: "#3b82f6", width: 2 } },
            { x: fr.rows.map((r) => r.date), y: fr.rows.map((r) => r.actual), name: "actual", mode: "lines+markers", line: { color: "#34d399", width: 1.5 }, marker: { size: 3 } },
          ]} layout={{ yaxis: { title: "$ close" } }} />
        </>}
      </>}
    </div>
  );
}

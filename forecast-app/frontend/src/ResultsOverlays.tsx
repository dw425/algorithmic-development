import { useState, useEffect } from "react";
import { getForecast, type RunResult } from "./api";
import { useGlobal } from "./GlobalControls";
import Plot from "./Plot";

const COLORS = ["#3b82f6", "#34d399", "#f0b429", "#f87171", "#a78bfa", "#22d3ee", "#fb923c", "#e879f9", "#60a5fa", "#4ade80"];
const METRICS = [
  { id: "rolling_acc", label: "Rolling accuracy (21d)" },
  { id: "cum_err", label: "Cumulative drift (signed error)" },
  { id: "price", label: "Actual price (rebased 100)" },
  { id: "width", label: "Band width %" },
];

export default function ResultsOverlays() {
  const g = useGlobal();
  const [res, setRes] = useState<Record<string, RunResult>>({});
  const [metric, setMetric] = useState("rolling_acc");
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
      setRes(out);
    } catch (e) { setErr(String(e)); }
    setLoading(false);
  }
  useEffect(() => { load(); }, [g.runKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const tickers = Object.keys(res);
  function series(t: string): number[] {
    const rows = res[t].rows;
    if (metric === "rolling_acc") {
      const hit = rows.map((r) => (r.hit ? 1 : 0));
      const w = 21, out: number[] = [];
      for (let i = w; i <= hit.length; i++) out.push(hit.slice(i - w, i).reduce((a, b) => a + b, 0) / w * 100);
      return out;
    }
    if (metric === "cum_err") {
      let c = 0; return rows.map((r) => { c += (r.actual - r.pred) / r.pred * 100; return c; });
    }
    if (metric === "price") { const b = rows[0]?.actual || 1; return rows.map((r) => r.actual / b * 100); }
    return rows.map((r) => r.width_pct);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const traces: any[] = tickers.map((t, i) => ({
    x: series(t).map((_, j) => j), y: series(t), name: t, mode: "lines",
    line: { color: COLORS[i % COLORS.length], width: 1.6 },
  }));

  return (
    <div>
      <h1>Results overlays — {tickers.length} stocks</h1>
      <p className="sub">Bundled end-to-end comparison across up to 10 selected stocks. Pick the
        metric to overlay; adjust stocks / date / granularity on the left.</p>
      <div className="controls">
        <label>Overlay metric:&nbsp;
          <select value={metric} onChange={(e) => setMetric(e.target.value)}>
            {METRICS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select></label>
        {loading && <span className="kv">computing…</span>}
      </div>
      {err && <div className="err">{err}</div>}

      {tickers.length > 0 && <>
        <Plot height={460} data={traces} layout={{
          yaxis: { title: METRICS.find((m) => m.id === metric)?.label || "" },
          xaxis: { title: "step" },
          ...(metric === "rolling_acc" ? { shapes: [{ type: "line", x0: 0, x1: 1, xref: "paper",
            y0: g.target, y1: g.target, line: { color: "#f0b429", dash: "dash", width: 1 } }] } : {}),
        }} />

        <h2>End-to-end summary (all selected)</h2>
        <table>
          <thead><tr><th>Ticker</th><th>Coverage</th><th>Width</th><th>Hurst</th><th>ρ eff-models</th><th>Drift flags</th></tr></thead>
          <tbody>
            {tickers.map((t) => (
              <tr key={t}><td className="tk">{t}</td>
                <td className={res[t].coverage >= g.target ? "good" : "mid"}>{res[t].coverage}%</td>
                <td>{res[t].avg_width_pct}%</td>
                <td>{res[t].predictability?.hurst ?? "–"}</td>
                <td>{res[t].rho?.effective_models ?? "–"}</td>
                <td>{res[t].drift_flags ?? "–"}</td></tr>
            ))}
          </tbody>
        </table>
      </>}
    </div>
  );
}

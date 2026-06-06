import { useState, useEffect } from "react";
import { getWalkthrough, type Walkthrough } from "./api";
import { useGlobal } from "./GlobalControls";

// compact one-line summary of each phase's key numbers
function summarize(key: string, ph: Record<string, unknown>): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p: any = ph[key];
  if (!p) return "—";
  switch (key) {
    case "chaos": return `Hurst ${p.hurst} · ${p.label}`;
    case "inverse_drift": return `${p.coherence_pct}% coherent, lean ${p.lean}`;
    case "net_results": return `mode ${p.mode} / robust ${p.robust_mean} / consensus ${p.consensus} · conv ${p.convergence_pct}%`;
    case "cloud": return `${p.n} vectors, $${p.min}–$${p.max}`;
    case "consensus": return `${p.pct}% consensus → $${p.forecast}`;
    case "mahalanobis": return `concentration ${p.concentration_pct}%`;
    case "constellation": return `MST ${p.path_len} · Davies–Bouldin ${p.davies_bouldin}`;
    case "cluster": return `KMeans ${p.kmeans_k} · DBSCAN ${p.dbscan_k} · GMM ${p.gmm_k}`;
    case "funnel": return p.map((s: { count: number }) => s.count).join(" → ");
    case "range": return `$${p.lo}–$${p.hi} (w ${p.width_pct}%)`;
    case "result": return p.hit ? `✓ HIT  $${p.lo}–$${p.hi} vs $${p.actual}` : `✗ MISS  $${p.lo}–$${p.hi} vs $${p.actual}`;
    default: return JSON.stringify(p).slice(0, 80);
  }
}

const STEPS = ["input", "chaos", "cloud", "embed", "standardize", "cluster", "consensus",
  "inverse_drift", "mahalanobis", "constellation", "net_results", "funnel", "range", "result"];

export default function Telemetry() {
  const g = useGlobal();
  const ticker = g.stocks[0] || "MSFT";
  const [wt, setWt] = useState<Walkthrough | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    setLoading(true); setErr(null);
    try { setWt(await getWalkthrough(ticker, g.target / 100)); }
    catch (e) { setErr(String(e)); }
    setLoading(false);
  }
  useEffect(() => { load(); }, [g.runKey]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div>
      <h1>Telemetry — experiment snapshots ({ticker})</h1>
      <p className="sub">Every pipeline step's key numbers in snapshot form, in order — walk the
        whole experiment at a glance. (First selected stock; forecasting {wt?.date}.)</p>
      {loading && <div className="kv">computing…</div>}
      {err && <div className="err">{err}</div>}
      {wt && (
        <div className="cards" style={{ flexDirection: "column", gap: 6 }}>
          {STEPS.map((k, i) => (
            <div key={k} className="card" style={{ width: "100%", display: "flex", gap: 14, alignItems: "baseline" }}>
              <span className="chip on" style={{ minWidth: 28, textAlign: "center" }}>{i + 1}</span>
              <b style={{ minWidth: 130, textTransform: "capitalize" }}>{k.replace("_", " ")}</b>
              <span className="kv" style={{ margin: 0 }}>{summarize(k, wt.phases)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

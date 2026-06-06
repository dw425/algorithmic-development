import { useState } from "react";
import { getWalkthrough, type Walkthrough as WT, type Pt, TICKERS } from "./api";
import Plot from "./Plot";

const COLORS = ["#3b82f6", "#34d399", "#f0b429", "#f87171", "#a78bfa", "#22d3ee", "#fb923c"];

const PHASES = [
  ["input", "1 · Input data", "Recent daily closes feeding the forecast for the target day."],
  ["chaos", "2 · Chaos ceiling", "Hurst exponent → how forecastable is this series at all?"],
  ["cloud", "3 · Vector cloud", "1,800 estimates: 10 models × 12 lookbacks × 5 scales × 3 points."],
  ["embed", "4 · 3D embedding", "Each vector placed at (x=reach, y=value, z=drift). Raw positions."],
  ["standardize", "5 · Standardize", "Z-score each axis so mixed units are comparable (the §6B fix)."],
  ["cluster", "6 · Clustering ×3", "Three different algorithms group the cloud independently."],
  ["consensus", "7 · Consensus", "Vectors in the densest cluster of ≥2 of 3 methods → the forecast."],
  ["inverse_drift", "8 · Inverse-drift", "Directional lean of out-of-scope vectors = shared-bias flag."],
  ["mahalanobis", "9 · Mahalanobis", "Covariance-aware concentration of the cloud around its center."],
  ["constellation", "10 · Constellation", "Cluster centroids + MST path length + Davies–Bouldin separation."],
  ["net_results", "11 · Net results", "Mode vs robust-mean vs consensus — do the three converge?"],
  ["funnel", "12 · Funnel", "Vector drop-off through the refinement stages — where predictions get dropped."],
  ["range", "13 · Range (conformal)", "Calibrate band width on recent residuals to the target coverage."],
  ["result", "14 · Result", "Predicted range vs the actual close — hit or miss."],
] as const;

function clusterTraces(pts: Pt[], key: "km" | "gm" | "db") {
  const groups: Record<string, Pt[]> = {};
  pts.forEach((p) => { const l = String(p[key]); (groups[l] ??= []).push(p); });
  return Object.entries(groups).map(([l, arr]) => ({
    type: "scatter3d", mode: "markers",
    name: l === "-1" ? "noise" : `cluster ${l}`,
    x: arr.map((p) => p.reach), y: arr.map((p) => p.val), z: arr.map((p) => p.drift),
    marker: { size: 2.5, color: l === "-1" ? "#555" : COLORS[(+l + 1) % COLORS.length] },
  }));
}

const SCENE = {
  scene: {
    xaxis: { title: "reach (days)", color: "#8b93a7" },
    yaxis: { title: "value ($)", color: "#8b93a7" },
    zaxis: { title: "drift (%)", color: "#8b93a7" },
    bgcolor: "#151823",
  },
};

export default function Walkthrough() {
  const [ticker, setTicker] = useState("MSFT");
  const [target, setTarget] = useState(70);
  const [wt, setWt] = useState<WT | null>(null);
  const [phase, setPhase] = useState(0);
  const [method, setMethod] = useState<"km" | "gm" | "db">("km");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    setLoading(true); setErr(null);
    try { setWt(await getWalkthrough(ticker, target / 100)); setPhase(0); }
    catch (e) { setErr(String(e)); }
    setLoading(false);
  }

  function render() {
    if (!wt) return null;
    const ph = wt.phases;
    const key = PHASES[phase][0];

    if (key === "input") {
      const p = ph.input;
      return <Plot data={[{
        type: "scatter", mode: "lines", name: "close", x: p.dates, y: p.prices,
        line: { color: "#3b82f6" },
      }]} layout={{ yaxis: { title: "$" } }} />;
    }
    if (key === "cloud") {
      const c = ph.cloud;
      const centers = c.hist_edges.slice(0, -1).map((e: number, i: number) => (e + c.hist_edges[i + 1]) / 2);
      return <>
        <div className="kv">1,800 vectors · range ${c.min} – ${c.max}</div>
        <Plot data={[
          { type: "bar", x: centers, y: c.hist_counts, name: "vector values", marker: { color: "#3b82f6" } },
          { type: "scatter", mode: "lines", name: "prev close", x: [wt.prev_close, wt.prev_close], y: [0, Math.max(...c.hist_counts)], line: { color: "#f0b429", dash: "dot" } },
          { type: "scatter", mode: "lines", name: "actual", x: [wt.actual, wt.actual], y: [0, Math.max(...c.hist_counts)], line: { color: "#34d399" } },
        ]} layout={{ xaxis: { title: "predicted next-day value ($)" }, yaxis: { title: "# vectors" } }} />
      </>;
    }
    if (key === "embed") {
      return <>
        <div className="kv">Each of the 1,800 vectors as a point in (reach, value, drift). Drag to rotate.</div>
        <Plot height={460} data={[{
          type: "scatter3d", mode: "markers", name: "vectors",
          x: wt.points.map((p) => p.reach), y: wt.points.map((p) => p.val), z: wt.points.map((p) => p.drift),
          marker: { size: 2.5, color: "#6ea8fe", opacity: 0.7 },
        }]} layout={SCENE} />
      </>;
    }
    if (key === "chaos") {
      const c = ph.chaos;
      return <div className="kv big">
        Hurst exponent: <b>{c.hurst}</b> (0.5 = random walk · &gt;0.5 trending · &lt;0.5 mean-reverting)<br />
        <span className={c.hurst > 0.55 || c.hurst < 0.45 ? "good" : "mid"}>{c.label}</span><br />
        Rough predictability horizon: ~{c.horizon_days} days
      </div>;
    }
    if (key === "inverse_drift") {
      const d = ph.inverse_drift;
      return <div className="kv big">
        Out-of-scope vectors: <b>{d.n_outside}</b><br />
        Directional coherence: <b>{d.coherence_pct}%</b> · leaning <b>{d.lean}</b> ({Math.round(d.up_fraction * 100)}% above consensus)<br />
        <span className={d.coherence_pct > 70 ? "mid" : "good"}>
          {d.coherence_pct > 70
            ? "⚠ coherent lean — possible shared bias (the outward eye should check this against reality)"
            : "scattered dissent — looks like noise, not bias"}</span>
      </div>;
    }
    if (key === "funnel") {
      const f = ph.funnel;
      return <>
        <div className="kv">From {f[0].count} generated vectors down to the final point — the
          refinement drop-off.</div>
        <Plot height={420} data={[{
          type: "funnel", y: f.map((s: { stage: string }) => s.stage),
          x: f.map((s: { count: number }) => s.count),
          textinfo: "value+percent initial",
          marker: { color: ["#3b82f6", "#22d3ee", "#34d399", "#f0b429", "#f87171"] },
        }]} layout={{ margin: { l: 220, r: 16, t: 10, b: 20 } }} />
      </>;
    }
    if (key === "net_results") {
      const nr = ph.net_results;
      return <>
        <table className="mini"><thead><tr><th>method</th><th>value</th></tr></thead><tbody>
          <tr><td>Largest cluster (mode)</td><td>${nr.mode}</td></tr>
          <tr><td>Robust trimmed mean</td><td>${nr.robust_mean}</td></tr>
          <tr><td>Consensus</td><td>${nr.consensus}</td></tr>
        </tbody></table>
        <div className="kv" style={{ marginTop: 10 }}>
          Convergence: <b>{nr.convergence_pct}%</b> —{" "}
          <span className={nr.agree ? "good" : "bad"}>
            {nr.agree ? "the three agree → trustworthy" : "they diverge → risk flag (§6E)"}</span>
        </div>
      </>;
    }
    if (key === "standardize") {
      const s = ph.standardize;
      return <table className="mini"><thead><tr><th>axis</th><th>mean</th><th>std</th></tr></thead><tbody>
        {["reach", "value", "drift"].map((a, i) => <tr key={a}><td>{a}</td><td>{s.mean[i]}</td><td>{s.std[i]}</td></tr>)}
      </tbody></table>;
    }
    if (key === "cluster") {
      return <>
        <div className="seg">
          {(["km", "gm", "db"] as const).map((m) => (
            <button key={m} className={method === m ? "on" : ""} onClick={() => setMethod(m)}>
              {m === "km" ? "KMeans" : m === "gm" ? "GaussianMixture" : "DBSCAN"}</button>
          ))}
        </div>
        <div className="kv">clusters → KMeans {ph.cluster.kmeans_k} · DBSCAN {ph.cluster.dbscan_k} · GMM {ph.cluster.gmm_k}</div>
        <Plot height={460} data={clusterTraces(wt.points, method)} layout={SCENE} />
      </>;
    }
    if (key === "consensus") {
      const yes = wt.points.filter((p) => p.consensus), no = wt.points.filter((p) => !p.consensus);
      return <>
        <div className="kv">consensus {ph.consensus.pct}% of vectors · forecast = <b>${ph.consensus.forecast}</b></div>
        <Plot height={460} data={[
          { type: "scatter3d", mode: "markers", name: "consensus", x: yes.map((p) => p.reach), y: yes.map((p) => p.val), z: yes.map((p) => p.drift), marker: { size: 3, color: "#34d399" } },
          { type: "scatter3d", mode: "markers", name: "outside", x: no.map((p) => p.reach), y: no.map((p) => p.val), z: no.map((p) => p.drift), marker: { size: 2, color: "#444" } },
        ]} layout={SCENE} />
      </>;
    }
    if (key === "mahalanobis") {
      const m = ph.mahalanobis;
      return <div className="kv big">Concentration within 1σ ellipsoid: <b>{m.concentration_pct}%</b><br />
        Median Mahalanobis distance: {m.median_dist}</div>;
    }
    if (key === "constellation") {
      const c = ph.constellation;
      const cents = c.centroids;
      const edgeTraces = c.edges.map((e: number[], i: number) => ({
        type: "scatter3d", mode: "lines", showlegend: false,
        x: [cents[e[0]].reach, cents[e[1]].reach], y: [cents[e[0]].val, cents[e[1]].val],
        z: [cents[e[0]].drift, cents[e[1]].drift], line: { color: "#f0b429", width: 3 }, name: `edge${i}`,
      }));
      return <>
        <div className="kv">MST path length <b>{c.path_len}</b> · Davies–Bouldin <b>{c.davies_bouldin}</b> (lower = better separated)</div>
        <Plot height={460} data={[
          { type: "scatter3d", mode: "markers+text", name: "centroids",
            x: cents.map((p: { reach: number }) => p.reach), y: cents.map((p: { val: number }) => p.val), z: cents.map((p: { drift: number }) => p.drift),
            text: cents.map((_: unknown, i: number) => `C${i}`), marker: { size: 6, color: "#3b82f6" } },
          ...edgeTraces,
        ]} layout={SCENE} />
      </>;
    }
    if (key === "range") {
      const r = ph.range;
      return <div className="kv big">
        Forecast point: <b>${r.forecast}</b><br />
        Conformal offsets (recent {r.n_calib} days): {r.qlo_pct}% / +{r.qhi_pct}%<br />
        Range: <b>${r.lo} – ${r.hi}</b> · width {r.width_pct}%
      </div>;
    }
    if (key === "result") {
      const r = ph.result;
      return <div className={`result ${r.hit ? "good" : "bad"}`}>
        <div>Predicted range <b>${r.lo} – ${r.hi}</b></div>
        <div>Actual close <b>${r.actual}</b></div>
        <div className="verdict">{r.hit ? "✓ HIT — actual landed in range" : "✗ MISS — actual outside range"}</div>
      </div>;
    }
    return null;
  }

  return (
    <div>
      <div className="controls">
        <label>Stock:&nbsp;
          <select value={ticker} onChange={(e) => setTicker(e.target.value)}>
            {TICKERS.map((t) => <option key={t}>{t}</option>)}
          </select></label>
        <label>Target:&nbsp;
          <select value={target} onChange={(e) => setTarget(Number(e.target.value))}>
            {[50, 60, 70, 80, 90].map((t) => <option key={t} value={t}>{t}%</option>)}
          </select></label>
        <button onClick={load} disabled={loading}>{loading ? "Computing 1,800 vectors…" : "Load walkthrough"}</button>
      </div>
      {err && <div className="err">{err}</div>}

      {wt && <>
        <div className="wt-head">
          {wt.ticker} · forecasting {wt.date} · prev close ${wt.prev_close} · actual ${wt.actual}
        </div>
        <div className="stepper">
          {PHASES.map(([k, title], i) => (
            <button key={k} className={`step ${i === phase ? "active" : ""}`} onClick={() => setPhase(i)}>
              {title}
            </button>
          ))}
        </div>
        <div className="panel">
          <h3>{PHASES[phase][1]}</h3>
          <p className="pdesc">{PHASES[phase][2]}</p>
          {render()}
          <div className="navbtns">
            <button disabled={phase === 0} onClick={() => setPhase(phase - 1)}>← prev</button>
            <button disabled={phase === PHASES.length - 1} onClick={() => setPhase(phase + 1)}>next →</button>
          </div>
        </div>
      </>}
    </div>
  );
}

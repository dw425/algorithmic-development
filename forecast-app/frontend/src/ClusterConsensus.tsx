import { useState, useEffect } from "react";
import { getGeo } from "./api";
import { useGlobal } from "./GlobalControls";
import PageArchetype from "./PageArchetype";
import Plot from "./Plot";

const PAL = ["#3b82f6", "#34d399", "#f0b429", "#f87171", "#a78bfa", "#22d3ee"];

export default function ClusterConsensus() {
  const g = useGlobal();
  const ticker = g.stocks[0] || "MSFT";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [d, setD] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { setErr(null); getGeo(ticker, g.granularity).then(setD).catch((e) => setErr(String(e))); }, [g.runKey]); // eslint-disable-line
  if (err) return <div className="err">{err}</div>;
  if (!d || !d.points) return <PageArchetype title={`Cluster consensus — ${ticker}`} viz={<div className="kv">loading…</div>} />;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pts = d.points as any[];
  const clusters = [...new Set(pts.map((p) => p.cluster))];
  const viz = <>
    <div className="kv">consensus <b>{d.consensus_pct}%</b> → forecast <b>${d.forecast}</b> · Mahalanobis {d.mahalanobis_pct}% · constellation MST {d.constellation_len} · Davies–Bouldin {d.davies_bouldin}</div>
    <Plot height={480} data={clusters.map((c) => {
      const m = pts.filter((p) => p.cluster === c);
      return { type: "scatter3d", mode: "markers", name: `cluster ${c}`,
        x: m.map((p) => p.x), y: m.map((p) => p.y), z: m.map((p) => p.z),
        marker: { size: 2.5, color: PAL[(c as number) % PAL.length] } };
    })} layout={{ scene: { xaxis: { title: "reach" }, yaxis: { title: "value $" }, zaxis: { title: "drift %" }, bgcolor: "#151823" } }} />
  </>;
  const data = <table className="mini"><thead><tr><th>Metric</th><th>Value</th></tr></thead><tbody>
    <tr><td>Consensus %</td><td>{d.consensus_pct}%</td></tr>
    <tr><td>Forecast</td><td>${d.forecast}</td></tr>
    <tr><td>Mahalanobis concentration</td><td>{d.mahalanobis_pct}%</td></tr>
    <tr><td>Constellation MST length</td><td>{d.constellation_len}</td></tr>
    <tr><td>Davies–Bouldin</td><td>{d.davies_bouldin}</td></tr>
    <tr><td>Clusters (KMeans/DBSCAN/GMM)</td><td>{d.n_clusters.kmeans}/{d.n_clusters.dbscan}/{d.n_clusters.gmm}</td></tr>
  </tbody></table>;
  const note = <div className="kv">1,980 vectors embedded in 3D (reach/value/drift), clustered 3 ways; consensus = densest cluster of ≥2 methods → the forecast.</div>;
  return <PageArchetype title={`Cluster consensus — ${ticker}`} viz={viz} data={data} control={note} adjustment={note} />;
}

import { useEffect, useState } from "react";
import { api, fmt, type AlgoInfo, type ClusterChunk, type SearchHit } from "../api";
import { HBars, Bars } from "../charts";

interface AlgoSummary {
  info: AlgoInfo;
  chunks: ClusterChunk[];
  nClusters: number;
  avgCohesion: number;
  avgCoupling: number;
  largest: number;
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);

export default function AlgorithmLab({ onOpen }: { onOpen: (i: number) => void }) {
  const [summaries, setSummaries] = useState<AlgoSummary[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [openCluster, setOpenCluster] = useState<number | null>(null);
  const [members, setMembers] = useState<{ meta: ClusterChunk; members: SearchHit[] } | null>(null);
  const [membersLoading, setMembersLoading] = useState(false);

  useEffect(() => {
    let live = true;
    api.algorithms().then(async ({ algorithms }) => {
      const computed = algorithms.filter(a => a.computed);
      const results = await Promise.all(
        computed.map(async info => {
          const { chunks } = await api.clusters(info.id);
          return {
            info,
            chunks,
            nClusters: chunks.length,
            avgCohesion: mean(chunks.map(c => c.cohesion)),
            avgCoupling: mean(chunks.map(c => c.coupling)),
            largest: chunks.reduce((m, c) => Math.max(m, c.size), 0),
          } as AlgoSummary;
        })
      );
      if (!live) return;
      setSummaries(results);
      setSelected(results.length ? results[0].info.id : null);
    });
    return () => { live = false; };
  }, []);

  // reset selected cluster + members when the algorithm changes
  useEffect(() => { setOpenCluster(null); setMembers(null); }, [selected]);

  useEffect(() => {
    if (selected == null || openCluster == null) { setMembers(null); return; }
    let live = true;
    setMembersLoading(true);
    api.clusterMembers(selected, openCluster).then(d => {
      if (!live) return;
      setMembers({ meta: d.meta, members: d.members });
      setMembersLoading(false);
    });
    return () => { live = false; };
  }, [selected, openCluster]);

  if (!summaries) return <div className="ih-loading">Loading…</div>;

  const current = summaries.find(s => s.info.id === selected) || null;
  const sortedChunks = current ? current.chunks.slice().sort((a, b) => b.size - a.size) : [];
  const clusterBars = summaries.map(s => ({ label: s.info.id, value: s.nClusters }));

  return (
    <>
      <div className="ih-h1">Algorithm Lab</div>
      <div className="ih-sub">Every clustering algorithm run on the answer embeddings — compare families and inspect clusters.</div>

      {summaries.length === 0 ? (
        <div className="ih-panel ih-muted">No clustering algorithms have been computed yet.</div>
      ) : (
        <>
          <div className="ih-cards">
            <div className="ih-card"><div className="v">{summaries.length}</div><div className="l">computed algorithms</div></div>
            <div className="ih-card"><div className="v">{new Set(summaries.map(s => s.info.family)).size}</div><div className="l">distinct families</div></div>
            <div className="ih-card"><div className="v">{summaries.reduce((m, s) => Math.max(m, s.nClusters), 0)}</div><div className="l">most clusters (single algo)</div></div>
          </div>

          <div className="ih-panel">
            <h2>Algorithm comparison</h2>
            <div className="pd">every computed clustering algorithm, side by side — averages over its chunks</div>
            <table className="ih-table">
              <thead><tr><th>Algorithm</th><th>Family</th><th>#clusters</th><th>Avg cohesion</th><th>Avg coupling</th><th>Largest cluster</th></tr></thead>
              <tbody>{summaries.map(s => (
                <tr key={s.info.id}>
                  <td>{s.info.name}</td>
                  <td className="ih-muted">{s.info.family}</td>
                  <td>{s.nClusters}</td>
                  <td>{fmt(s.avgCohesion, 2)}</td>
                  <td>{fmt(s.avgCoupling, 2)}</td>
                  <td>{s.largest}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>

          <div className="ih-grid2">
            <div className="ih-panel">
              <h2>Clusters per algorithm</h2>
              <div className="pd">how finely each algorithm partitions the answer space</div>
              <HBars data={clusterBars} fmt={v => Math.round(v).toString()} />
            </div>
            <div className="ih-panel">
              <h2>Avg cohesion vs coupling</h2>
              <div className="pd">tighter clusters (high cohesion) that are well-separated (low coupling) are better</div>
              <Bars height={200} fmt={v => v.toFixed(2)} data={summaries.map(s => ({ label: s.info.id, value: s.avgCohesion }))} />
            </div>
          </div>

          <div className="ih-panel">
            <h2>Inspect an algorithm</h2>
            <div className="pd">pick a clustering run to drill into its clusters</div>
            <div className="ih-seg" style={{ flexWrap: "wrap" }}>
              {summaries.map(s => (
                <button key={s.info.id} className={selected === s.info.id ? "on" : ""} onClick={() => setSelected(s.info.id)} title={s.info.name}>{s.info.id}</button>
              ))}
            </div>
          </div>

          {current && (
            <div className="ih-grid2">
              <div className="ih-panel">
                <h2>{current.info.name} — clusters</h2>
                <div className="pd">{current.nClusters} clusters · {current.info.family} · click a cluster to see its answers</div>
                <table className="ih-table click">
                  <thead><tr><th></th><th>Label</th><th>Size</th><th>Cohesion</th><th>Coupling</th></tr></thead>
                  <tbody>{sortedChunks.map(c => (
                    <tr key={c.cluster_id} onClick={() => setOpenCluster(c.cluster_id)}
                      style={openCluster === c.cluster_id ? { background: "#1a2138" } : undefined}>
                      <td><span style={{ display: "inline-block", width: 12, height: 12, borderRadius: 3, background: c.color }} /></td>
                      <td>{c.label}</td>
                      <td>{c.size}</td>
                      <td>{fmt(c.cohesion, 2)}</td>
                      <td>{fmt(c.coupling, 2)}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>

              <div className="ih-panel">
                <h2>Cluster members</h2>
                {openCluster == null ? (
                  <div className="ih-muted">Select a cluster on the left to inspect its answers.</div>
                ) : membersLoading || !members ? (
                  <div className="ih-muted">Loading cluster members…</div>
                ) : (
                  <>
                    <div className="pd">
                      <span style={{ display: "inline-block", width: 12, height: 12, borderRadius: 3, background: members.meta.color, marginRight: 6, verticalAlign: "middle" }} />
                      <b>{members.meta.label}</b> · {members.meta.size} answers · cohesion {fmt(members.meta.cohesion, 2)} · coupling {fmt(members.meta.coupling, 2)}
                      <span className="ih-muted"> · medoid node #{members.meta.medoid_node}</span>
                    </div>
                    <table className="ih-table click">
                      <thead><tr><th>Model</th><th>Tier</th><th>Category</th><th>Quality</th><th>Answer</th></tr></thead>
                      <tbody>{members.members.map(m => {
                        const isMedoid = m.id === members.meta.medoid_node;
                        return (
                          <tr key={m.id} onClick={() => onOpen(m.prompt_i)}
                            style={isMedoid ? { background: "#13261f" } : undefined}>
                            <td>{isMedoid ? <b>★ {m.model}</b> : m.model}</td>
                            <td className="ih-muted">{m.tier}</td>
                            <td className="ih-muted">{m.category}</td>
                            <td>{m.quality == null ? "—" : fmt(m.quality, 2)}</td>
                            <td>{m.snippet.slice(0, 90)}</td>
                          </tr>
                        );
                      })}</tbody>
                    </table>
                  </>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}

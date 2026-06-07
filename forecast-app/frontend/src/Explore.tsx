import { useState, useEffect, useMemo } from "react";
import { getDatasets, getRows } from "./api";
import Plot from "./Plot";

// Reactive data-exploration workspace (Orange/Observable-style): pick fields, filter with range
// sliders, and every chart + the table re-render live off the shared filtered set.
type Row = Record<string, number | string>;

export default function Explore() {
  const [datasets, setDatasets] = useState<string[]>([]);
  const [sid, setSid] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [numCols, setNumCols] = useState<string[]>([]);
  const [x, setX] = useState(""); const [y, setY] = useState(""); const [color, setColor] = useState("");
  const [filters, setFilters] = useState<Record<string, [number, number]>>({});
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => { getDatasets().then((d) => { const ids = d.datasets.map((x: { id: string }) => x.id); setDatasets(ids); if (ids.length && !sid) setSid(ids[0]); }).catch((e) => setErr(String(e))); }, []); // eslint-disable-line
  useEffect(() => {
    if (!sid) return;
    getRows(sid).then((d) => {
      setRows(d.rows); setNumCols(d.numeric_columns);
      setX(d.numeric_columns[0] || ""); setY(d.numeric_columns[1] || d.numeric_columns[0] || "");
      setColor("");
      const f: Record<string, [number, number]> = {};
      d.numeric_columns.slice(0, 6).forEach((c: string) => {
        const vals = d.rows.map((r: Row) => Number(r[c])).filter((v: number) => isFinite(v));
        f[c] = [Math.min(...vals), Math.max(...vals)];
      });
      setFilters(f);
    }).catch((e) => setErr(String(e)));
  }, [sid]);

  // reactive filtered set
  const filtered = useMemo(() => rows.filter((r) =>
    Object.entries(filters).every(([c, [lo, hi]]) => { const v = Number(r[c]); return !isFinite(v) || (v >= lo && v <= hi); })), [rows, filters]);

  const colVals = (c: string) => filtered.map((r) => Number(r[c]));
  // correlation heatmap (numeric)
  const corr = useMemo(() => {
    const cs = numCols.slice(0, 8);
    const cols = cs.map((c) => filtered.map((r) => Number(r[c])));
    const mean = cols.map((v) => v.reduce((a, b) => a + b, 0) / (v.length || 1));
    const z = cs.map((_, i) => cs.map((__, j) => {
      const a = cols[i], b = cols[j]; let num = 0, da = 0, db = 0;
      for (let k = 0; k < a.length; k++) { const x1 = a[k] - mean[i], y1 = b[k] - mean[j]; num += x1 * y1; da += x1 * x1; db += y1 * y1; }
      return +(num / (Math.sqrt(da * db) || 1)).toFixed(2);
    }));
    return { cs, z };
  }, [numCols, filtered]);

  if (err) return <div className="err" style={{ margin: 16 }}>{err}</div>;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", height: "calc(100vh - 96px)" }}>
      <div style={{ borderRight: "1px solid #1E2330", padding: 12, overflowY: "auto", background: "#0d1018" }}>
        <div className="clab">Dataset</div>
        <select className="ctrl-in" value={sid} onChange={(e) => setSid(e.target.value)}>{datasets.map((d) => <option key={d} value={d}>{d}</option>)}</select>
        <div className="clab" style={{ marginTop: 10 }}>X</div>
        <select className="ctrl-in" value={x} onChange={(e) => setX(e.target.value)}>{numCols.map((c) => <option key={c}>{c}</option>)}</select>
        <div className="clab" style={{ marginTop: 8 }}>Y</div>
        <select className="ctrl-in" value={y} onChange={(e) => setY(e.target.value)}>{numCols.map((c) => <option key={c}>{c}</option>)}</select>
        <div className="clab" style={{ marginTop: 8 }}>Color</div>
        <select className="ctrl-in" value={color} onChange={(e) => setColor(e.target.value)}><option value="">none</option>{numCols.map((c) => <option key={c}>{c}</option>)}</select>
        <div style={{ fontSize: 11, textTransform: "uppercase", opacity: .5, margin: "14px 0 6px" }}>Filters (reactive)</div>
        {Object.entries(filters).map(([c, [lo, hi]]) => {
          const all = rows.map((r) => Number(r[c])).filter(isFinite);
          const mn = Math.min(...all), mx = Math.max(...all), step = (mx - mn) / 100 || 1;
          return (
            <div key={c} style={{ marginBottom: 8 }}>
              <div className="clab">{c} <span style={{ opacity: .6 }}>[{lo.toFixed(1)} – {hi.toFixed(1)}]</span></div>
              <input type="range" min={mn} max={mx} step={step} value={lo} onChange={(e) => setFilters((f) => ({ ...f, [c]: [Number(e.target.value), f[c][1]] }))} style={{ width: "100%" }} />
              <input type="range" min={mn} max={mx} step={step} value={hi} onChange={(e) => setFilters((f) => ({ ...f, [c]: [f[c][0], Number(e.target.value)] }))} style={{ width: "100%" }} />
            </div>);
        })}
      </div>
      <div style={{ padding: 16, overflowY: "auto" }}>
        <div className="kv" style={{ marginBottom: 8 }}>Showing <b>{filtered.length}</b> of {rows.length} rows (filters update every chart live).</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div><h2>{x} vs {y}</h2>
            <Plot height={300} data={[{ x: colVals(x), y: colVals(y), mode: "markers", type: "scattergl",
              marker: { size: 5, color: color ? colVals(color) : "#6366f1", colorscale: "Viridis", showscale: !!color } }]}
              layout={{ xaxis: { title: x }, yaxis: { title: y } }} /></div>
          <div><h2>Distribution — {x}</h2>
            <Plot height={300} data={[{ x: colVals(x), type: "histogram", nbinsx: 40, marker: { color: "#22d3ee" } }]} layout={{}} /></div>
          <div><h2>Correlation</h2>
            <Plot height={320} data={[{ z: corr.z, x: corr.cs, y: corr.cs, type: "heatmap", colorscale: "RdBu", zmid: 0 }]} layout={{}} /></div>
          <div><h2>Data ({Math.min(filtered.length, 100)} rows)</h2>
            <div style={{ maxHeight: 300, overflow: "auto" }}>
              <table className="mini"><thead><tr>{numCols.slice(0, 6).map((c) => <th key={c}>{c}</th>)}</tr></thead>
                <tbody>{filtered.slice(0, 100).map((r, i) => <tr key={i}>{numCols.slice(0, 6).map((c) => <td key={c}>{typeof r[c] === "number" ? (r[c] as number).toFixed(2) : String(r[c])}</td>)}</tr>)}</tbody></table>
            </div></div>
        </div>
      </div>
    </div>
  );
}

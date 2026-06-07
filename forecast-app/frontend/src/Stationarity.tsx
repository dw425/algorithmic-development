import { useState, useEffect } from "react";
import { getStationarity, type StationarityResult } from "./api";
import { useGlobal } from "./GlobalControls";
import PageArchetype from "./PageArchetype";
import Plot from "./Plot";

export default function Stationarity() {
  const g = useGlobal();
  const ticker = g.stocks[0] || "MSFT";
  const [res, setRes] = useState<StationarityResult | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setErr(null);
    getStationarity(ticker, g.granularity).then(setRes).catch((e) => setErr(String(e)));
  }, [g.runKey]); // eslint-disable-line react-hooks/exhaustive-deps

  if (err) return <div className="err">{err}</div>;
  if (!res) return <PageArchetype title={`Stationarity — ${ticker}`} viz={<div className="kv">loading…</div>} />;

  const st = res.stationarity;
  const viz = (
    <>
      <div className="kv">ADF p {st.adf_p} · KPSS p {st.kpss_p} → <b>{st.recommend}</b></div>
      <Plot data={[
        { x: res.dates, y: res.close, mode: "lines", name: "close", line: { color: "#3b82f6" } },
        ...(res.stl ? [{ x: res.dates, y: res.stl.trend, mode: "lines", name: "STL trend", line: { color: "#f0b429" } }] : []),
      ]} layout={{ yaxis: { title: "$ close" } }} />
      {res.stl ? (
        <Plot height={220} data={[{ x: res.dates, y: res.stl.seasonal, mode: "lines", name: "STL seasonal", line: { color: "#34d399" } }]}
          layout={{ yaxis: { title: "seasonal" } }} />
      ) : null}
    </>
  );
  const data = (
    <table className="mini"><thead><tr><th>Test</th><th>p-value</th><th>Meaning</th></tr></thead>
      <tbody>
        <tr><td>ADF</td><td>{st.adf_p}</td><td>{(st.adf_p ?? 1) > 0.05 ? "non-stationary" : "stationary"}</td></tr>
        <tr><td>KPSS</td><td>{st.kpss_p}</td><td>{(st.kpss_p ?? 1) < 0.05 ? "non-stationary" : "stationary"}</td></tr>
        <tr><td>STL resid std</td><td>{res.stl ? res.stl.resid_std : "n/a"}</td><td>noise after trend+seasonal</td></tr>
      </tbody></table>
  );
  const control = <div className="kv">Granularity ({g.granularity}) is set on the left — STL period adapts. Change it and hit Apply.</div>;
  const adjustment = <div className="kv">Recommendation: <b>{st.recommend}</b>. Prices are typically non-stationary (forecast on returns); STL trend/seasonal shown in Visualization.</div>;

  return <PageArchetype title={`Stationarity — ${ticker}`} viz={viz} data={data} control={control} adjustment={adjustment} />;
}

import { useState, useEffect } from "react";
import { getForecast } from "../api";
import { useGlobal } from "../GlobalControls";
import { Card, KPI, PageTitle, Field, Select, Loading, ErrorBox } from "../ui";
import Plot from "../Plot";

export default function ForecastView() {
  const g = useGlobal();
  const [focus, setFocus] = useState(g.stocks[0] || "AAPL");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [r, setR] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true); setErr(null);
    getForecast(focus, g.target / 100, g.granularity, g.params)
      .then(setR).catch((e) => setErr(String(e))).finally(() => setLoading(false));
  }, [focus, g.runKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const rows = r?.rows?.slice(-120) || [];
  return (
    <div className="space-y-4">
      <PageTitle title="Forecast" subtitle="Calibrated conformal+ACI range vs actual, out-of-sample. Coverage and width read together." />
      <div className="flex gap-3">
        <Field label="Stock"><Select value={focus} onChange={setFocus}>{g.stocks.map((s) => <option key={s}>{s}</option>)}</Select></Field>
      </div>
      {err && <ErrorBox msg={err} />}
      {loading && <Loading what="forecasting" />}
      {r && r.coverage != null && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KPI label={`coverage (target ${g.target}%)`} value={`${r.coverage}%`} tone={r.coverage >= g.target ? "good" : "warn"} />
            <KPI label="band width" value={`${r.avg_width_pct}%`} />
            <KPI label="eval points" value={r.n_eval} />
            <KPI label="predictability" value={r.predictability?.label ?? "—"} />
          </div>
          <Card title={`${focus} — range vs actual`}>
            <Plot data={[
              { x: rows.map((x: { date: string }) => x.date), y: rows.map((x: { hi: number }) => x.hi), mode: "lines", line: { width: 0 }, showlegend: false },
              { x: rows.map((x: { date: string }) => x.date), y: rows.map((x: { lo: number }) => x.lo), mode: "lines", line: { width: 0 }, fill: "tonexty", fillcolor: "rgba(45,212,191,0.16)", name: `${g.target}% range` },
              { x: rows.map((x: { date: string }) => x.date), y: rows.map((x: { pred: number }) => x.pred), mode: "lines", line: { color: "#2dd4bf" }, name: "forecast" },
              { x: rows.map((x: { date: string }) => x.date), y: rows.map((x: { actual: number }) => x.actual), mode: "lines", line: { color: "#e5e7eb" }, name: "actual" },
            ]} layout={{ yaxis: { title: "$ close" } }} />
          </Card>
        </>
      )}
    </div>
  );
}

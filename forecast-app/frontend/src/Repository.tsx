import { useState, useEffect } from "react";
import { getRepository, type Repo } from "./api";
import { useGlobal } from "./GlobalControls";

export default function Repository() {
  const g = useGlobal();
  const [repo, setRepo] = useState<Repo | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    getRepository().then(setRepo).catch((e) => setErr(String(e)));
  }, [g.runKey]);

  return (
    <div>
      <h1>Repository — saved runs & artifacts</h1>
      <p className="sub">Every forecast/run computed and cached. Load a cached stock into the
        picker on the left, or inspect a batch run.</p>
      {err && <div className="err">{err}</div>}
      {repo && <>
        <h2>Batch runs</h2>
        <table className="mini">
          <thead><tr><th>Run</th><th>Series</th><th>Valid</th></tr></thead>
          <tbody>
            {repo.runs.length ? repo.runs.map((r) => (
              <tr key={r.name}><td>{r.name}</td><td>{r.n_series}</td><td>{r.n_valid}</td></tr>
            )) : <tr><td colSpan={3}>none yet</td></tr>}
          </tbody>
        </table>

        <h2>Cached forecasts ({repo.cached_forecasts.length})</h2>
        <div className="chips">
          {repo.cached_forecasts.map((t) => (
            <span key={t} className={`chip ${g.stocks.includes(t) ? "on" : ""}`}
              style={{ cursor: "pointer" }}
              onClick={() => { if (!g.stocks.includes(t) && g.stocks.length < 10) g.setStocks([...g.stocks, t]); }}>
              {t}</span>
          ))}
        </div>

        <h2>Graphic artifacts ({repo.artifacts.length})</h2>
        <ul className="kv">
          {repo.artifacts.map((a) => <li key={a}>{a}</li>)}
        </ul>
      </>}
    </div>
  );
}

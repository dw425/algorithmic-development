import { useState, type ReactNode } from "react";
import { useGlobal } from "./GlobalControls";
import { TICKERS } from "./api";

// extended universe for the picker (the 10 defaults + common liquid names)
const UNIVERSE = [...new Set([...TICKERS, "XOM", "WMT", "DIS", "BA", "KO", "PEP", "CVX",
  "INTC", "AMD", "CRM", "ORCL", "NFLX", "PYPL", "T", "PFE", "MRK", "ABBV", "CSCO", "QCOM",
  "FSLR", "DOW", "CF", "AEE", "DTE", "EVRG"])];

export default function ControlPanel({ children }: { children?: ReactNode }) {
  const g = useGlobal();
  const [q, setQ] = useState("");
  const matches = UNIVERSE.filter((t) => t.includes(q.toUpperCase()) && !g.stocks.includes(t)).slice(0, 8);

  function add(t: string) { if (g.stocks.length < 10 && !g.stocks.includes(t)) g.setStocks([...g.stocks, t]); setQ(""); }
  function remove(t: string) { g.setStocks(g.stocks.filter((x) => x !== t)); }

  return (
    <aside className="ctrl">
      <div className="ctrl-sec">
        <div className="ctrl-h">Stocks ({g.stocks.length}/10)</div>
        <div className="chips">
          {g.stocks.map((t) => (
            <span key={t} className="chip on" onClick={() => remove(t)} style={{ cursor: "pointer" }}>{t} ✕</span>
          ))}
        </div>
        <input className="ctrl-in" placeholder="add ticker…" value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && q) add(q.toUpperCase()); }} />
        {q && matches.length > 0 && (
          <div className="suggest">{matches.map((t) => (
            <div key={t} className="sg" onClick={() => add(t)}>{t}</div>))}</div>
        )}
        <div className="ctrl-row">
          <button className="link" onClick={() => g.setStocks(TICKERS.slice())}>defaults</button>
          <button className="link" onClick={() => g.setStocks([])}>clear</button>
        </div>
      </div>

      <div className="ctrl-sec">
        <div className="ctrl-h">Date range</div>
        <label className="ctrl-l">start<input className="ctrl-in" type="date" value={g.start}
          onChange={(e) => g.setStart(e.target.value)} /></label>
        <label className="ctrl-l">end<input className="ctrl-in" type="date" value={g.end}
          onChange={(e) => g.setEnd(e.target.value)} /></label>
      </div>

      <div className="ctrl-sec">
        <div className="ctrl-h">Granularity</div>
        <select className="ctrl-in" value={g.granularity}
          onChange={(e) => g.setGranularity(e.target.value as "1d" | "1wk" | "1mo")}>
          <option value="1d">Daily</option><option value="1wk">Weekly</option><option value="1mo">Monthly</option>
        </select>
      </div>

      <div className="ctrl-sec">
        <div className="ctrl-h">Horizon</div>
        <select className="ctrl-in" value={g.horizon} onChange={(e) => g.setHorizon(Number(e.target.value))}>
          {[1, 7, 30, 90].map((h) => <option key={h} value={h}>{h}-step</option>)}
        </select>
      </div>

      <div className="ctrl-sec">
        <div className="ctrl-h">Target coverage (range)</div>
        <select className="ctrl-in" value={g.target} onChange={(e) => g.setTarget(Number(e.target.value))}>
          {[50, 60, 70, 80, 90, 95].map((t) => <option key={t} value={t}>{t}%</option>)}
        </select>
      </div>

      {children && <div className="ctrl-sec"><div className="ctrl-h">Page controls</div>{children}</div>}

      <button className="apply" onClick={g.apply}>Apply ▶</button>
    </aside>
  );
}

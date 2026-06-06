import { useState, useEffect } from "react";
import { useGlobal } from "./GlobalControls";
import { getUniverse, DEFAULT_TICKERS } from "./api";

export default function ControlPanel() {
  const g = useGlobal();
  const [q, setQ] = useState("");
  const [universe, setUniverse] = useState<string[]>(DEFAULT_TICKERS);

  useEffect(() => {
    getUniverse().then((u) => setUniverse(u.tickers)).catch(() => undefined);
  }, []);

  const matches = q
    ? universe.filter((t) => t.startsWith(q.toUpperCase()) && !g.stocks.includes(t)).slice(0, 10)
    : [];

  function add(t: string) {
    if (g.stocks.length < 10 && !g.stocks.includes(t)) g.set({ stocks: [...g.stocks, t] });
    setQ("");
  }
  function remove(t: string) {
    g.set({ stocks: g.stocks.filter((x) => x !== t) });
  }
  function onKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && q) add(q.toUpperCase());
  }

  return (
    <aside className="ctrl">
      <div className="ctrl-sec">
        <div className="ctrl-h">Stocks {g.stocks.length} of 10</div>
        <div className="chips">
          {g.stocks.map((t) => (
            <span key={t} className="chip on" onClick={() => remove(t)}>{t} x</span>
          ))}
        </div>
        <input className="ctrl-in" placeholder="search tickers" value={q}
          onChange={(e) => setQ(e.target.value)} onKeyDown={onKey} />
        {matches.length > 0 ? (
          <div className="suggest">
            {matches.map((t) => (
              <div key={t} className="sg" onClick={() => add(t)}>{t}</div>
            ))}
          </div>
        ) : null}
      </div>

      <div className="ctrl-sec">
        <div className="ctrl-h">Date range</div>
        <input className="ctrl-in" type="date" value={g.start} onChange={(e) => g.set({ start: e.target.value })} />
        <input className="ctrl-in" type="date" value={g.end} onChange={(e) => g.set({ end: e.target.value })} />
      </div>

      <div className="ctrl-sec">
        <div className="ctrl-h">Granularity</div>
        <select className="ctrl-in" value={g.granularity}
          onChange={(e) => g.set({ granularity: e.target.value as "1d" })}>
          <option value="1d">Daily</option>
          <option value="1wk">Weekly</option>
          <option value="1mo">Monthly</option>
        </select>
      </div>

      <div className="ctrl-sec">
        <div className="ctrl-h">Horizon</div>
        <select className="ctrl-in" value={g.horizon} onChange={(e) => g.set({ horizon: Number(e.target.value) })}>
          {[1, 7, 30, 90].map((h) => (<option key={h} value={h}>{h}-step</option>))}
        </select>
      </div>

      <div className="ctrl-sec">
        <div className="ctrl-h">Target coverage</div>
        <select className="ctrl-in" value={g.target} onChange={(e) => g.set({ target: Number(e.target.value) })}>
          {[50, 60, 70, 80, 90, 95].map((t) => (<option key={t} value={t}>{t}%</option>))}
        </select>
      </div>

      <button className="apply" onClick={g.apply}>Apply</button>
    </aside>
  );
}

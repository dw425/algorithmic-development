import { createContext, useContext, useState, type ReactNode } from "react";
import { DEFAULT_TICKERS, DEFAULT_PARAMS, type Params } from "./api";

export interface GlobalState {
  stocks: string[]; start: string; end: string;
  granularity: "1d" | "1wk" | "1mo"; horizon: number; target: number; runKey: number;
  focus: string;        // user-chosen single-stock focus
  focusTicker: string;  // always-valid: focus if still selected, else first stock
  dataset: string;      // active dataset id for the Data Lab / Model Lab pipeline
  params: Params;       // all tunable algorithm knobs, applied to every system
  set: (p: Partial<Omit<GlobalState, "runKey" | "set" | "apply" | "focusTicker">>) => void;
  setParam: (p: Partial<Params>) => void;
  apply: () => void;
}
const Ctx = createContext<GlobalState | null>(null);
export const useGlobal = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error("useGlobal outside provider");
  return c;
};

export function GlobalProvider({ children }: { children: ReactNode }) {
  const [s, setS] = useState({
    stocks: DEFAULT_TICKERS.slice(), start: "2025-01-01", end: "2026-01-01",
    granularity: "1d" as const, horizon: 1, target: 70, focus: DEFAULT_TICKERS[0],
    dataset: "", params: { ...DEFAULT_PARAMS },
  });
  const [runKey, setRunKey] = useState(0);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const set = (p: any) => setS((cur) => ({ ...cur, ...p }));
  const setParam = (p: Partial<Params>) => setS((cur) => ({ ...cur, params: { ...cur.params, ...p } }));
  const apply = () => setRunKey((k) => k + 1);
  const focusTicker = s.focus && s.stocks.includes(s.focus) ? s.focus : (s.stocks[0] || "MSFT");
  return <Ctx.Provider value={{ ...s, focusTicker, runKey, set, setParam, apply }}>{children}</Ctx.Provider>;
}

import { createContext, useContext, useState, type ReactNode } from "react";
import { DEFAULT_TICKERS } from "./api";

export interface GlobalState {
  stocks: string[]; start: string; end: string;
  granularity: "1d" | "1wk" | "1mo"; horizon: number; target: number; runKey: number;
  set: (p: Partial<Omit<GlobalState, "runKey" | "set" | "apply">>) => void;
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
    granularity: "1d" as const, horizon: 1, target: 70,
  });
  const [runKey, setRunKey] = useState(0);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const set = (p: any) => setS((cur) => ({ ...cur, ...p }));
  const apply = () => setRunKey((k) => k + 1);
  return <Ctx.Provider value={{ ...s, runKey, set, apply }}>{children}</Ctx.Provider>;
}

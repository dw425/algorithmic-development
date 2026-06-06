import { createContext, useContext, useState, type ReactNode } from "react";

export interface GlobalState {
  stocks: string[];
  start: string;
  end: string;
  granularity: "1d" | "1wk" | "1mo";
  horizon: number;
  target: number;
  runKey: number;            // bumped on Apply → pages reload
  setStocks: (s: string[]) => void;
  setStart: (s: string) => void;
  setEnd: (s: string) => void;
  setGranularity: (g: "1d" | "1wk" | "1mo") => void;
  setHorizon: (h: number) => void;
  setTarget: (t: number) => void;
  apply: () => void;
}

const Ctx = createContext<GlobalState | null>(null);

export function useGlobal() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useGlobal outside provider");
  return c;
}

export function GlobalProvider({ children }: { children: ReactNode }) {
  const [stocks, setStocks] = useState<string[]>(["MSFT", "AAPL", "NVDA", "JNJ"]);
  const [start, setStart] = useState("2025-01-01");
  const [end, setEnd] = useState("2026-01-01");
  const [granularity, setGranularity] = useState<"1d" | "1wk" | "1mo">("1d");
  const [horizon, setHorizon] = useState(1);
  const [target, setTarget] = useState(70);
  const [runKey, setRunKey] = useState(0);
  const apply = () => setRunKey((k) => k + 1);

  return (
    <Ctx.Provider value={{ stocks, start, end, granularity, horizon, target, runKey,
      setStocks, setStart, setEnd, setGranularity, setHorizon, setTarget, apply }}>
      {children}
    </Ctx.Provider>
  );
}

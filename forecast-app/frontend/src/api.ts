const BASE = "http://127.0.0.1:8000";

export async function getUniverse(): Promise<{ tickers: string[]; n: number }> {
  const r = await fetch(`${BASE}/api/universe`);
  if (!r.ok) throw new Error(`universe failed: ${r.status}`);
  return r.json();
}

export const DEFAULT_TICKERS = ["MSFT", "AAPL", "NVDA", "JNJ"];

export interface CleanRow { date: string; close: number; flag: boolean; }
export interface CleanResult {
  ticker: string; n_quarantined: number; hampel_outliers: number; k: number;
  benford: { max_dev?: number }; rows: CleanRow[];
}
export async function getClean(ticker: string, k = 3.0, interval = "1d"): Promise<CleanResult> {
  const r = await fetch(`${BASE}/api/clean?ticker=${ticker}&k=${k}&interval=${interval}`);
  if (!r.ok) throw new Error(`clean failed: ${r.status}`);
  return r.json();
}

export interface StationarityResult {
  ticker: string; dates: string[]; close: number[];
  stationarity: { adf_p: number | null; kpss_p: number | null; recommend: string };
  stl: { trend: number[]; seasonal: number[]; resid_std: number } | null;
}
export async function getStationarity(ticker: string, interval = "1d"): Promise<StationarityResult> {
  const r = await fetch(`${BASE}/api/stationarity?ticker=${ticker}&interval=${interval}`);
  if (!r.ok) throw new Error(`stationarity failed: ${r.status}`);
  return r.json();
}

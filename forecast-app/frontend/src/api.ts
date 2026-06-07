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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function get(path: string): Promise<any> {
  const r = await fetch(`${BASE}${path}`);
  if (!r.ok) throw new Error(`${path} failed: ${r.status}`);
  return r.json();
}
export const getMultiScale = (t: string, iv = "1d") => get(`/api/multiscale?ticker=${t}&interval=${iv}`);
export const getPredictability = (t: string, iv = "1d") => get(`/api/predictability?ticker=${t}&interval=${iv}`);
export const getModels = (t: string, iv = "1d") => get(`/api/models?ticker=${t}&interval=${iv}`);
export const getForecast = (t: string, target = 0.7, iv = "1d") => get(`/api/forecast?ticker=${t}&target=${target}&interval=${iv}`);
export const getHorizons = (t: string, target = 0.7, iv = "1d") => get(`/api/horizons?ticker=${t}&target=${target}&interval=${iv}`);
export const getCloud = (t: string, iv = "1d") => get(`/api/cloud?ticker=${t}&interval=${iv}`);
export const getGeo = (t: string, iv = "1d") => get(`/api/geoconsensus?ticker=${t}&interval=${iv}`);
export const getLouvain = (tickers: string[]) => get(`/api/louvain?tickers=${tickers.join(",")}`);
export const getFunnel = (t: string, iv = "1d") => get(`/api/funnel?ticker=${t}&interval=${iv}`);
export const getTPA = (t: string, iv = "1d") => get(`/api/tpa?ticker=${t}&interval=${iv}`);
export const getDiagnostics = (t: string, target = 0.7, iv = "1d") => get(`/api/diagnostics?ticker=${t}&target=${target}&interval=${iv}`);

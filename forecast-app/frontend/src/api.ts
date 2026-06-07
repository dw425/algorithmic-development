const BASE = "http://127.0.0.1:8000";

// All tunable algorithm parameters — global, applied to every system.
export interface Params {
  cleanK: number; cleanWin: number; stlPeriod: number; modelsWin: number;
  fcWin: number; fcRecent: number; debias: boolean;
  horizons: string; scales: string; tpaM: number; tpaC: number;
}
export const DEFAULT_PARAMS: Params = {
  cleanK: 3, cleanWin: 7, stlPeriod: 21, modelsWin: 60,
  fcWin: 60, fcRecent: 120, debias: true,
  horizons: "7,30,90", scales: "1,2,5,10,21", tpaM: 100, tpaC: 0.001,
};
const P = (p?: Partial<Params>): Params => ({ ...DEFAULT_PARAMS, ...(p || {}) });

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
export async function getClean(ticker: string, interval = "1d", p?: Partial<Params>): Promise<CleanResult> {
  const q = P(p);
  const r = await fetch(`${BASE}/api/clean?ticker=${ticker}&interval=${interval}&k=${q.cleanK}&win=${q.cleanWin}`);
  if (!r.ok) throw new Error(`clean failed: ${r.status}`);
  return r.json();
}

export interface StationarityResult {
  ticker: string; dates: string[]; close: number[];
  stationarity: { adf_p: number | null; kpss_p: number | null; recommend: string };
  stl: { trend: number[]; seasonal: number[]; resid_std: number } | null;
}
export async function getStationarity(ticker: string, interval = "1d", p?: Partial<Params>): Promise<StationarityResult> {
  const q = P(p);
  const r = await fetch(`${BASE}/api/stationarity?ticker=${ticker}&interval=${interval}&period=${q.stlPeriod}`);
  if (!r.ok) throw new Error(`stationarity failed: ${r.status}`);
  return r.json();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function get(path: string): Promise<any> {
  const r = await fetch(`${BASE}${path}`);
  if (!r.ok) throw new Error(`${path} failed: ${r.status}`);
  return r.json();
}
export const getMultiScale = (t: string, iv = "1d", p?: Partial<Params>) => get(`/api/multiscale?ticker=${t}&interval=${iv}&scales=${P(p).scales}`);
export const getPredictability = (t: string, iv = "1d") => get(`/api/predictability?ticker=${t}&interval=${iv}`);
export const getModels = (t: string, iv = "1d", p?: Partial<Params>) => get(`/api/models?ticker=${t}&interval=${iv}&win=${P(p).modelsWin}`);
export const getForecast = (t: string, target = 0.7, iv = "1d", p?: Partial<Params>) => { const q = P(p); return get(`/api/forecast?ticker=${t}&target=${target}&interval=${iv}&win=${q.fcWin}&recent=${q.fcRecent}&debias=${q.debias}`); };
export const getHorizons = (t: string, target = 0.7, iv = "1d", p?: Partial<Params>) => get(`/api/horizons?ticker=${t}&target=${target}&interval=${iv}&horizons=${P(p).horizons}`);
export const getCloud = (t: string, iv = "1d") => get(`/api/cloud?ticker=${t}&interval=${iv}`);
export const getGeo = (t: string, iv = "1d") => get(`/api/geoconsensus?ticker=${t}&interval=${iv}`);
export const getLouvain = (tickers: string[]) => get(`/api/louvain?tickers=${tickers.join(",")}`);
export const getFunnel = (t: string, iv = "1d") => get(`/api/funnel?ticker=${t}&interval=${iv}`);
export const getTPA = (t: string, iv = "1d", p?: Partial<Params>) => { const q = P(p); return get(`/api/tpa?ticker=${t}&interval=${iv}&m=${q.tpaM}&c=${q.tpaC}`); };
export const getDiagnostics = (t: string, target = 0.7, iv = "1d") => get(`/api/diagnostics?ticker=${t}&target=${target}&interval=${iv}`);
export const getPredict = (t: string, target = 0.7, iv = "1d", p?: Partial<Params>) => { const q = P(p); return get(`/api/predict?ticker=${t}&target=${target}&interval=${iv}&win=${q.fcWin}&recent=${q.fcRecent}&debias=${q.debias}`); };
export const getPredictionsAll = () => get(`/api/predictions_all`);
export const getBacktest = (t: string, dates: string, horizons = "1,7,30,90", target = 0.7, iv = "1d") =>
  get(`/api/backtest?ticker=${t}&dates=${dates}&horizons=${horizons}&target=${target}&interval=${iv}`);

// ---- Unified platform (Data Lab + Model Lab) ----
async function post(path: string) {
  const r = await fetch(`${BASE}${path}`, { method: "POST" });
  if (!r.ok) throw new Error(`${path} failed: ${r.status}`);
  return r.json();
}
export const getDatasets = () => get(`/api/datasets`);
export const loadBuiltin = (which: string) => post(`/api/datasets/load_builtin?which=${which}`);
export const loadStockDataset = (ticker: string) => post(`/api/datasets/load_stock?ticker=${ticker}`);
export const getProfile = (sid: string) => get(`/api/datasets/${sid}/profile`);
export const getPipeline = (sid: string) => get(`/api/pipeline/${sid}`);
export const harmonizeDataset = (sid: string, p: Record<string, string | number>) =>
  post(`/api/datasets/${sid}/harmonize?${new URLSearchParams(p as Record<string, string>).toString()}`);
export const sampleDataset = (sid: string, p: Record<string, string | number>) =>
  post(`/api/datasets/${sid}/sample?${new URLSearchParams(p as Record<string, string>).toString()}`);
export const runZooModel = (sid: string, model: string, target: string, testSize = 0.2, ordered = true) =>
  post(`/api/datasets/${sid}/model?model=${model}&target=${target}&test_size=${testSize}&ordered=${ordered}`);
export const getZooModels = () => get(`/api/zoo/models`);
export const forecastDataset = (sid: string, target: string, time = "", coverage = 0.7) =>
  post(`/api/datasets/${sid}/forecast?target=${target}&time=${time}&target_coverage=${coverage}`);

// ---- Node platform ----
export const getNodes = () => get(`/api/nodes`);
export const getRows = (sid: string, limit = 2000) => get(`/api/datasets/${sid}/rows?limit=${limit}`);
export async function runFlow(graph: unknown) {
  const r = await fetch(`${BASE}/api/flow/run`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(graph) });
  if (!r.ok) throw new Error(`flow run failed: ${r.status}`);
  return r.json();
}
export async function uploadDataset(file: File, name: string) {
  const fd = new FormData(); fd.append("file", file); fd.append("name", name);
  const r = await fetch(`${BASE}/api/datasets/upload`, { method: "POST", body: fd });
  if (!r.ok) throw new Error(`upload failed: ${r.status}`);
  return r.json();
}

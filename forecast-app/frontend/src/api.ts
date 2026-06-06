const BASE = "http://localhost:8000";

export interface Row {
  date: string;
  pred: number;
  lo: number;
  hi: number;
  actual: number;
  hit: boolean;
  width_pct: number;
  risk_flag?: boolean;
  alpha?: number;
}

export interface Horizon { coverage: number; avg_width_pct: number; n: number; }
export interface Predictability { hurst: number; label: string; horizon_days: number; }

export interface RunResult {
  ticker: string;
  n_eval: number;
  coverage: number;
  target: number;
  avg_width_pct: number;
  weights?: Record<string, number>;
  cal_mae_pct?: Record<string, number>;
  risk_flags?: number;
  predictability?: Predictability | null;
  multi_horizon?: Record<string, Horizon>;
  rows: Row[];
}

export interface VSummary {
  ticker: string;
  coverage: number;
  avg_width_pct: number;
  risk_flags?: number;
  predictability?: Predictability | null;
  multi_horizon?: Record<string, Horizon>;
  n_eval: number;
  target: number;
  error?: string;
}

export async function runAllVectors(): Promise<{ results: VSummary[]; target: number; status?: string }> {
  const r = await fetch(`${BASE}/api/run_all_vectors`);
  if (!r.ok) throw new Error(`run_all_vectors failed: ${r.status}`);
  return r.json();
}

export async function getForecast(ticker: string, target: number): Promise<RunResult> {
  const r = await fetch(`${BASE}/api/forecast?ticker=${ticker}&target=${target}`);
  if (!r.ok) throw new Error(`forecast failed: ${r.status}`);
  return r.json();
}

export interface HRow {
  date: string; target_date: string;
  pred: number; lo: number; hi: number; actual: number; hit: boolean;
}
export interface HorizonsResult {
  ticker: string; target: number;
  horizons: Record<string, { coverage: number; avg_width_pct: number; n: number }>;
  series: Record<string, HRow[]>;
}

export async function getHorizons(ticker: string, target: number): Promise<HorizonsResult> {
  const r = await fetch(`${BASE}/api/horizons?ticker=${ticker}&target=${target}`);
  if (!r.ok) throw new Error(`horizons failed: ${r.status}`);
  return r.json();
}

export interface CNode { id: string; x: number; y: number; community: number; drift_pct: number; vol_pct: number; }
export interface CEdge { source: number; target: number; weight: number; }
export interface Community { id: number; members: string[]; size: number; avg_drift_pct: number; }
export interface Constellation {
  nodes: CNode[]; edges: CEdge[]; communities: Community[];
  n: number; n_communities: number; algo: string; days: number;
}

export async function getConstellation(tickers: string[], start = "2025-01-01", end = "2026-01-01"): Promise<Constellation> {
  const r = await fetch(`${BASE}/api/constellation?tickers=${tickers.join(",")}&eval_start=${start}&eval_end=${end}`);
  if (!r.ok) throw new Error(`constellation failed: ${r.status}`);
  return r.json();
}

export interface Summary {
  ticker: string;
  coverage: number;
  avg_width_pct: number;
  n_eval: number;
  target: number;
  error?: string;
}

export async function runAll(target: number): Promise<{ results: Summary[]; target: number }> {
  const r = await fetch(`${BASE}/api/run_all?target=${target}`);
  if (!r.ok) throw new Error(`run_all failed: ${r.status}`);
  return r.json();
}

export async function runOne(ticker: string, target: number): Promise<RunResult> {
  const r = await fetch(`${BASE}/api/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ticker, target }),
  });
  if (!r.ok) throw new Error(`run failed: ${r.status}`);
  return r.json();
}

export async function runVectors(ticker: string, target: number): Promise<RunResult> {
  const r = await fetch(`${BASE}/api/run_vectors`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ticker, target }),
  });
  if (!r.ok) throw new Error(`run_vectors failed: ${r.status}`);
  return r.json();
}

export interface Pt {
  reach: number; val: number; drift: number;
  km: number; gm: number; db: number; consensus: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface Walkthrough {
  ticker: string; date: string; prev_close: number; actual: number;
  n_vectors: number; target: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  phases: Record<string, any>;
  points: Pt[];
}

export async function getWalkthrough(ticker: string, target: number): Promise<Walkthrough> {
  const r = await fetch(`${BASE}/api/walkthrough?ticker=${ticker}&target=${target}`);
  if (!r.ok) throw new Error(`walkthrough failed: ${r.status}`);
  return r.json();
}

export const TICKERS = ["AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "TSLA", "JPM", "V", "JNJ"];

const BASE = "http://127.0.0.1:8000";

export async function getUniverse(): Promise<{ tickers: string[]; n: number }> {
  const r = await fetch(`${BASE}/api/universe`);
  if (!r.ok) throw new Error(`universe failed: ${r.status}`);
  return r.json();
}

export const DEFAULT_TICKERS = ["MSFT", "AAPL", "NVDA", "JNJ"];

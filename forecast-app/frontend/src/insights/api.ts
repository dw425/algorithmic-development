// MUSE InsightHub — API client. Backend mounted at /insights/api (same process as forecast).
const BASE = "http://127.0.0.1:8000/insights/api";

async function get<T>(path: string): Promise<T> {
  const r = await fetch(`${BASE}${path}`);
  if (!r.ok) throw new Error(`${path} -> ${r.status}`);
  return r.json();
}

export type Tier = "small" | "medium" | "large";

export interface TierRow { tier: Tier; divergence: number; similarity: number; quality: number | null; models: string; }
export interface PairRow { tier: Tier; a: string; b: string; divergence: number; similarity: number; }
export interface CatRow { name: string; n: number; sm_div: number; md_div: number; lg_div: number; sm_qual: number | null; md_qual: number | null; lg_qual: number | null; }
export interface ModelRow { name: string; tier: Tier; mean_quality: number | null; mean_len: number | null; n: number; }
export interface PromptRow { i: number; category: string; prompt: string; sm_div: number | null; md_div: number | null; lg_div: number | null; avg_quality: number | null; n_judged: number; }
export interface Node { id: number; prompt_i: number; model: string; tier: Tier; category: string; length: number; quality: number | null; x: number; y: number; }
export interface AnswerFull { id: number; model: string; tier: Tier; category: string; length: number; quality: number | null; text: string; }

export interface Overview { meta: Record<string, string>; tiers: TierRow[]; n_categories: number; top_divergent: PromptRow[]; }
export interface Constellation { proj: string; nodes: Node[]; categories: string[]; models: { name: string; tier: Tier }[]; tiers: Tier[]; }

export const api = {
  overview: () => get<Overview>("/overview"),
  constellation: (proj: "pca" | "umap") => get<Constellation>(`/constellation?proj=${proj}`),
  prompts: (search = "", sort = "i", order = "asc") =>
    get<{ prompts: PromptRow[]; count: number }>(`/prompts?search=${encodeURIComponent(search)}&sort=${sort}&order=${order}`),
  prompt: (i: number) => get<{ prompt: PromptRow; answers: AnswerFull[] }>(`/prompt/${i}`),
  tiers: () => get<{ tiers: TierRow[]; pairs: PairRow[] }>("/tiers"),
  categories: () => get<{ categories: CatRow[] }>("/categories"),
  models: () => get<{ models: ModelRow[]; pairs: PairRow[] }>("/models"),
  divergence: (tier: Tier, order: "asc" | "desc", limit = 30) =>
    get<{ tier: Tier; order: string; prompts: { i: number; category: string; prompt: string; div: number }[] }>(`/divergence?tier=${tier}&order=${order}&limit=${limit}`),
  quality: () => get<{ model_leaderboard: ModelRow[]; by_category: CatRow[]; most_accurate: PromptRow[]; least_accurate: PromptRow[] }>("/quality"),
};

// ---- shared visual scales (consistent colors across all tabs) ----
export const TIER_COLOR: Record<Tier, string> = { small: "#9ecae1", medium: "#4C72B0", large: "#22d3a8" };
export const MODEL_COLOR: Record<string, string> = {
  "llama3.2:3b": "#9ecae1", "qwen2.5-coder:1.5b": "#74c0fc", "gemma2:2b": "#a5d8ff",
  "deepseek-llm:7b": "#4C72B0", "qwen2.5:14b": "#5b8def", "mistral:7b": "#748ffc",
  "mistral-small:24b": "#22d3a8", "gemma2:27b": "#2ca08a",
};
// 0 (low/identical) -> 1 (high/divergent): cool -> hot
export function heat(t: number): string {
  const c = [[34, 211, 168], [125, 211, 252], [240, 200, 80], [240, 120, 70], [220, 60, 80]];
  const x = Math.max(0, Math.min(1, t)) * (c.length - 1); const i = Math.floor(x); const f = x - i;
  const a = c[i], b = c[Math.min(i + 1, c.length - 1)];
  return `rgb(${Math.round(a[0] + (b[0] - a[0]) * f)},${Math.round(a[1] + (b[1] - a[1]) * f)},${Math.round(a[2] + (b[2] - a[2]) * f)})`;
}
export const fmt = (n: number | null | undefined, d = 3) => (n == null ? "—" : n.toFixed(d));

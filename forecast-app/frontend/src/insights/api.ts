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
export interface Node { id: number; prompt_i: number; model: string; tier: Tier; category: string; length: number; quality: number | null; x: number; y: number; cluster?: number; }
export interface AnswerFull { id: number; model: string; tier: Tier; category: string; length: number; quality: number | null; text: string; }

export interface Overview { meta: Record<string, string>; tiers: TierRow[]; n_categories: number; top_divergent: PromptRow[]; }
export interface Constellation { proj: string; nodes: Node[]; total: number; returned: number; sampled: boolean; categories: string[]; models: { name: string; tier: Tier }[]; tiers: Tier[]; }

export const api = {
  overview: () => get<Overview>("/overview"),
  constellation: (proj: "pca" | "umap", opts?: { bbox?: string; max?: number; cluster_algo?: string }) => {
    const p: Record<string, string> = { proj };
    if (opts?.bbox) p.bbox = opts.bbox;
    if (opts?.max) p.max = String(opts.max);
    if (opts?.cluster_algo) p.cluster_algo = opts.cluster_algo;
    return get<Constellation>(`/constellation?${new URLSearchParams(p).toString()}`);
  },
  prompts: (search = "", sort = "i", order = "asc") =>
    get<{ prompts: PromptRow[]; count: number }>(`/prompts?search=${encodeURIComponent(search)}&sort=${sort}&order=${order}`),
  prompt: (i: number) => get<{ prompt: PromptRow; answers: AnswerFull[] }>(`/prompt/${i}`),
  tiers: () => get<{ tiers: TierRow[]; pairs: PairRow[] }>("/tiers"),
  categories: () => get<{ categories: CatRow[] }>("/categories"),
  models: () => get<{ models: ModelRow[]; pairs: PairRow[] }>("/models"),
  divergence: (tier: Tier, order: "asc" | "desc", limit = 30) =>
    get<{ tier: Tier; order: string; prompts: { i: number; category: string; prompt: string; div: number }[] }>(`/divergence?tier=${tier}&order=${order}&limit=${limit}`),
  quality: () => get<{ model_leaderboard: ModelRow[]; by_category: CatRow[]; most_accurate: PromptRow[]; least_accurate: PromptRow[] }>("/quality"),
  algorithms: () => get<{ algorithms: AlgoInfo[] }>("/algorithms"),
  clusters: (algorithm: string) => get<{ algorithm: string; assignments: number[]; chunks: ClusterChunk[] }>(`/clusters?algorithm=${algorithm}`),
  clusterMembers: (algorithm: string, cluster: number, page = 0) =>
    get<{ meta: ClusterChunk; members: SearchHit[]; page: number; size: number }>(`/cluster_members?algorithm=${algorithm}&cluster=${cluster}&page=${page}`),
  clusterEdges: (algorithm: string) => get<{ algorithm: string; edges: { a: number; b: number; weight: number }[] }>(`/cluster_edges?algorithm=${algorithm}`),
  promptSim: (i: number) => get<{ prompt_i: number; pairs: { a: number; b: number; sim: number }[] }>(`/prompt_sim/${i}`),
  search: (p: { q?: string; scope?: string; tier?: string; category?: string; model?: string; min_quality?: number; page?: number; size?: number }) => {
    const qs = new URLSearchParams(Object.entries(p).filter(([, v]) => v !== undefined && v !== "").map(([k, v]) => [k, String(v)])).toString();
    return get<{ results: SearchHit[]; total: number; page: number; size: number }>(`/search?${qs}`);
  },
};

export interface SearchHit { id: number; prompt_i: number; model: string; tier: Tier; category: string; length: number; quality: number | null; snippet: string; prompt: string; }

export interface AlgoInfo { id: string; name: string; family: string; computed: boolean; }
export interface ClusterChunk { cluster_id: number; size: number; medoid_node: number; cohesion: number; coupling: number; color: string; cx: number; cy: number; label: string; }

// etlviz 12-color chunk palette (for client-derived groups: category/tier/model)
export const CHUNK_PALETTE = ["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#A855F7", "#06B6D4",
  "#EC4899", "#84CC16", "#F97316", "#8B5CF6", "#14B8A6", "#FB923C"];

// ---- shared visual scales (consistent colors across all tabs) ----
export const TIER_COLOR: Record<Tier, string> = { small: "#9ecae1", medium: "#4C72B0", large: "#22d3a8" };
// 21 distinct models, 7/tier. small = light blues · medium = mid blue/violet · large = teals/greens.
export const MODEL_COLOR: Record<string, string> = {
  // small (7)
  "llama3.2:3b": "#9ecae1", "phi3:mini": "#74c0fc", "qwen2.5-coder:1.5b": "#a5d8ff",
  "gemma2:2b": "#c0dbf0", "internlm2:1.8b": "#7fb3e6", "stablelm2:1.6b": "#b3d4f5", "granite3-dense:2b": "#8ec5f0",
  // medium (7)
  "gemma2:9b": "#4C72B0", "yi:9b": "#5b8def", "glm4:9b": "#748ffc", "llama3.1:8b": "#6a5acd",
  "qwen2.5:7b": "#7c6df0", "deepseek-llm:7b": "#5566cc", "mistral:7b": "#8a7ff0",
  // large (7)
  "gemma2:27b": "#22d3a8", "mistral-small:24b": "#2ca08a", "codestral:22b": "#16a34a",
  "internlm2:20b": "#3fbf8f", "deepseek-coder-v2:16b": "#15b88a", "qwen2.5:14b": "#2dd4bf", "phi4": "#0ea271",
};
// 0 (low/identical) -> 1 (high/divergent): cool -> hot
export function heat(t: number): string {
  const c = [[34, 211, 168], [125, 211, 252], [240, 200, 80], [240, 120, 70], [220, 60, 80]];
  const x = Math.max(0, Math.min(1, t)) * (c.length - 1); const i = Math.floor(x); const f = x - i;
  const a = c[i], b = c[Math.min(i + 1, c.length - 1)];
  return `rgb(${Math.round(a[0] + (b[0] - a[0]) * f)},${Math.round(a[1] + (b[1] - a[1]) * f)},${Math.round(a[2] + (b[2] - a[2]) * f)})`;
}
export const fmt = (n: number | null | undefined, d = 3) => (n == null ? "—" : n.toFixed(d));

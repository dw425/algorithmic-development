# MUSE InsightHub — scaling to the 100K dataset

The app is **scale-adaptive**: the *same code* serves the current 1,005-prompt / 9,045-answer
dataset and the upcoming ~100K-prompt / ~900K-answer dataset. Nothing is hard-coded to the small
size; the small case is simply "everything fits, so return everything."

## What already scales (no code change for 100K)

| Concern | Small (now) | Large (100K) | Mechanism |
|---|---|---|---|
| **Constellation render** | returns all 9,045 | returns a 26K overview sample, then the **viewport slice** on zoom | `/constellation?bbox=&max=&cluster_algo=` — server filters to the visible box + uniform-samples; front-end refetches the viewport (debounced) only when `sampled` |
| **Cluster coloring** | — | no 900K assignment array sent | `cluster_id` joined into `/constellation` per returned node (server-side) |
| **Search** | LIKE or FTS5 | **FTS5** `MATCH` | `search_fts` virtual table; `/search` uses it when present, else LIKE |
| **Browse prompts/answers/clusters** | paged | paged | `/search`, `/cluster_members` use `LIMIT/OFFSET` |
| **Clustering — Louvain / k-means / gravity / HDBSCAN** | full | full | kNN-graph Louvain; **MiniBatchKMeans** above `BIG_KMEANS=20k`; HDBSCAN on 2-D coords |
| **Clustering — spectral / agglomerative** | run (O(n²) OK at 9k) | **skipped** above `HEAVY_MAX=40k` | `/algorithms` only advertises computed ones, so the UI adapts automatically |
| **Cohesion / medoid metadata** | full | sampled | capped at `COH_SAMPLE=600` members per cluster (O(size²) → O(600²)) |

Tunables live at the top of `muse_research/insights_clustering.py` (`HEAVY_MAX`, `BIG_KMEANS`,
`COH_SAMPLE`) and `Constellation.tsx` (`MAX_NODES=26000`).

## What the 100K run itself needs (data, not code)

1. **Collect answers** for the 100K prompts through the model tiers (the large model-collection run).
   Land them as `answers_<label>.jsonl` per model under the tier dirs, exactly like the 1,005 set.
2. **Embed** them (nomic-embed-text) — `build_insights_db` already (re)embeds missing answers and
   caches `emb_<label>.jsonl`; at 900K this is the long pole (run it on the box with Ollama up).
3. **Run the exporter**: `uv run python -m muse_research.build_insights_db` → rebuilds `insights.db`
   (projection + clustering + FTS). UMAP on ~900K is the heavy step (~minutes-to-tens-of-minutes);
   consider `n_neighbors`/`low_memory=True` tuning there.
4. Point nothing else — the API + UI adapt from `meta` + `/algorithms`.

## Known follow-ups if 900K stresses a layer
- UMAP at 900K: may want `low_memory=True` or PCA-init; or project in chunks.
- `/constellation` count query per pan: add a spatial index on `(umap_x, umap_y)` if pan feels slow.
- FTS rebuild: `INSERT INTO search_fts SELECT …` over 900K is fine but a few seconds; runs once per build.

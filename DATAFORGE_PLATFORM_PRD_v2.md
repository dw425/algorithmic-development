# DataForge — Platform PRD v2 (node-based data-science platform)

**Supersedes v1.** v1 specified a guided linear "Studio" dashboard. v2 reconsiders *every aspect* and
turns DataForge into a **visual, node-based platform** — drag nodes onto a canvas, wire them into your
own pipelines, ensembles, and architectures — in the lineage of **Azure ML Designer, KNIME, Alteryx,
Dataiku, H2O, RapidMiner, Orange**. Linear "guided mode" survives as a template that *generates* a
graph, so beginners and power users share one engine.

Stack: **React + TypeScript** (frontend), **Python/FastAPI** (backend graph-execution engine).

---

## 1. Why node-based (the core reconsideration)
The old app (and v1) modeled the work as fixed stages. But the real ask is *"make my own ensemble
models and architectures and connections"* — that is inherently a **graph**, not a linear flow. A
node canvas:
- lets you branch (compare 3 conditioning paths from one source),
- lets you build ensembles (wire 5 model nodes → 1 stacking node → a meta-learner),
- makes connections (data lineage) literal and editable,
- scales to any new capability by adding a node type — no new "page."

Linear pipelines are just a special case of the graph, so we lose nothing and gain a platform.

---

## 2. Competitive review — how the leaders do it (and what we take)

| Tool | Build model | Grouping / palette | Node status | Config | Results / preview | Exploration |
|---|---|---|---|---|---|---|
| **Azure ML Designer** | drag *modules* on a canvas, wire typed ports | left palette by category (Data, Transform, Train, Score, Evaluate) | per-module run state | right properties pane | bottom logs + visualize outputs | per-output charts |
| **KNIME** | node graph, in/out ports | left **node repository** (deep categories) | **traffic light** (red=unconfigured, yellow=ready, green=ran, error) | per-node config dialog | right-click → output **data table / view** | dedicated viz nodes |
| **Alteryx** | drag *tools*, wire | top ribbon by category (Prep, Join, Transform, Predictive) | run profile per tool | left configuration window | bottom **Results** window (data) | Browse tool |
| **Dataiku DSS** | **Flow** = visual DAG (datasets □, recipes ○) | left project nav; recipe library | recipe build state | recipe editor | dataset explore + charts | "Charts" tab w/ drag fields, **Lab** AutoML |
| **H2O (Driverless/Flow)** | Flow = executable cells; Driverless = experiments | model recipes | experiment progress | experiment settings | **leaderboard** + **AutoViz** auto charts | AutoViz interactive |
| **RapidMiner** | operators + ports | operator tree (left) | run state | parameters panel (right) | results perspective | viz tab |
| **Orange** | widget canvas, lines | widget toolbox | — | per-widget | output table | **best-in-class interactive, cross-filtering charts** |
| **Observable / Hex** | reactive notebook cells | — | dependency re-run | inline | inline | reactive params |

**What DataForge adopts:**
- **Canvas + typed ports + traffic-light node status** (KNIME) — the build core.
- **Left categorized node library** (everyone) + **right config / properties** (everyone).
- **Bottom results dock**: data preview at the selected port + run log + leaderboard (Alteryx/Azure/H2O).
- **Flow-as-DAG lineage** (Dataiku) — our constellation/lineage *is* the graph.
- **Reactive, cross-filtering exploration** (Orange/Observable) — a first-class Explore workspace + chart nodes.
- **AutoML leaderboard + AutoViz** (H2O/DataRobot/Dataiku Lab) — a "guided" path that builds a graph for you.
- **Guided template → editable graph** (our twist) so linear users and graph users share the engine.

---

## 3. Top-level information architecture (tabbing/grouping, reconsidered)
Top-level is **workspaces (modes)**, not stage tabs. One persistent frame; the center swaps.

```
┌ TOP BAR  DataForge ▸ project ▾ · ⌘K · Run ▸ · Run all ⏵ · Save · Deploy · status ●●●○ ┐
├ WORKSPACE SWITCHER:  [ Flow ]  [ Explore ]  [ Models ]  [ Results ]  [ Data ]  [ Lineage ] ┤
├──────────────┬───────────────────────────────────────────────┬──────────────────────────┤
│ LIBRARY /    │  ACTIVE WORKSPACE                              │ INSPECTOR                 │
│ CATALOG      │  (Flow canvas / Explore board / etc.)          │ (selected node/chart cfg) │
│ • Nodes ▾    │                                               │  params · ports · preview │
│   Sources    │                                               │  provenance · validation  │
│   Transform  │                                               │                           │
│   Filter     │                                               │                           │
│   Features   │                                               │                           │
│   Models     │                                               │                           │
│   Ensemble   │                                               │                           │
│   Forecast   │                                               │                           │
│   Evaluate   │                                               │                           │
│   Visualize  │                                               │                           │
│ • Datasets   │                                               │                           │
│ • Flows      │                                               │                           │
├──────────────┴───────────────────────────────────────────────┴──────────────────────────┤
│ CONSOLE DOCK  ▸ Data preview (selected port) · Run log · Leaderboard · Errors            │
└──────────────────────────────────────────────────────────────────────────────────────────┘
```

**Workspaces:**
- **Flow** — the node canvas; build/compose. *The heart of the platform.*
- **Explore** — reactive cross-filtering charts + calculators + filters for raw data understanding.
- **Models** — model library browser + AutoML leaderboard + ensemble templates.
- **Results** — runs, forecasts, evaluations, compare, reports, export.
- **Data** — dataset catalog, ingest, profile, conditioning presets.
- **Lineage** — the constellation/dependency view = the flow graph + data-gravity (ETL-dep-viz layer).

*Why workspaces over stage-tabs:* stages are now nodes on the canvas, so the top level is about *what
you're doing* (building vs exploring vs reviewing), which scales and doesn't force a linear order.

---

## 4. The node system (the spec that makes it a platform)

### 4.1 Anatomy of a node
```
        ┌─────────────────────────────┐
 in ●──▶│ ◑ Random Forest             │──▶ ● predictions
 (X,y)  │   n_estimators 200 · md 8   │    (out)
        │   R² 0.39  ▁▂▅▇ (mini)      │
        └─────────────────────────────┘
          ▲ status light (●ready ◑ran ⚠error ○unconfigured)
```
- **Title + category color** (each category has a hue).
- **Typed input ports** (left) and **output ports** (right). Types: `dataset`, `split`, `features`,
  `model`, `predictions`, `forecast`, `graph`, `metrics`. Wires only connect compatible types
  (validated, like Azure/KNIME).
- **Status light** (KNIME traffic-light): unconfigured / ready / running / done / stale / error.
- **Inline mini-preview**: a sparkline, metric, or count so the graph is readable at a glance.
- **Double-click / select** → full config + output preview in the Inspector + Console.

### 4.2 Execution model
- The flow is a **DAG**; backend runs it in topological order, **caching each node's output** keyed by
  (node config + upstream hash). Change a node → it and everything downstream go **stale** (amber);
  "Run" recomputes only what changed. (KNIME-style reset/execute.)
- **Run node** (just this + ancestors) or **Run all**.
- Flows are saved as **JSON** (nodes + edges + configs) — versionable, shareable, deployable.

### 4.3 Connection rules
- Output→input must match type. Fan-out allowed (one output → many inputs). Ensembles take **many
  model/prediction inputs → one output**. Cycles forbidden (DAG). Invalid wires show why.

---

## 5. Node library (every node, grouped — mapped to the real backend)

**Sources** — Upload (CSV/JSON/parquet) · Sample dataset · Stock pull · (API/DB later)
**Inspect** — Profiler · Schema · Suitability (Zoo `ingestion.profiler/suitability`)
**Transform/Condition** — Type-coerce · Missing-values · Outlier (Hampel/winsorize) · Normalize
  (z/minmax/robust/log) · Encode (onehot/ordinal) · **Calculator/Formula** (derive columns by
  expression) · Resample/Aggregate · Stationarity/STL · Multi-scale
**Filter/Refine** — Row filter (predicate) · Column select · Date-range · **Sampler** (holdout / time /
  rolling-origin+embargo / bootstrap / stratified)
**Features** — Lag/rolling · OHLCV features · Identity/regime features (Zoo `apex`)
**Models (49, by family)** — Classical (RF, GBM, SVR, KNN·, ridge/lasso, …) · Statistical (ARIMA,
  SARIMA, GARCH, EGARCH, Prophet, Kalman) · Apex (regime-aware meta) — Zoo registry
**Ensemble/Architecture** — Voting · Stacking (level-0 models → level-1 meta) · Weighted-average
  (inverse-error) · Dynamic ensemble · **Custom meta-learner** — *this is where you build your own*
**Forecast** — Conformal+ACI range · Multi-horizon (1/7/30/90) · TPA (fan) · Vector-cloud (1,980) ·
  Backtest
**Calibrate/Explain** — Conformal calibrate · Isotonic · SHAP · Permutation importance · MCS
**Evaluate** — Metrics (MAE/RMSE/R²/MAPE) · Coverage+Width · vs-naive · Leaderboard
**Visualize** — Range chart · Constellation (radial/tier/DAG) · 3D cluster · TPA fan · Funnel ·
  Histogram/Scatter · **Reactive Explorer**
**Output** — Save artifact · Export (CSV/JSON/PNG) · Report/Dashboard · Deploy endpoint

*Each node = a thin wrapper over the already-verified backend functions (ingest/harmonize/sample/
modellab/forecast/zoohub/engine/spatial/advanced).* No new math — new composition.

---

## 6. The ensemble / architecture builder (the H2O / Azure-designer ask)
Building "your own ensemble models and architectures" = wiring on the canvas. Example — a **stacked
ensemble with regime gating**:

```
[Stock pull]→[Condition]→[Sampler]┬─▶[Random Forest]─┐
                                  ├─▶[GBM]───────────┤
                                  ├─▶[ARIMA]─────────┼─▶[Stacking: meta=Ridge]─▶[Conformal range]─▶[Range chart]
                                  └─▶[Kalman]────────┘                                   ▲
                                  └─▶[Regime detector]──────────────────────────────────┘ (gates weights)
```
- Drop model nodes, wire them into a **Stacking/Voting/Weighted** node; pick the meta-learner.
- Add a **Regime detector** to gate ensemble weights (dynamic ensemble).
- Wire the ensemble into **Conformal range** → **Backtest**/**Evaluate** to score it.
- Save the graph as a reusable **"architecture"**; clone & tweak. This is the platform capability.

---

## 7. Explore workspace — reactive data exploration
Orange/Observable-style **linked, cross-filtering** charts for understanding data before modeling.
- A **board** of charts (histogram, scatter, box, time series, correlation heatmap, parallel coords).
- **Brush/select in one → filters all others** + the data table (reactive).
- **Field shelf**: drag columns onto x/y/color/size (Dataiku Charts / Tableau-style).
- **Calculator panel**: derive metrics/columns by expression; live.
- **Filter rail**: range sliders, category pickers, date window — refine the working set; the filter
  state flows into a Filter node if you "send to Flow."
- *Why separate from Flow:* exploration is fast, throwaway, reactive; building is deliberate, saved.
  Both read the same datasets; Explore can emit a Filter/Calculator node into a Flow.

---

## 8. Calculators, file adjustments, filters, refinements (explicit)
- **Calculator/Formula** — expression editor (e.g. `log(close) - lag(log(close),1)`) → new column; as a
  node and in Explore.
- **File adjustments** — on ingest: delimiter, header row, type overrides, column rename/drop, date
  parsing; editable in the Data workspace with a live preview.
- **Filters** — row predicates, column select, date-range, value ranges; as nodes and as Explore rail.
- **Refinements** — the conditioning chain (missing/outlier/normalize/encode) and sampling, each a node
  with before/after preview.

---

## 9. Layout anatomy (regions, why)
- **Top bar** — project switcher, ⌘K palette, Run / Run-all / Save / Deploy, global status.
- **Workspace switcher** — Flow / Explore / Models / Results / Data / Lineage.
- **Library/Catalog (left)** — searchable node palette by category + datasets + saved flows; drag onto canvas.
- **Active workspace (center)** — canvas / explore board / leaderboard, etc.
- **Inspector (right)** — selected node/chart config, ports, validation, provenance.
- **Console dock (bottom)** — data preview at selected port, run log, leaderboard, errors. Collapsible.
- *Why:* this is the proven 4-region layout of every serious node tool; familiar to anyone who's used
  Azure/KNIME/Alteryx, and it scales to hundreds of node types without new pages.

---

## 10. Reactive charts — how
- A small in-browser query layer over the active dataset (Arrow/columnar in memory) so brushing is instant.
- Charts subscribe to a shared **selection + filter store**; any change re-renders dependents (reactive).
- Heavy compute (model fits, forecasts, big aggregations) goes to the backend; light interactions
  (brush/filter/zoom) stay client-side for 60fps. *Why:* exploration must feel instant; modeling can take seconds.

---

## 11. Visual language (new design system)
- Dark-first deep-ink (`#0A0C12` bg, `#12151E` panels, `#1E2330` hairlines) — distinct from the old slate.
- **Category color system** for nodes (Sources teal, Transform blue, Filter cyan, Models indigo,
  Ensemble violet, Forecast green, Evaluate amber, Visualize pink) so the graph is readable by color.
- Mono numerals for metrics; status semantics (gray/blue/green/amber/red); 4px grid; 150–200ms motion;
  one line-icon set with a glyph per node category.

## 12. States & honesty
No silent placeholders. Every node: unconfigured (prompts), running (progress), done (preview),
stale (amber + "re-run"), error (message + fix). Coverage+width always paired; vs-naive always shown.

## 13. Accessibility / responsive / performance
- Keyboard: add node (⌘K), wire, delete, run; focus rings; canvas pannable/zoomable.
- A11y: charts have data-table fallback; status uses icon+text not color alone; AA contrast.
- Budgets: canvas interaction 60fps; node run feedback < 150ms to "running"; preview < 400ms;
  graphs cap node/edge render with "showing N of M."

## 14. Tech architecture (React + TS + Python)
**Frontend**
- React + TypeScript + Vite.
- **React Flow (xyflow)** for the node canvas (ports, edges, pan/zoom, minimap) — the standard for this.
- Plotly (statistical charts) + D3/SVG (constellation, custom) for viz.
- **Zustand** store: flow graph, selection, filter state, run status.
- Routing: project/flow deep-links.

**Backend (Python / FastAPI)** — extends the *already-verified* unified backend:
- **Node registry**: `node_type → (input schema, param schema, fn)` wrapping ingest/harmonize/sample/
  modellab/forecast/zoohub/engine/spatial/advanced.
- **Graph executor**: parse flow JSON → topo-sort → run with **per-node result cache** (hash of config
  + upstream). Endpoints: `POST /api/flow/run` (whole graph), `POST /api/flow/node` (one node + ancestors),
  `GET /api/flow/node/{id}/output` (preview/chart data), `GET/POST /api/flows` (save/load), `GET /api/nodes`
  (the palette = registry).
- Artifacts (datasets, fitted models, forecasts) stored & referenced by id (provenance).

**Why this stack:** React Flow is purpose-built for exactly this; the backend is a thin executor over
code that already works and is tested; flows-as-JSON make the platform shareable and deployable.

## 15. Build plan (phased, each verified)
1. **Canvas core** — React Flow shell, node/edge model, Zustand store, save/load JSON, node registry +
   graph executor (backend), 3 starter nodes (Source → Condition → Profile) running end-to-end.
2. **Library breadth** — all Transform/Filter/Sampler/Feature nodes + Console data-preview.
3. **Model + Ensemble nodes** — 49 Zoo models as nodes; Voting/Stacking/Weighted/meta; leaderboard.
4. **Forecast + Evaluate nodes** — conformal/multi-horizon/TPA/backtest + metrics.
5. **Explore workspace** — reactive cross-filter charts, calculator, filter rail.
6. **Visualize/Lineage** — constellation/3D/fan/funnel as nodes + the Lineage workspace (graph = lineage).
7. **Guided mode + AutoML** — template that builds a starter graph; leaderboard auto-run.
8. **Results/Deploy/Report** + polish (palette, a11y, motion, perf); render-gate every workspace & node state.

## 16. YOUR DECISION CHECKLIST
1. **Core paradigm:** confirm **node canvas (React Flow)** as the heart, with guided mode as a graph template?
2. **Closest reference** to match the feel: **Azure ML Designer** (clean, typed modules), **KNIME**
   (deep/power), **Alteryx** (analyst-friendly), **Dataiku** (Flow+Lab), or **Orange** (viz-first)?
3. **Clean break:** delete the old frontend; build the platform net-new (recommended)?
4. **v1 scope:** Canvas + (Source→Condition→Sampler→Model→Forecast→Evaluate→Visualize) nodes first,
   Explore + AutoML + Deploy second? Or Explore-first?
5. **Ensemble depth for v1:** voting/weighted/stacking only, or also dynamic/regime-gated meta from day one?
6. **Brand + accent** (DataForge + category color system as proposed?).

Reply with picks (or "go with your recommendations") and I'll start at Phase 1: the canvas core +
node registry + graph executor, building net-new (no PageArchetype).

# DataForge — UI Product Requirements Document (PRD)

A brand-new experience for the unified data-science platform (ETL-dep-viz + Project Zoo + the
algorithmic forecasting engine). This document specifies the interface from the ground up: the
mental model, the layout paradigm, every screen, every component, the visual language, and the
**rationale for each choice** so the decisions are yours to make with full context.

> This is NOT the existing forecast-app dashboard. The old app is a grid of tabs, each tab a
> page with four identical sub-tabs (Visualization/Data/Control/Adjustment). That pattern is
> explicitly being replaced. Where this PRD says "new," it means new components, new layout, new
> interaction model — not a reskin.

---

## 0. How to read this
Sections 1–4 set the thesis and the model. Section 5 is the **single most important decision**:
the layout paradigm — presented as a comparison with a clear recommendation. Sections 6–9 spec the
anatomy, screens, components, and charts. Sections 10–14 cover interaction, visual language, states,
and tech. Section 15 is the build plan. **Section 16 is your decision checklist** — the picks I need
from you. Every major choice has a *Why this* block with the alternatives I rejected and the tradeoff.

---

## 1. Product thesis
DataForge turns a raw dataset into a trustworthy forecast by walking it through one continuous,
inspectable pipeline — **Ingest → Profile → Harmonize → Sample → Model → Forecast → Visualize** —
where every stage is swappable ("try various methods"), every result is comparable, and every claim
is backed by a number you can see. It unifies three tools:
- **ETL-dep-viz (UltraETL):** lineage, dependency/constellation views, the "how data connects" layer.
- **Project Zoo:** 49 statistical/ML models, ensembles, conformal, explainability — the "method lab."
- **Forecasting engine:** conformal+ACI ranges, multi-horizon, TPA, 1,980-vector cloud — the "predict layer."

**The experience principle:** *the pipeline is the product.* The UI's job is to make the pipeline a
living, visible, drive-able thing — not a set of disconnected pages.

## 2. Users & jobs-to-be-done
- **The analyst** ("does this dataset forecast well, and with which method?") — needs fast iteration,
  comparison, and honest accuracy.
- **The builder** ("wire data → conditioning → model → forecast and tune it") — needs control over
  every parameter and to see cause→effect.
- **The reviewer** ("is this trustworthy?") — needs lineage, calibration, and provenance of every run.

## 3. Core experience principles (with rationale)
1. **One spine, always visible.** The pipeline is persistent UI, not a menu. *Why:* the #1 failure of
   the old app was that stages felt unrelated; users couldn't tell what fed what. Making the pipeline
   the navigation fixes orientation at the structural level.
2. **Progressive disclosure.** Show the headline (e.g. "71% coverage") first; details on demand in an
   inspector. *Why:* the old app dumped tables/sub-tabs equally; signal drowned.
3. **Everything comparable.** Any run (model, forecast, conditioning) becomes a card you can stack
   against another. *Why:* "try various methods" is meaningless without side-by-side.
4. **Honest by construction.** Coverage AND width always shown together; "beats naive" always shown;
   failures surfaced, not hidden. *Why:* the recurring trust break in this project was overclaiming.
5. **Cause→effect is instant.** Change a knob → see the result move (or a clear "Apply to recompute").
   *Why:* controls that don't visibly do anything read as fake.
6. **State is provenance.** Every artifact knows how it was made (source → config → metrics).

## 4. The mental model — the pipeline as a living spine
Each dataset is an object that moves through 6 stages. Each stage has: a **status** (pending /
running / done / stale), a **config** (the knobs used), a **summary** (the headline result), and
**artifacts** (outputs other stages consume). This is the *control plane*, and the UI renders it
literally as the primary navigation. Changing an upstream stage marks downstream stages **stale**
(amber) so you always know what needs recomputing — a first-class concept the old app lacked.

---

## 5. THE LAYOUT PARADIGM (the decision that defines the experience)

### Options considered

**A. Tab grid (the current app).** Top tab groups, each opens a page, each page has 4 sub-tabs.
- ✅ Familiar, simple to build. ❌ Stages feel disconnected; no flow; no comparison; no provenance;
  every page looks identical. **Rejected** — this is exactly what you told me to replace.

**B. Pipeline canvas (data-flow studio).** A horizontal flow of stage nodes on a canvas; click a
node to open its workspace.
- ✅ The pipeline is obvious and beautiful; great orientation. ❌ A pure canvas wastes space for the
  deep work inside a stage (a model run needs a big chart + params + table, not a node).

**C. IDE / workspace.** Left explorer, center workspace, right inspector, bottom dock, command palette.
- ✅ Best for deep, dense work and power users; familiar to anyone who codes. ❌ On its own it hides
  the pipeline flow — you lose the "what feeds what" story.

**D. Notebook / card feed.** Scrollable feed of result cards.
- ✅ Excellent for exploration and comparison narrative. ❌ Poor for orientation and for structured
  stage config; gets long fast.

### ✅ Recommendation: "Studio" — a hybrid that uses each paradigm where it's strongest

```
┌──────────────────────────────────────────────────────────────────────────┐
│ TOP BAR   DataForge · dataset:diabetes ▾ · run #12 · ⌘K · status: ●●●●○○   │  ← global context + command palette
├──────────────────────────────────────────────────────────────────────────┤
│ PIPELINE RAIL  ◗ Ingest ─● Profile ─● Harmonize ─◐ Sample ─○ Model ─○ Fcst │  ← the spine (control plane), always visible, click to enter a stage
├───────────┬──────────────────────────────────────────────┬───────────────┤
│ CATALOG    │  WORKSPACE                                    │ INSPECTOR      │
│ (left rail)│  the active stage's primary surface           │ (right rail)   │
│ • Datasets │  — big chart / graph / table                  │ • params (live)│
│ • Models   │  — the one thing this stage is for            │ • details/why  │
│ • Runs     │                                               │ • provenance   │
│ • Saved    │                                               │                │
├───────────┴──────────────────────────────────────────────┴───────────────┤
│ RUN DOCK   ▸ run#12 rf R²0.39  ▸ run#11 ridge 0.34  ▸ … (stack to compare) │  ← collapsible; the notebook/compare layer
└──────────────────────────────────────────────────────────────────────────┘
```

- The **Pipeline Rail** (paradigm B) gives orientation + the control plane, always on screen.
- The **Workspace + Inspector** (paradigm C) gives deep, dense work room with live params.
- The **Run Dock** (paradigm D) gives the notebook/compare layer without it taking over.

**Why this wins:** it keeps the pipeline story front-and-center (your core ask — a unified
experience, not disconnected pages) while still giving each stage a real, deep workspace and a
built-in comparison surface. It is structurally different from the tab grid: navigation is the
pipeline, not a tab bar; work happens in a 3-pane workspace, not identical sub-tab pages; comparison
is a persistent dock, not a one-off page.

---

## 6. Screen anatomy — every region, what it does, why

### 6.1 Top bar
- **Brand + active dataset switcher** (dropdown of ingested datasets).
- **Run indicator** (current run #, spinner when computing).
- **Pipeline status pips** (●●●●○○) — at-a-glance how far this dataset is.
- **Command palette (⌘K)** — jump to any stage/dataset/model/run, run actions by typing.
- *Why:* global context that never moves; the palette is the power-user accelerator the old app had no equivalent of.

### 6.2 Pipeline Rail (the spine / control plane)
- Six stage chips connected by a flow line. Each chip shows: icon, name, **status color**
  (gray pending / blue running / green done / **amber stale**), and a one-line summary on hover
  (e.g. "Harmonize · zscore, 677 outliers").
- Click a chip → the Workspace switches to that stage.
- A faint **progress fill** along the connector shows pipeline completion.
- *Why:* this is the single biggest departure from the old app — the pipeline *is* the nav, and the
  stale/done coloring makes data dependencies visible. This is the "logical control plane" made physical.

### 6.3 Catalog (left rail)
- Collapsible sections: **Datasets**, **Models** (49 Zoo + forecasting), **Runs**, **Saved views**.
- Search/filter at top. Each item is selectable and drag-droppable into the Run Dock for comparison.
- *Why:* one home for every reusable artifact; replaces hunting across tabs.

### 6.4 Workspace (center)
- The stage's primary surface — exactly one focused job (profile the data, OR run a model, OR forecast).
- Big, uncluttered; the headline metric(s) as a strip across the top, then the main visualization.
- *Why:* progressive disclosure — the workspace shows the answer, the inspector shows the controls/why.

### 6.5 Inspector (right rail)
- Three stacked accordions: **Controls** (live params for this stage), **Details** (the numbers behind
  the headline), **Provenance** (source → config → metrics, the run's lineage).
- Editing a control marks the stage stale and reveals an **Apply** button.
- *Why:* separates "what happened" (workspace) from "how to change it / why to trust it" (inspector).
  The old app mixed these into identical sub-tabs.

### 6.6 Run Dock (bottom, collapsible)
- A horizontal strip of **run cards**; click to load one into the workspace, multi-select to **Compare**.
- Each card: model/stage, headline metric, vs-naive badge, timestamp.
- *Why:* makes "try various methods" and side-by-side comparison a permanent capability, not a page.

### 6.7 Command palette (⌘K)
- Fuzzy actions: "run random_forest on diabetes", "go to Forecast", "compare run 11 & 12".
- *Why:* speed for the builder/analyst; signals a serious tool.

---

## 7. The surfaces (stage by stage)

For each: **purpose · workspace · inspector · key states.**

### 7.1 Home / Mission Control
- *Purpose:* orientation across ALL datasets.
- *Workspace:* a grid of dataset cards, each a mini pipeline-rail showing its 6-stage status + headline
  (rows, target, best model R², forecast coverage). A "New dataset" primary action.
- *Why:* the old "Overview" was a paragraph; this is a portfolio view of work in flight.

### 7.2 Ingest
- *Workspace:* drop-zone (CSV/JSON/parquet) + quick-add (sample datasets, stock pull); preview table
  of the parsed rows.
- *Inspector:* parse options (delimiter, header, date hints); source provenance.
- *States:* empty (big drop target), parsing (progress), parsed (preview + "Profile →" CTA), error
  (what failed + how to fix).

### 7.3 Profile
- *Workspace:* a **column board** — one tile per column with kind (numeric/datetime/categorical),
  a sparkline/histogram, missing %, and unique count; the suggested **time** and **target** columns
  badged. A correlation strip.
- *Inspector:* dataset summary; override time/target picks.
- *Why:* turns the profile table into a scannable visual board.

### 7.4 Harmonize
- *Workspace:* a **before → after** split — left = raw column, right = conditioned column, updating live
  as you change the chain; a delta strip (missing fixed, outliers conditioned).
- *Inspector:* the conditioning chain (missing strategy, outliers, normalize, encode) as ordered steps
  you can toggle/reorder.
- *Why:* conditioning is invisible unless you can see what it did — the split view shows cause→effect.

### 7.5 Sample
- *Workspace:* a **timeline split visualizer** — train/test/embargo as colored bands over the row axis;
  rolling-origin shows stacked folds.
- *Inspector:* method + sizes + folds + embargo; leakage warnings.
- *Why:* sampling errors are silent killers; the visual makes leakage obvious.

### 7.6 Model Lab
- *Workspace:* a **model gallery** (49 Zoo models grouped by family: classical / statistical /
  ensemble / apex) → pick → run → actual-vs-predicted chart + metric strip (R², RMSE, MAPE, vs-naive).
- *Run Dock:* every run stacks; multi-select → **leaderboard** (sortable metric table + overlaid
  predicted lines).
- *Inspector:* model hyperparameters; feature selection; explainability (importance/SHAP).
- *Why:* "try various methods" needs a gallery + a leaderboard, not a dropdown on a page.

### 7.7 Forecast
- *Workspace:* the calibrated **range vs actual** chart (the band + point + actual), with the headline
  strip (coverage / width / next-step). Sub-modes: single, multi-horizon (1/7/30/90), backtest.
- *Inspector:* target coverage, lookback, calibration window, debias; horizon set.
- *Why:* this is the payoff screen; coverage+width always paired (honesty principle).

### 7.8 Visualize / Constellation / ETL-Lineage
- *Workspace:* the interactive node-graph (constellation radial / tier / pipeline-DAG), the 3D vector
  cloud, the dependency map, the TPA fan, the funnel — selectable view types.
- *Inspector:* graph lens, layout, node detail on select.
- *Why:* this is where the ETL-dep-viz experience lives — lineage + data-gravity + the prediction
  geometry, as one explorable space.

### 7.9 Compare & Repository
- *Compare:* cross-dataset / cross-run side-by-side (small multiples + metric table).
- *Repository:* the full batch validation (1,000+ stocks) and every saved run with provenance.

---

## 8. Component library (new components, each with a why)
- **PipelineRail / StageChip** — the spine; status-colored, hoverable. *New.*
- **MetricStrip / MetricStat** — headline numbers with good/mid/bad semantics + vs-baseline badge.
- **RunCard** — a comparable result object (used in dock, leaderboard, compare).
- **Inspector / Accordion (Controls·Details·Provenance)** — replaces the 4-sub-tab PageArchetype.
- **ParamControl** — slider+number+toggle bound to config, with "stale → Apply" behavior.
- **ColumnTile** — profile board tile (kind, spark, missing).
- **BeforeAfterSplit** — harmonize cause/effect.
- **SplitTimeline** — sampling bands.
- **ModelGallery / ModelChip** — Zoo registry browser by family.
- **Leaderboard** — sortable run comparison.
- **GraphCanvas** — the constellation/lineage SVG (radial/tier/dag) with selection.
- **RangeChart / FanChart / CloudHistogram / Cluster3D** — the viz catalog (below).
- **CommandPalette** — ⌘K.
- **DropZone, EmptyState, ErrorState, Toast** — first-class states.
- *Why a real library:* the old app reused ONE template (PageArchetype) for everything, which is why
  every screen looked the same. A component library lets each stage have the right tool.

## 9. Visualization catalog (every chart, where, why)
| Chart | Where | Why it's the right encoding |
|---|---|---|
| Column tiles + sparklines | Profile | scan many columns fast |
| Before/after dual line | Harmonize | cause→effect of conditioning |
| Split bands timeline | Sample | leakage visible |
| Actual-vs-pred line + metric strip | Model Lab | direct accuracy read |
| Leaderboard table + overlay | Model Lab compare | rank methods |
| Range band + point + actual | Forecast | coverage & width together |
| Multi-horizon decay line | Backtest | accuracy vs horizon |
| TPA fan (201 vectors + winners) | Visualize | the threaded-point geometry |
| 1,980-vector cloud histogram | Visualize | where forecasts cluster |
| 3D cluster (reach/value/drift) | Visualize | constellation geometry |
| Constellation node-graph (radial/tier/dag) | ETL/Lineage | dependencies & data-gravity |
| Funnel | Visualize | vector drop-off |

## 10. Interaction & state model
- **Selection is global & cross-filtering:** select a node/run/column → related views highlight.
- **Drill-down:** click a stage chip → workspace; click a result → inspector detail; click a node →
  graph focus.
- **Stale propagation:** upstream change ambers downstream stages.
- **Compare:** multi-select run cards → leaderboard/overlay.
- **Undo/redo** on config changes.
- **State store:** a single typed store (datasets, activeDataset, pipeline state, runs, selection,
  params) — replaces the scattered per-page state of the old app.

## 11. Visual language (a NEW design system, not the old slate theme)
- **Mode:** dark-first, but a distinct palette — deep ink background `#0A0C12`, panel `#12151E`,
  hairline borders `#1E2330`. (Old app used `#151823/#232838`; we move off it deliberately.)
- **Accent ramp:** a single brand accent (proposed **electric indigo `#6366F1`**) + semantic
  green/amber/red for done/stale/bad; stage colors for the 6 stages.
- **Type:** a tighter scale — display/`Section`/`Body`/`Mono` (mono for numbers/metrics so figures align).
- **Spacing:** 4px base grid; generous workspace padding; dense rails.
- **Elevation:** rails flat, workspace slightly raised, dock floats.
- **Motion:** 150–200ms; stage-chip status transitions; run cards slide into the dock; chart morphs on Apply.
- **Iconography:** one consistent line-icon set; each stage has a glyph.
- *Why:* a recognizably different look is part of "brand-new experience"; aligning numbers in mono and
  pairing every metric with a baseline badge operationalizes the honesty principle.

## 12. States & microcopy
Every surface specs: **empty** (what to do first), **loading** (what's computing + rough time),
**partial** (e.g. forecast ran but model didn't), **error** (what failed + the fix), **success**
(headline + next CTA). No silent placeholders, ever (the old "— pending —" bug class is banned by design).

## 13. Responsiveness, accessibility, performance
- **Responsive:** ≥1280px = full 3-pane; 1024–1280 = inspector collapses to a drawer; <1024 = rails
  become sheets. (Primary target is desktop analysis.)
- **A11y:** keyboard nav for rail/dock/palette; focus rings; ARIA on charts (data table fallback);
  contrast AA; color never the only signal (icons + text on status).
- **Performance budgets:** first paint < 1.5s; stage switch < 150ms; chart render < 400ms; the
  constellation caps node/edge counts with a "showing N of M" notice (no silent truncation).

## 14. Tech approach (and why)
- **React + TypeScript + Vite** (keep — fast, typed). **New component library** built fresh; the old
  `PageArchetype`/`App` shell is removed, not imported.
- **State:** a single store (Zustand — already a dependency in UltraETL, lightweight) for the control
  plane + selection; replaces per-component `useState` sprawl.
- **Routing:** stage = route (`/d/:dataset/:stage`) so runs are shareable/deep-linkable.
- **Charts:** Plotly for statistical charts (reuse the proven data builders), SVG/D3 for the
  constellation (reuse the ported `layout.ts`). *Reuse compute, rebuild the surface.*
- **Backend:** unchanged — the unified FastAPI (forecast engine + Zoo + ingest/harmonize/sample/
  model/forecast + control plane) already exists and is verified.

## 15. Build plan (phased, each phase shippable + verified)
1. **Design tokens + shell** — new top bar, Pipeline Rail, 3-pane frame, store, routing. (No old shell.)
2. **Catalog + Home** — dataset cards, control-plane portfolio.
3. **Ingest + Profile** — dropzone, column board.
4. **Harmonize + Sample** — before/after, split timeline.
5. **Model Lab + Run Dock** — gallery, leaderboard, compare.
6. **Forecast** — range/multi-horizon/backtest.
7. **Visualize/ETL** — constellation, 3D, fan, funnel, lineage.
8. **Compare + Repository** — cross-run, batch validation.
9. **Polish** — palette, a11y, motion, perf; render-gate every screen + sub-state.
Each phase: build → math/render gate → screenshot → review against this PRD.

## 16. YOUR DECISION CHECKLIST (the picks)
1. **Layout paradigm:** accept the **Studio hybrid** (§5) or prefer pure Pipeline-canvas / IDE / Notebook?
2. **Clean break:** delete the old frontend and build net-new (recommended), or keep old at `/classic`?
3. **Brand:** name ("DataForge"?) and accent color (electric indigo, or your pick)?
4. **Density:** power-dense (more on screen) vs spacious (calmer)?
5. **Primary user:** optimize first for analyst, builder, or reviewer?
6. **Scope of v1:** all 6 stages + ETL at once, or ship the spine + Ingest→Forecast first, ETL second?

Tell me your picks (or "go with your recommendations") and I'll build to this PRD — new shell first,
no reuse of the old `PageArchetype`.

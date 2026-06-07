import { useState } from "react";
import { GlobalProvider, useGlobal } from "./GlobalControls";
import ControlPanel from "./ControlPanel";
import PageArchetype from "./PageArchetype";
import DataClean from "./DataClean";
import Stationarity from "./Stationarity";
import MultiScale from "./MultiScale";
import Predictability from "./Predictability";
import BaseModels from "./BaseModels";
import Forecast from "./Forecast";
import MultiHorizon from "./MultiHorizon";
import VectorGrid from "./VectorGrid";
import ClusterConsensus from "./ClusterConsensus";
import Dependency from "./Dependency";
import Funnel from "./Funnel";
import TPA from "./TPA";
import Diagnostics from "./Diagnostics";
import Repository from "./Repository";
import "./App.css";

function StatsBar() {
  const g = useGlobal();
  return (
    <div className="statsbar">
      <span>{g.stocks.length} stocks: {g.stocks.join(", ") || "none"}</span>
      <span>{g.start} → {g.end}</span>
      <span>{g.granularity} · {g.horizon}-step · target {g.target}%</span>
      <span>run #{g.runKey}</span>
    </div>
  );
}

// Top-tab structure. Component tabs fill in as each algorithm phase lands (Tier 1+).
const GROUPS: { group: string; tabs: { id: string; label: string }[] }[] = [
  { group: "Pipeline", tabs: [{ id: "overview", label: "Overview" }, { id: "repository", label: "Repository" }] },
  { group: "Data", tabs: [{ id: "clean", label: "Data clean" }, { id: "stationarity", label: "Stationarity" }, { id: "multiscale", label: "Multi-scale" }] },
  { group: "Forecast", tabs: [{ id: "forecast", label: "Forecast" }, { id: "horizons", label: "Multi-horizon" }, { id: "predictability", label: "Predictability" }, { id: "models", label: "Base models" }] },
  { group: "Vectors", tabs: [{ id: "vectorgrid", label: "Vector grid" }, { id: "funnel", label: "Funnel" }, { id: "tpa", label: "TPA" }] },
  { group: "Spatial", tabs: [{ id: "cluster", label: "Cluster consensus" }, { id: "dependency", label: "Dependency mapper" }] },
  { group: "Experiments", tabs: [{ id: "diagnostics", label: "Diagnostics" }] },
];

export default function App() {
  const [view, setView] = useState("overview");
  return (
    <GlobalProvider>
      <div className="shell">
        <header className="topbar">
          <div className="brand">⬡ Algorithmic Forecasting</div>
          <nav className="tabstrip">
            {GROUPS.map((grp) => (
              <div className="tabgroup" key={grp.group}>
                <span className="tabgroup-h">{grp.group}</span>
                <div className="tabgroup-tabs">
                  {grp.tabs.length === 0 && <span className="tab ghost">— phases —</span>}
                  {grp.tabs.map((t) => (
                    <button key={t.id} className={`tab ${view === t.id ? "on" : ""}`} onClick={() => setView(t.id)}>{t.label}</button>
                  ))}
                </div>
              </div>
            ))}
          </nav>
        </header>
        <StatsBar />
        <div className="body">
          <ControlPanel />
          <main className="main">
            {view === "overview" && (
              <PageArchetype title="Overview"
                viz={<div className="kv">Foundation built &amp; gated (Tier 0). Algorithm components
                  (C1–C22) land here phase by phase — each with its own Visualization / Data /
                  Control / Adjustment page, gated on real numbers + a screenshot. Built so far:
                  C1 Data clean, C2 Stationarity.</div>} />
            )}
            {view === "clean" && <DataClean />}
            {view === "stationarity" && <Stationarity />}
            {view === "multiscale" && <MultiScale />}
            {view === "predictability" && <Predictability />}
            {view === "models" && <BaseModels />}
            {view === "forecast" && <Forecast />}
            {view === "horizons" && <MultiHorizon />}
            {view === "vectorgrid" && <VectorGrid />}
            {view === "cluster" && <ClusterConsensus />}
            {view === "dependency" && <Dependency />}
            {view === "funnel" && <Funnel />}
            {view === "tpa" && <TPA />}
            {view === "diagnostics" && <Diagnostics />}
            {view === "repository" && <Repository />}
          </main>
        </div>
      </div>
    </GlobalProvider>
  );
}

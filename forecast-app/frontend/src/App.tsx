import { useState } from "react";
import { GlobalProvider } from "./GlobalControls";
import ControlPanel from "./ControlPanel";
import Forecast from "./Forecast";
import DataMeasurements from "./DataMeasurements";
import TPA from "./TPA";
import Funnel from "./Funnel";
import Constellation from "./Constellation";
import Walkthrough from "./Walkthrough";
import Scenario from "./Scenario";
import Repository from "./Repository";
import "./App.css";

type Tab = { id: string; label: string };
const GROUPS: { group: string; tabs: Tab[] }[] = [
  { group: "Pipeline", tabs: [{ id: "repository", label: "Repository" }] },
  { group: "Forecast", tabs: [{ id: "forecast", label: "Forecast" }, { id: "measurements", label: "Measurements" }] },
  { group: "Vectors", tabs: [{ id: "tpa", label: "Threaded (TPA)" }, { id: "funnel", label: "Funnel" }] },
  { group: "Spatial", tabs: [{ id: "constellation", label: "Constellation & dependency" }] },
  { group: "Experiments", tabs: [{ id: "walk", label: "Walkthrough" }, { id: "scenario", label: "Scenario planner" }] },
];

export default function App() {
  const [view, setView] = useState("forecast");
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
                  {grp.tabs.map((t) => (
                    <button key={t.id} className={`tab ${view === t.id ? "on" : ""}`}
                      onClick={() => setView(t.id)}>{t.label}</button>
                  ))}
                </div>
              </div>
            ))}
          </nav>
        </header>
        <div className="body">
          <ControlPanel />
          <main className="main">
            {view === "forecast" && <Forecast />}
            {view === "measurements" && <DataMeasurements />}
            {view === "tpa" && <TPA />}
            {view === "funnel" && <Funnel />}
            {view === "constellation" && <Constellation />}
            {view === "walk" && <Walkthrough />}
            {view === "scenario" && <Scenario />}
            {view === "repository" && <Repository />}
          </main>
        </div>
      </div>
    </GlobalProvider>
  );
}

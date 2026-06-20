// MUSE InsightHub — app shell, etlviz top-toolbar chrome + shared prompt drawer.
import { useState } from "react";
import "./insights.css";
import Constellation from "./Constellation";
import PromptDrawer from "./PromptDrawer";
import Overview from "./tabs/Overview";
import Categories from "./tabs/Categories";
import DivergenceLab from "./tabs/DivergenceLab";
import QualityLab from "./tabs/QualityLab";
import AlgorithmLab from "./tabs/AlgorithmLab";
import SearchExplorer from "./tabs/SearchExplorer";
import NeuralNet from "./tabs/NeuralNet";
import PromptView from "./tabs/PromptView";
import ModelView from "./tabs/ModelView";
import TierView from "./tabs/TierView";
import DependencyView from "./tabs/DependencyView";

const TABS = [
  ["overview", "◆", "Overview"], ["constellation", "✦", "Constellation"], ["network", "⧉", "Neural Net"],
  ["dependency", "⊶", "Dependency"], ["prompt", "▦", "Prompt"], ["model", "⊙", "Model"], ["tier", "▥", "Tier"],
  ["algorithms", "⎔", "Algorithm Lab"], ["search", "⌕", "Search"],
  ["categories", "◫", "Categories"], ["divergence", "⟜", "Divergence"], ["quality", "★", "Quality"],
] as const;

export default function InsightsApp() {
  const [tab, setTab] = useState<string>("overview");
  const [prompt, setPrompt] = useState<number | null>(null);
  const open = (i: number) => setPrompt(i);

  return (
    <div className="ih">
      <div className="ih-topbar">
        <div className="brand"><b>MUSE InsightHub</b><small>cross-tier model analysis</small></div>
        <div className="ih-toptabs">
          {TABS.map(([id, ic, label]) => (
            <button key={id} className={"ih-toptab" + (tab === id ? " on" : "")} onClick={() => setTab(id)}>
              <span className="ic">{ic}</span>{label}
            </button>
          ))}
        </div>
        <div className="ih-topright">1,005-prompt pilot · 21 models (7/tier)<br />21,061 answers</div>
      </div>
      <div className="ih-main">
        {tab === "overview" && <Overview onOpen={open} go={setTab} />}
        {tab === "constellation" && <><div className="ih-h1">Constellation</div>
          <div className="ih-sub">Every answer is a star. Pick a clustering algorithm — it re-layouts the whole map. Click a star = zoom · double-click = open.</div>
          <Constellation onSelect={open} /></>}
        {tab === "network" && <NeuralNet onOpen={open} />}
        {tab === "dependency" && <DependencyView onOpen={open} />}
        {tab === "prompt" && <PromptView onOpen={open} />}
        {tab === "model" && <ModelView onOpen={open} />}
        {tab === "tier" && <TierView onOpen={open} />}
        {tab === "algorithms" && <AlgorithmLab onOpen={open} />}
        {tab === "search" && <SearchExplorer onOpen={open} />}
        {tab === "categories" && <Categories onOpen={open} />}
        {tab === "divergence" && <DivergenceLab onOpen={open} />}
        {tab === "quality" && <QualityLab onOpen={open} />}
      </div>
      {prompt != null && <PromptDrawer i={prompt} onClose={() => setPrompt(null)} />}
    </div>
  );
}

// MUSE InsightHub — app shell with etlviz-exact TOP toolbar chrome + shared prompt drawer.
import { useState } from "react";
import "./insights.css";
import Constellation from "./Constellation";
import PromptDrawer from "./PromptDrawer";
import Overview from "./tabs/Overview";
import PromptExplorer from "./tabs/PromptExplorer";
import Tiers from "./tabs/Tiers";
import Categories from "./tabs/Categories";
import Models from "./tabs/Models";
import DivergenceLab from "./tabs/DivergenceLab";
import QualityLab from "./tabs/QualityLab";
import AlgorithmLab from "./tabs/AlgorithmLab";
import SearchExplorer from "./tabs/SearchExplorer";
import NeuralNet from "./tabs/NeuralNet";

const TABS = [
  ["overview", "◆", "Overview"], ["constellation", "✦", "Constellation"], ["network", "⧉", "Neural Net"],
  ["algorithms", "⎔", "Algorithm Lab"], ["search", "⌕", "Search"], ["prompts", "▤", "Prompts"],
  ["tiers", "▣", "Tiers"], ["categories", "◫", "Categories"], ["models", "◉", "Models"],
  ["divergence", "⟜", "Divergence"], ["quality", "★", "Quality"], ["vectoring", "✺", "Vectoring"],
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
        <div className="ih-topright">1,005 prompts · 9 models<br />9,045 answers</div>
      </div>
      <div className="ih-main">
        {tab === "overview" && <Overview onOpen={open} go={setTab} />}
        {tab === "constellation" && <><div className="ih-h1">Constellation</div>
          <div className="ih-sub">Every answer is a star. Pick a clustering algorithm — it re-layouts the whole map. Bind any metric to color · size · filter. Click a star → its prompt.</div>
          <Constellation onSelect={open} /></>}
        {tab === "network" && <NeuralNet onOpen={open} />}
        {tab === "algorithms" && <AlgorithmLab onOpen={open} />}
        {tab === "search" && <SearchExplorer onOpen={open} />}
        {tab === "prompts" && <PromptExplorer onOpen={open} />}
        {tab === "tiers" && <Tiers />}
        {tab === "categories" && <Categories onOpen={open} />}
        {tab === "models" && <Models />}
        {tab === "divergence" && <DivergenceLab onOpen={open} />}
        {tab === "quality" && <QualityLab onOpen={open} />}
        {tab === "vectoring" && <><div className="ih-h1">Vectoring — embedding space</div>
          <div className="ih-sub">The 9,045 answers projected by their nomic embeddings. Color by category for topic clusters; by model to see how little model identity matters.</div>
          <Constellation onSelect={open} /></>}
      </div>
      {prompt != null && <PromptDrawer i={prompt} onClose={() => setPrompt(null)} />}
    </div>
  );
}

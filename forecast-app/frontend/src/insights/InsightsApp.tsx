// MUSE InsightHub — app shell: sidebar tabs + shared prompt drawer.
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

const TABS = [
  ["overview", "◆", "Overview"], ["constellation", "✦", "Constellation"], ["algorithms", "⎔", "Algorithm Lab"],
  ["search", "⌕", "Search"], ["prompts", "▤", "Prompt Explorer"],
  ["tiers", "▣", "Tiers"], ["categories", "◫", "Categories"], ["models", "◉", "Models"],
  ["divergence", "⟜", "Divergence Lab"], ["quality", "★", "Quality Lab"], ["vectoring", "✺", "Vectoring"],
] as const;

export default function InsightsApp() {
  const [tab, setTab] = useState<string>("overview");
  const [prompt, setPrompt] = useState<number | null>(null);
  const open = (i: number) => setPrompt(i);

  return (
    <div className="ih">
      <div className="ih-side">
        <div className="ih-brand">MUSE InsightHub<small>cross-tier model analysis</small></div>
        {TABS.map(([id, ic, label]) => (
          <div key={id} className={"ih-tab" + (tab === id ? " on" : "")} onClick={() => setTab(id)}>
            <span style={{ width: 16, textAlign: "center", opacity: 0.85 }}>{ic}</span>{label}
          </div>
        ))}
        <div className="foot">1,005 prompts · 9 models · 3 tiers<br />9,045 answers · nomic embeddings<br />divergence · similarity · Phi-4 quality</div>
      </div>
      <div className="ih-main">
        {tab === "overview" && <Overview onOpen={open} go={setTab} />}
        {tab === "constellation" && <><div className="ih-h1">Constellation</div>
          <div className="ih-sub">Every answer is a star. Bind any metric to layout · color · size · filter — same map, infinite readings. Click a star → its prompt.</div>
          <Constellation onSelect={open} /></>}
        {tab === "algorithms" && <AlgorithmLab onOpen={open} />}
        {tab === "search" && <SearchExplorer onOpen={open} />}
        {tab === "prompts" && <PromptExplorer onOpen={open} />}
        {tab === "tiers" && <Tiers />}
        {tab === "categories" && <Categories onOpen={open} />}
        {tab === "models" && <Models />}
        {tab === "divergence" && <DivergenceLab onOpen={open} />}
        {tab === "quality" && <QualityLab onOpen={open} />}
        {tab === "vectoring" && <><div className="ih-h1">Vectoring — embedding space</div>
          <div className="ih-sub">The 9,045 answers projected by their nomic embeddings. Color by category to see topic clusters; by model to see how little model identity matters.</div>
          <Constellation onSelect={open} /></>}
      </div>
      {prompt != null && <PromptDrawer i={prompt} onClose={() => setPrompt(null)} />}
    </div>
  );
}

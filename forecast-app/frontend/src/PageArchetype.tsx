import { useState, type ReactNode } from "react";

/** Phase 10 — the 4-page archetype every algorithm component uses:
 *  Visualization · Data · Control · Adjustment. Pages plug their content into each slot. */
export default function PageArchetype(
  { title, viz, data, control, adjustment }:
  { title: string; viz?: ReactNode; data?: ReactNode; control?: ReactNode; adjustment?: ReactNode }) {
  const [tab, setTab] = useState<"viz" | "data" | "control" | "adjustment">("viz");
  const tabs: [typeof tab, string][] = [
    ["viz", "Visualization"], ["data", "Data"], ["control", "Control"], ["adjustment", "Adjustment"],
  ];
  const content = { viz, data, control, adjustment };
  return (
    <div>
      <h1>{title}</h1>
      <div className="subtabs">
        {tabs.map(([id, label]) => (
          <button key={id} className={tab === id ? "on" : ""} onClick={() => setTab(id)}>{label}</button>
        ))}
      </div>
      <div className="subpage">{content[tab] ?? <div className="kv">— {tab} page pending —</div>}</div>
    </div>
  );
}

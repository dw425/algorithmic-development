import { useState } from "react";
import { GlobalProvider } from "./GlobalControls";
import Platform from "./Platform";
import Explore from "./Explore";
import "./App.css";

export default function App() {
  const [mode, setMode] = useState<"flow" | "explore">("flow");
  return (
    <GlobalProvider>
      <div className="shell">
        <header className="topbar">
          <div className="brand">⬡ DataForge</div>
          <div style={{ display: "flex", gap: 6, marginLeft: 16 }}>
            <button className={`tab ${mode === "flow" ? "on" : ""}`} onClick={() => setMode("flow")}>◆ Flow</button>
            <button className={`tab ${mode === "explore" ? "on" : ""}`} onClick={() => setMode("explore")}>Explore</button>
          </div>
        </header>
        {mode === "flow" ? <Platform /> : <Explore />}
      </div>
    </GlobalProvider>
  );
}

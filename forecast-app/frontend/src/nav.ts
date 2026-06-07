// Single source of truth for the DataForge information architecture: seven top-level tabs, each
// with a set of sub-views (the visualizers). Consumed by both Layout (chrome) and the router.
export type Accent = "data" | "models" | "forecast" | "geometry" | "universe" | "flow" | "diagnostics";
export interface NavView { path: string; label: string; }
export interface NavTab { id: string; label: string; accent: Accent; views: NavView[]; }

export const TABS: NavTab[] = [
  {
    id: "data", label: "Data", accent: "data",
    views: [
      { path: "/data", label: "Datasets" },
      { path: "/data/explore", label: "Explore" },
      { path: "/data/harmonize", label: "Harmonize" },
      { path: "/data/sample", label: "Sample" },
      { path: "/data/clean", label: "Clean & Stationarity" },
    ],
  },
  {
    id: "models", label: "Models", accent: "models",
    views: [
      { path: "/models", label: "Model Lab" },
      { path: "/models/automl", label: "AutoML leaderboard" },
      { path: "/models/importance", label: "Explainability" },
      { path: "/models/base", label: "Base pool & ρ" },
    ],
  },
  {
    id: "forecast", label: "Forecast", accent: "forecast",
    views: [
      { path: "/forecast", label: "Forecast" },
      { path: "/forecast/predictions", label: "Predictions" },
      { path: "/forecast/horizons", label: "Multi-horizon" },
      { path: "/forecast/backtest", label: "Backtest" },
      { path: "/forecast/tpa", label: "Threaded Point (TPA)" },
    ],
  },
  {
    id: "geometry", label: "Geometry", accent: "geometry",
    views: [
      { path: "/geometry/cloud", label: "Vector cloud" },
      { path: "/geometry/cluster", label: "3D clusters" },
      { path: "/geometry/constellation", label: "Constellation" },
      { path: "/geometry/dependency", label: "Dependency map" },
      { path: "/geometry/funnel", label: "Funnel" },
    ],
  },
  {
    id: "universe", label: "Universe", accent: "universe",
    views: [
      { path: "/universe", label: "Universe" },
      { path: "/universe/compare", label: "Compare" },
      { path: "/universe/repository", label: "Repository" },
    ],
  },
  {
    id: "flow", label: "Flow Builder", accent: "flow",
    views: [{ path: "/flow", label: "Canvas" }],
  },
  {
    id: "diagnostics", label: "Diagnostics", accent: "diagnostics",
    views: [
      { path: "/diagnostics/predictability", label: "Predictability" },
      { path: "/diagnostics/calibration", label: "Calibration" },
      { path: "/diagnostics/mcs", label: "Model Confidence" },
      { path: "/diagnostics/drift", label: "Drift & shift" },
    ],
  },
];

export function tabForPath(pathname: string): NavTab {
  const seg = pathname.split("/")[1] || "data";
  return TABS.find((t) => t.id === seg) ?? TABS[0];
}

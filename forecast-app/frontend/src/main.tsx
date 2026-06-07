import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import "./theme.css";       // Tailwind + DataForge tokens (new design)
import "./App.css";         // legacy classes still used by the Flow canvas + Explore
import { GlobalProvider } from "./GlobalControls";
import Layout from "./Layout";
import Datasets from "./pages/Datasets";
import ForecastView from "./pages/ForecastView";
import ModelLabView from "./pages/ModelLabView";
import UniverseView from "./pages/UniverseView";
import Soon from "./pages/Soon";
import Explore from "./Explore";
import Platform from "./Platform";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <GlobalProvider>
      <BrowserRouter>
        <Layout>
          <Routes>
            <Route path="/" element={<Navigate to="/data" replace />} />
            {/* Data */}
            <Route path="/data" element={<Datasets />} />
            <Route path="/data/explore" element={<Explore />} />
            <Route path="/data/harmonize" element={<Soon title="Harmonize" desc="Type coercion, missing-value strategies, outlier conditioning, normalization, encoding — with live before/after." endpoint="/api/datasets/{id}/harmonize" />} />
            <Route path="/data/sample" element={<Soon title="Sample" desc="Train/test, rolling-origin+embargo, bootstrap, stratified — with a visual split timeline." endpoint="/api/datasets/{id}/sample" />} />
            <Route path="/data/clean" element={<Soon title="Clean & Stationarity" desc="Benford/Hampel cleaning and ADF/KPSS/STL stationarity for the active series." endpoint="/api/clean, /api/stationarity" />} />
            {/* Models */}
            <Route path="/models" element={<ModelLabView />} />
            <Route path="/models/automl" element={<Soon title="AutoML leaderboard" desc="Run a curated model set and rank by R²/RMSE; pick the best to feed downstream." endpoint="/api/datasets/{id}/model (leaderboard)" />} />
            <Route path="/models/importance" element={<Soon title="Explainability" desc="Permutation importance per feature for any model." endpoint="modellab.importance" />} />
            <Route path="/models/base" element={<Soon title="Base pool & ρ" desc="The 11-model base pool, per-model next-step votes, and error-correlation ρ / effective models." endpoint="/api/models" />} />
            {/* Forecast */}
            <Route path="/forecast" element={<ForecastView />} />
            <Route path="/forecast/predictions" element={<Soon title="Predictions" desc="Next-step forecast for each selected stock: point + range + 1,980-vector cloud consensus + model votes." endpoint="/api/predict" />} />
            <Route path="/forecast/horizons" element={<Soon title="Multi-horizon" desc="Coverage + width at 7/30/90 days with purge/embargo." endpoint="/api/horizons" />} />
            <Route path="/forecast/backtest" element={<Soon title="Backtest" desc="Anchor at chosen dates, forecast 1/7/30/90d, compare to actuals, accuracy-by-horizon + inverse drift." endpoint="/api/backtest" />} />
            <Route path="/forecast/tpa" element={<Soon title="Threaded Point Analysis" desc="The 201 fan vectors, actual in red, top-3 winning offset lines over the period." endpoint="/api/tpa" />} />
            {/* Geometry */}
            <Route path="/geometry/cloud" element={<Soon title="Vector cloud" desc="The 1,980-vector next-step cloud histogram and where forecasts cluster." endpoint="/api/cloud" />} />
            <Route path="/geometry/cluster" element={<Soon title="3D clusters" desc="1,980 vectors embedded in 3D (reach/value/drift), clustered 3 ways with consensus." endpoint="/api/geoconsensus" />} />
            <Route path="/geometry/constellation" element={<Soon title="Constellation" desc="Interactive node-graph: data-gravity communities + pipeline lineage (radial/tier/DAG)." endpoint="/api/louvain" />} />
            <Route path="/geometry/dependency" element={<Soon title="Dependency map" desc="Louvain communities + cluster-to-cluster dependency across stocks." endpoint="/api/louvain" />} />
            <Route path="/geometry/funnel" element={<Soon title="Funnel" desc="Vector drop-off through the refinement stages." endpoint="/api/funnel" />} />
            {/* Universe */}
            <Route path="/universe" element={<UniverseView />} />
            <Route path="/universe/compare" element={<Soon title="Compare" desc="Side-by-side metrics + small-multiples across the selected stocks." endpoint="/api/predict, /api/forecast" />} />
            <Route path="/universe/repository" element={<Soon title="Repository" desc="Full batch held-out validation across 1,000+ stocks: coverage, width, lift vs naive." endpoint="/api/runs" />} />
            {/* Flow */}
            <Route path="/flow" element={<Platform />} />
            {/* Diagnostics */}
            <Route path="/diagnostics/predictability" element={<Soon title="Predictability" desc="Hurst (DFA), Lyapunov, Takens embedding for the active series." endpoint="/api/predictability" />} />
            <Route path="/diagnostics/calibration" element={<Soon title="Calibration" desc="Empirical vs nominal coverage (reliability)." endpoint="/api/diagnostics" />} />
            <Route path="/diagnostics/mcs" element={<Soon title="Model Confidence Set" desc="Which models survive the MCS at the chosen margin." endpoint="/api/diagnostics" />} />
            <Route path="/diagnostics/drift" element={<Soon title="Drift & shift" desc="Page-Hinkley drift, PSI distribution shift, recent volatility." endpoint="/api/diagnostics" />} />
            <Route path="*" element={<Navigate to="/data" replace />} />
          </Routes>
        </Layout>
      </BrowserRouter>
    </GlobalProvider>
  </StrictMode>,
);

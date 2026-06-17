import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import "./theme.css";
import "./App.css";
import { GlobalProvider } from "./GlobalControls";
import Layout from "./Layout";
import Explore from "./Explore";
import Platform from "./Platform";
import Datasets from "./pages/Datasets";
import ForecastView from "./pages/ForecastView";
import ModelLabView from "./pages/ModelLabView";
import UniverseView from "./pages/UniverseView";
import { Harmonize, SampleView, CleanStationarity } from "./pages/DataPages";
import { AutoML, Importance, BasePool } from "./pages/ModelPages";
import { Predictions, MultiHorizon, Backtest, TPA } from "./pages/ForecastPages";
import { VectorCloud, Cluster3D, FunnelView, ConstellationView, DependencyMap } from "./pages/Geometry";
import { Predictability, Calibration, MCS, Drift } from "./pages/DiagnosticsPages";
import { Compare, Repository } from "./pages/UniverseExtra";
import EtlEmbed from "./pages/EtlEmbed";
import InsightsApp from "./insights/InsightsApp";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <GlobalProvider>
      <BrowserRouter>
        <Layout>
          <Routes>
            <Route path="/" element={<Navigate to="/data" replace />} />
            <Route path="/data" element={<Datasets />} />
            <Route path="/data/explore" element={<Explore />} />
            <Route path="/data/harmonize" element={<Harmonize />} />
            <Route path="/data/sample" element={<SampleView />} />
            <Route path="/data/clean" element={<CleanStationarity />} />
            <Route path="/models" element={<ModelLabView />} />
            <Route path="/models/automl" element={<AutoML />} />
            <Route path="/models/importance" element={<Importance />} />
            <Route path="/models/base" element={<BasePool />} />
            <Route path="/forecast" element={<ForecastView />} />
            <Route path="/forecast/predictions" element={<Predictions />} />
            <Route path="/forecast/horizons" element={<MultiHorizon />} />
            <Route path="/forecast/backtest" element={<Backtest />} />
            <Route path="/forecast/tpa" element={<TPA />} />
            <Route path="/geometry/cloud" element={<VectorCloud />} />
            <Route path="/geometry/cluster" element={<Cluster3D />} />
            <Route path="/geometry/constellation" element={<ConstellationView />} />
            <Route path="/geometry/dependency" element={<DependencyMap />} />
            <Route path="/geometry/funnel" element={<FunnelView />} />
            <Route path="/universe" element={<UniverseView />} />
            <Route path="/universe/compare" element={<Compare />} />
            <Route path="/universe/repository" element={<Repository />} />
            <Route path="/flow" element={<Platform />} />
            <Route path="/etl" element={<EtlEmbed />} />
            <Route path="/insights" element={<InsightsApp />} />
            <Route path="/diagnostics/predictability" element={<Predictability />} />
            <Route path="/diagnostics/calibration" element={<Calibration />} />
            <Route path="/diagnostics/mcs" element={<MCS />} />
            <Route path="/diagnostics/drift" element={<Drift />} />
            <Route path="*" element={<Navigate to="/data" replace />} />
          </Routes>
        </Layout>
      </BrowserRouter>
    </GlobalProvider>
  </StrictMode>,
);

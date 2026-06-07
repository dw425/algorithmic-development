import { useState, useEffect } from "react";

// The full etl-dep-viz (Pipeline Analyzer) app — all 7 views (Tier Diagram, Galaxy Map,
// Constellation, Explorer, Conflicts & Chains, Execution Order, Relationship Matrix) + its 12
// backend routers + DB — brought in whole and embedded. It runs as its own service on :8100.
const ETL_URL = "http://localhost:8100/";

export default function EtlEmbed() {
  const [up, setUp] = useState<boolean | null>(null);
  useEffect(() => {
    fetch(ETL_URL + "api/health").then((r) => setUp(r.ok)).catch(() => setUp(false));
  }, []);
  if (up === false) return (
    <div className="rounded-md border border-destructive/40 bg-destructive/10 text-destructive text-sm px-4 py-3">
      etl-dep-viz service isn't reachable at {ETL_URL}. Start it:
      <pre className="mt-2 text-xs">cd ip-triage/clones/etl-dep-viz/backend && uvicorn app.main:app --port 8100</pre>
    </div>
  );
  return (
    <div style={{ height: "calc(100vh - 150px)", margin: "-1.5rem" }}>
      <iframe title="etl-dep-viz" src={ETL_URL} style={{ width: "100%", height: "100%", border: "none" }} />
    </div>
  );
}

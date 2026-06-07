import "../etlviz/index.css";
import EtlApp from "../etlviz/App";

// etl-dep-viz (Pipeline Analyzer) rendered NATIVELY inside DataForge — same React tree, same
// process, calling the merged backend at /etl/api. Not an iframe, not a separate service.
export default function EtlNative() {
  return (
    <div className="etlviz-scope" style={{ margin: "-1.5rem" }}>
      <EtlApp />
    </div>
  );
}

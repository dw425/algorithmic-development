import { useEffect, useRef } from "react";
// @ts-expect-error - plotly dist has no types
import Plotly from "plotly.js-dist-min";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function Plot({ data, layout, height = 360 }: { data: any[]; layout?: any; height?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    Plotly.react(ref.current, data, {
      paper_bgcolor: "#151823", plot_bgcolor: "#151823", font: { color: "#c8cee0", size: 11 },
      margin: { l: 50, r: 16, t: 16, b: 40 }, showlegend: true,
      legend: { orientation: "h", y: -0.2 }, ...layout,
    }, { responsive: true, displayModeBar: false });
  }, [data, layout]);
  return <div ref={ref} style={{ width: "100%", height }} />;
}

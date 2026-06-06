import { useEffect, useRef } from "react";
// @ts-expect-error - plotly dist has no bundled types
import Plotly from "plotly.js-dist-min";

interface Props {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  layout?: any;
  height?: number;
}

export default function Plot({ data, layout, height = 360 }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const base = {
      paper_bgcolor: "#151823", plot_bgcolor: "#151823",
      font: { color: "#c8cee0", size: 11 },
      margin: { l: 48, r: 16, t: 16, b: 40 },
      showlegend: true, legend: { orientation: "h", y: -0.18 },
      ...layout,
    };
    Plotly.react(ref.current, data, base, { responsive: true, displayModeBar: false });
  }, [data, layout]);
  return <div ref={ref} style={{ width: "100%", height }} />;
}

import type { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { TABS, tabForPath, type Accent } from "./nav";
import { useGlobal } from "./GlobalControls";

// InsightHub-style shell: sticky top bar (wordmark + 7 accent-tinted tabs), a sub-view pill rail
// for the active tab, a context strip (active dataset / stocks), main content, and a footer.
const BORDER: Record<Accent, string> = {
  data: "border-tab-data", models: "border-tab-models", forecast: "border-tab-forecast",
  geometry: "border-tab-geometry", universe: "border-tab-universe", flow: "border-tab-flow",
  diagnostics: "border-tab-diagnostics", etl: "border-tab-etl",
};
const TEXT: Record<Accent, string> = {
  data: "text-tab-data", models: "text-tab-models", forecast: "text-tab-forecast",
  geometry: "text-tab-geometry", universe: "text-tab-universe", flow: "text-tab-flow",
  diagnostics: "text-tab-diagnostics", etl: "text-tab-etl",
};

function Mark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 512 512" fill="none" className={className} aria-label="DataForge">
      <polygon points="256,86 403,171 403,341 256,426 109,341 109,171" stroke="currentColor" strokeWidth="16" strokeLinejoin="miter" />
      <g stroke="currentColor" strokeWidth="9" strokeLinecap="round" opacity="0.6">
        <line x1="171" y1="287" x2="256" y2="372" /><line x1="256" y1="372" x2="341" y2="279" />
        <line x1="341" y1="279" x2="283" y2="263" /><line x1="269" y1="231" x2="305" y2="163" />
      </g>
      <circle cx="256" cy="256" r="28" fill="none" stroke="currentColor" strokeWidth="8" />
      <g fill="currentColor"><circle cx="171" cy="287" r="11" /><circle cx="256" cy="372" r="11" />
        <circle cx="341" cy="279" r="11" /><circle cx="256" cy="256" r="11" /><circle cx="305" cy="163" r="17" /></g>
    </svg>
  );
}

export default function Layout({ children }: { children: ReactNode }) {
  const loc = useLocation();
  const active = tabForPath(loc.pathname);
  const g = useGlobal();
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      <header className="shrink-0 border-b border-border bg-card">
        <div className="flex items-center gap-6 px-5">
          <Link to="/data" className="flex items-center gap-2 py-3 text-primary">
            <Mark className="h-6 w-6" />
            <span className="text-base font-extrabold tracking-[0.18em] text-foreground">DATAFORGE</span>
          </Link>
          <nav className="flex">
            {TABS.map((t) => {
              const on = t.id === active.id;
              return (
                <Link key={t.id} to={t.views[0].path}
                  className={`px-3.5 py-3 text-sm font-semibold transition-colors border-b-2 ${on ? `${BORDER[t.accent]} ${TEXT[t.accent]}` : "border-transparent text-muted-foreground hover:text-foreground"}`}>
                  {t.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      <div className="shrink-0 border-b border-border bg-card/60">
        <nav className="flex gap-1 px-5 py-1.5 overflow-x-auto">
          {active.views.map((v) => {
            const on = loc.pathname === v.path;
            return (
              <Link key={v.path} to={v.path}
                className={`whitespace-nowrap rounded px-3 py-1.5 text-xs font-medium transition-colors ${on ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"}`}>
                {v.label}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* context strip — active dataset + stocks, single source for every page */}
      <div className="shrink-0 border-b border-border bg-background px-5 py-1 text-[11px] text-muted-foreground flex gap-4">
        <span>dataset: <span className="text-foreground">{g.dataset || "—"}</span></span>
        <span>stocks: <span className="text-foreground">{g.stocks.join(", ") || "none"}</span></span>
        <span>target {g.target}% · {g.granularity}</span>
      </div>

      <main className="flex-1 overflow-y-auto p-6">{children}</main>

      <footer className="shrink-0 border-t border-border bg-card px-5 py-1.5 text-[11px] text-muted-foreground">
        DataForge · {active.label} · unified data-science platform
      </footer>
    </div>
  );
}

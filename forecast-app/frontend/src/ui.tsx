import type { ReactNode } from "react";

// Shared UI primitives (Tailwind, InsightHub-style). Cards, KPIs, headings, badges, controls.
export function Card({ title, right, children, className = "" }:
  { title?: string; right?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-lg border border-border bg-card p-4 ${className}`}>
      {(title || right) && (
        <div className="flex items-center justify-between mb-3">
          {title && <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{title}</h2>}
          {right}
        </div>
      )}
      {children}
    </div>
  );
}

export function KPI({ label, value, tone = "default" }:
  { label: string; value: ReactNode; tone?: "default" | "good" | "warn" | "bad" }) {
  const c = tone === "good" ? "text-success" : tone === "bad" ? "text-destructive" : tone === "warn" ? "text-warning" : "text-foreground";
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3">
      <div className={`text-2xl font-bold mono ${c}`}>{value}</div>
      <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
    </div>
  );
}

export function PageTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-4">
      <h1 className="text-xl font-bold">{title}</h1>
      {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
    </div>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

export function Select({ value, onChange, children }:
  { value: string | number; onChange: (v: string) => void; children: ReactNode }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}
      className="rounded-md border border-border bg-background px-2.5 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary">
      {children}
    </select>
  );
}

export function Button({ onClick, children, variant = "primary", disabled }:
  { onClick?: () => void; children: ReactNode; variant?: "primary" | "ghost"; disabled?: boolean }) {
  const base = "rounded-md px-3 py-1.5 text-sm font-semibold transition-colors disabled:opacity-50";
  const cls = variant === "primary"
    ? "bg-primary text-primary-foreground hover:opacity-90"
    : "border border-border text-muted-foreground hover:text-foreground hover:bg-accent";
  return <button onClick={onClick} disabled={disabled} className={`${base} ${cls}`}>{children}</button>;
}

export function Loading({ what = "Loading" }: { what?: string }) {
  return <div className="text-sm text-muted-foreground animate-pulse">{what}…</div>;
}
export function ErrorBox({ msg }: { msg: string }) {
  return <div className="rounded-md border border-destructive/40 bg-destructive/10 text-destructive text-sm px-3 py-2">{msg}</div>;
}

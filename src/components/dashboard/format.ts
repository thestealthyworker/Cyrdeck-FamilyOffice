/** Formatting and small pure helpers shared across the dashboard UI. */

export function formatMoney(value: number | null | undefined, opts?: { compact?: boolean }): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  if (opts?.compact) {
    const abs = Math.abs(value);
    if (abs >= 1_000_000) {
      return `$${(value / 1_000_000).toFixed(2).replace(/\.00$/, "")}M`;
    }
    if (abs >= 1_000) {
      return `$${(value / 1_000).toFixed(0)}K`;
    }
  }
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

export function formatPct(value: number | null | undefined, digits = 0): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  // Accept either 0-1 fractions or already-scaled percentages.
  const pct = Math.abs(value) <= 1 ? value * 100 : value;
  return `${pct.toFixed(digits)}%`;
}

export function formatMultiple(value: number | null | undefined, digits = 2): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `${value.toFixed(digits)}×`;
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "2-digit", timeZone: "UTC" });
}

export function edgeTypeLabel(kind: string): string {
  switch (kind) {
    case "holds_equity":
      return "Equity";
    case "holds_debt":
      return "Debt";
    case "guarantees":
      return "Guarantee";
    case "owns_property":
      return "Property";
    case "manages":
      return "Manages";
    default:
      return kind;
  }
}

export function severityLabel(severity: string): string {
  switch (severity) {
    case "critical":
      return "Critical";
    case "high":
      return "High";
    case "medium":
      return "Medium";
    default:
      return severity;
  }
}

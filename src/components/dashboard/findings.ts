import type { EntityExposure, Finding, Severity } from "@/components/dashboard/types";

const SEVERITY_RANK: Record<Severity, number> = { critical: 3, high: 2, medium: 1 };

/**
 * Ranks findings by severity (critical > high > medium), then by amount descending.
 * The hero always features `rankFindings(findings)[0]` — whichever finding is
 * genuinely most severe, not a hardcoded finding id. Unknown severities sort last.
 */
export function rankFindings(findings: Finding[]): Finding[] {
  return [...findings].sort((a, b) => {
    const severityDiff = (SEVERITY_RANK[b.severity] ?? 0) - (SEVERITY_RANK[a.severity] ?? 0);
    if (severityDiff !== 0) return severityDiff;
    return b.amount - a.amount;
  });
}

/**
 * The entity a finding is "about" for diagram purposes: among the entities named on
 * the finding, the one reached via the most distinct edge types (the convergence
 * hub). Falls back to the first named entity found in `entities` if none stands out.
 */
export function pickHubEntity(
  finding: Finding,
  entities: EntityExposure[],
): EntityExposure | undefined {
  const candidates = entities.filter((e) => finding.entities.includes(e.name));
  if (candidates.length === 0) return undefined;
  return candidates.reduce((best, e) => (e.edgeTypeCount > best.edgeTypeCount ? e : best), candidates[0]);
}

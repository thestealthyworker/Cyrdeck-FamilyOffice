import { ConcentrationHero } from "@/components/dashboard/ConcentrationHero";
import { ConvergenceHero } from "@/components/dashboard/ConvergenceHero";
import { GenericFindingHero } from "@/components/dashboard/GenericFindingHero";
import { pickHubEntity } from "@/components/dashboard/findings";
import type { EntityExposure, Finding } from "@/components/dashboard/types";
import { EmptyState } from "@/components/ui/EmptyState";

interface HeroProps {
  finding: Finding | undefined;
  entities: EntityExposure[];
  peBookValue: number;
}

/**
 * Routes the single highest-severity finding to the layout suited to its shape.
 * `finding` must already be the top of `rankFindings(...)` — this component does not
 * re-rank. Cross-asset-class and hidden-concentration findings get bespoke visuals;
 * any other finding id (the engine can grow new rule types) degrades gracefully to a
 * generic, still fully data-driven hero instead of a broken diagram.
 */
export function Hero({ finding, entities, peBookValue }: HeroProps) {
  if (!finding) {
    return (
      <EmptyState
        title="No findings yet"
        detail="Nothing crosses the risk thresholds yet, or no documents have been ingested. Upload statements, capital calls, or credit schedules and the graph will surface exposure the moment it can be traced."
      />
    );
  }

  if (finding.id === "cross_asset_class") {
    const entity = pickHubEntity(finding, entities);
    if (entity) return <ConvergenceHero finding={finding} entity={entity} />;
  }

  if (finding.id === "hidden_concentration") {
    const entity = entities.find((e) => e.name === finding.entities[0]);
    return <ConcentrationHero finding={finding} entity={entity} peBookValue={peBookValue} />;
  }

  return <GenericFindingHero finding={finding} />;
}

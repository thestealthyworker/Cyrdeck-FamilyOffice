import { formatMoney } from "@/components/dashboard/format";
import { SeverityTag } from "@/components/ui/SeverityTag";
import { SourceTag } from "@/components/ui/SourceTag";
import type { Finding } from "@/components/dashboard/types";

interface GenericFindingHeroProps {
  finding: Finding;
}

/**
 * Fallback hero for any finding kind that does not yet have a bespoke visual (the
 * engine can grow new rule types over time; the UI must not break when it does).
 * Entirely driven by the finding payload — headline, detail, amount, sources — with
 * no invented narrative.
 */
export function GenericFindingHero({ finding }: GenericFindingHeroProps) {
  return (
    <div className="hero hero--generic">
      <div className="hero__narrative">
        <p className="hero__eyebrow">
          Finding 01 <SeverityTag severity={finding.severity} />
        </p>
        <h3 id="headline-claim" className="hero__claim">
          {finding.headline}
        </h3>
        <p className="hero__lede">{finding.detail}</p>
        <div className="hero__total">
          <span className="hero__total-label">Amount</span>
          <span className="hero__total-amount">{formatMoney(finding.amount)}</span>
        </div>
        <div className="hero__sources">
          {finding.sourceDocuments.map((doc, i) => (
            <SourceTag key={doc + i} document={doc} asOfDate={finding.asOfDates[i] ?? finding.asOfDates[0]} />
          ))}
        </div>
        {finding.entities.length ? (
          <p className="finding-card__entities">{finding.entities.join(" · ")}</p>
        ) : null}
      </div>
    </div>
  );
}

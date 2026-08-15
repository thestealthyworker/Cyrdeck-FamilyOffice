import { formatMoney, formatPct } from "@/components/dashboard/format";
import { SourceTag } from "@/components/ui/SourceTag";
import type { EntityExposure, Finding } from "@/components/dashboard/types";

interface ConcentrationHeroProps {
  finding: Finding;
  entity: EntityExposure | undefined;
  peBookValue: number;
}

/**
 * Layout for hidden_concentration findings: one company reached through 2+ funds that
 * each report it as a modest, "diversified" position — until the look-through legs are
 * laid side by side and summed against the PE book. Every bar, percentage, and fund
 * name below comes from `entity.paths`; nothing is a fixed three-role diagram.
 */
export function ConcentrationHero({ finding, entity, peBookValue }: ConcentrationHeroProps) {
  const entityName = entity?.name ?? finding.entities[0] ?? "—";
  const pctOfBook = peBookValue > 0 ? finding.amount / peBookValue : 0;
  const paths = entity?.paths ?? [];

  return (
    <div className="hero hero--concentration">
      <div className="hero__narrative">
        <p className="hero__eyebrow">Finding 01 — hidden concentration</p>
        <h3 id="headline-claim" className="hero__claim">
          Diversified on paper. Concentrated in fact.
        </h3>
        <p className="hero__lede">{finding.detail}</p>
        <div className="hero__total">
          <span className="hero__total-label">Combined look-through value</span>
          <span className="hero__total-amount">{formatMoney(finding.amount)}</span>
          <span className="hero__total-caption">
            {formatPct(pctOfBook)} of the {formatMoney(peBookValue, { compact: true })} PE book, reached
            through {paths.length || finding.entities.length - 1} separate fund
            {paths.length === 1 ? "" : "s"} — no single statement shows this position
          </span>
        </div>
        <div className="hero__sources">
          {finding.sourceDocuments.map((doc, i) => (
            <SourceTag key={doc + i} document={doc} asOfDate={finding.asOfDates[i] ?? finding.asOfDates[0]} />
          ))}
        </div>
      </div>

      <div
        className="concentration-bars"
        role="img"
        aria-label={`${entityName} is reached through ${paths.length} funds, together worth ${formatMoney(finding.amount)}, or ${formatPct(pctOfBook)} of the private equity book.`}
      >
        {paths.map((path, i) => {
          const lastHop = path.hops.at(-1);
          const fundName = lastHop?.from ?? "—";
          const weight = lastHop?.weightPct ?? null;
          return (
            <div className="concentration-bar" key={`${fundName}-${i}`}>
              <div className="concentration-bar__head">
                <span className="concentration-bar__fund">{fundName}</span>
                <span className="concentration-bar__pct">
                  {weight !== null ? formatPct(weight) : "—"} of fund
                </span>
              </div>
              <div className="concentration-bar__track">
                <div
                  className="concentration-bar__fill"
                  style={{ width: `${Math.min(100, (weight ?? 0) * 100)}%` }}
                />
              </div>
              <div className="concentration-bar__foot">
                <span className="concentration-bar__amount">{formatMoney(lastHop?.value ?? 0)}</span>
                <SourceTag document={path.sourceDocument} asOfDate={path.asOfDate} confidence={path.confidence} />
              </div>
            </div>
          );
        })}

        <div className="concentration-total">
          <span className="concentration-total__label">{entityName}</span>
          <span className="concentration-total__value">{formatPct(pctOfBook)} of PE book</span>
        </div>
      </div>
    </div>
  );
}

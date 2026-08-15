import { formatMoney } from "@/components/dashboard/format";
import { SeverityTag } from "@/components/ui/SeverityTag";
import { SourceTag } from "@/components/ui/SourceTag";
import type { Finding } from "@/components/dashboard/types";

interface FindingCardProps {
  finding: Finding;
  index: number;
  documentIdByFilename?: Map<string, string>;
}

/** A supporting finding — deliberately smaller and quieter than the hero convergence. */
export function FindingCard({ finding, index, documentIdByFilename }: FindingCardProps) {
  return (
    <article className="finding-card" aria-labelledby={`finding-${finding.id}-heading`}>
      <div className="finding-card__top">
        <span className="finding-card__index">{String(index).padStart(2, "0")}</span>
        <SeverityTag severity={finding.severity} />
      </div>
      <h4 id={`finding-${finding.id}-heading`} className="finding-card__headline">
        {finding.headline}
      </h4>
      <p className="finding-card__detail">{finding.detail}</p>
      <div className="finding-card__amount">{formatMoney(finding.amount)}</div>
      {finding.entities.length ? (
        <p className="finding-card__entities">{finding.entities.join(" · ")}</p>
      ) : null}
      <div className="finding-card__sources">
        {finding.sourceDocuments.map((doc, i) => (
          <SourceTag
            key={doc + i}
            document={doc}
            asOfDate={finding.asOfDates[i] ?? finding.asOfDates[0]}
            documentId={documentIdByFilename?.get(doc)}
          />
        ))}
      </div>
    </article>
  );
}

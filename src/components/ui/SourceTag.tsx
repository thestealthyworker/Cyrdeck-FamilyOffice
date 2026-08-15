import { formatDate } from "@/components/dashboard/format";

interface SourceTagProps {
  document: string | null;
  asOfDate?: string | null;
  confidence?: number | null;
  /** Document id, when known — turns the chip into a link that opens the source file. */
  documentId?: string | null;
}

/** A small provenance chip: source document + as-of date, the trust anchor for every number. */
export function SourceTag({ document, asOfDate, confidence, documentId }: SourceTagProps) {
  const content = (
    <>
      <svg className="source-tag__icon" viewBox="0 0 16 16" aria-hidden="true">
        <path
          d="M4 1.5h5.5L12.5 4.5V14.5H4V1.5Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.1"
          strokeLinejoin="round"
        />
        <path d="M9.5 1.5V4.5H12.5" fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" />
      </svg>
      <span className="source-tag__doc">{document ?? "source pending"}</span>
      {asOfDate ? <span className="source-tag__date">as of {formatDate(asOfDate)}</span> : null}
      {typeof confidence === "number" ? (
        <span className="source-tag__confidence" data-low={confidence < 0.75}>
          {Math.round(confidence * 100)}% conf.
        </span>
      ) : null}
    </>
  );

  if (documentId) {
    return (
      <a
        className="source-tag source-tag--link"
        href={`/api/documents/${documentId}/file`}
        target="_blank"
        rel="noopener noreferrer"
        title={`Open ${document ?? "source document"}`}
      >
        {content}
        <span className="source-tag__open" aria-hidden="true">
          ↗
        </span>
      </a>
    );
  }

  return (
    <span className="source-tag" title={document ?? "Source document unavailable"}>
      {content}
    </span>
  );
}

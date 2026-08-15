import { formatDate } from "@/components/dashboard/format";
import type { DocumentRecord } from "@/components/dashboard/useDocuments";

interface DocumentsPanelProps {
  documents: DocumentRecord[];
}

const DOC_TYPE_LABEL: Record<string, string> = {
  capital_call: "Capital call",
  statement: "Statement",
  credit_schedule: "Credit schedule",
  other: "Other",
};

const STATUS_LABEL: Record<string, string> = {
  processing: "Processing",
  extracted: "Extracted",
  failed: "Failed",
};

function docTypeLabel(docType: string | null): string {
  if (!docType) return "—";
  return DOC_TYPE_LABEL[docType] ?? docType.replace(/_/g, " ");
}

function statusLabel(status: string): string {
  return STATUS_LABEL[status] ?? status;
}

/**
 * The audit surface: every document the system has actually ingested, honestly
 * labelled — including failed extractions with their error, never hidden. Each row
 * links straight to the source file via a 5-minute signed URL.
 */
export function DocumentsPanel({ documents }: DocumentsPanelProps) {
  if (documents.length === 0) {
    return (
      <div className="documents-panel documents-panel--empty">
        <p>No documents ingested yet.</p>
      </div>
    );
  }

  return (
    <div className="documents-panel" role="table" aria-label="Ingested documents">
      <div className="documents-panel__head" role="row">
        <span role="columnheader" className="documents-panel__col-name">Filename</span>
        <span role="columnheader" className="documents-panel__col-type">Type</span>
        <span role="columnheader" className="documents-panel__col-counterparty">Counterparty</span>
        <span role="columnheader" className="documents-panel__col-asof">As-of</span>
        <span role="columnheader" className="documents-panel__col-status">Status</span>
        <span role="columnheader" className="documents-panel__col-open">Open</span>
      </div>
      {documents.map((doc) => (
        <div className="documents-panel__row" role="row" key={doc.id}>
          <span role="cell" className="documents-panel__col-name" title={doc.filename}>
            {doc.filename}
          </span>
          <span role="cell" className="documents-panel__col-type">
            {docTypeLabel(doc.doc_type)}
          </span>
          <span role="cell" className="documents-panel__col-counterparty">
            {doc.counterparty ?? "—"}
          </span>
          <span role="cell" className="documents-panel__col-asof">
            {doc.as_of_date ? formatDate(doc.as_of_date) : "—"}
          </span>
          <span role="cell" className="documents-panel__col-status">
            <span
              className="documents-panel__status"
              data-status={doc.extraction_status}
              title={doc.extraction_status === "failed" ? doc.extraction_error ?? undefined : undefined}
            >
              {statusLabel(doc.extraction_status)}
            </span>
            {doc.extraction_status === "failed" && doc.extraction_error ? (
              <span className="documents-panel__error">{doc.extraction_error}</span>
            ) : null}
          </span>
          <span role="cell" className="documents-panel__col-open">
            <a
              className="documents-panel__open-link"
              href={`/api/documents/${doc.id}/file`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Open ↗
            </a>
          </span>
        </div>
      ))}
    </div>
  );
}

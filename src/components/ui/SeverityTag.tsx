import { severityLabel } from "@/components/dashboard/format";
import type { Severity } from "@/components/dashboard/types";

interface SeverityTagProps {
  severity: Severity | string;
}

export function SeverityTag({ severity }: SeverityTagProps) {
  return (
    <span className={`severity-tag severity-tag--${severity}`}>
      <span className="severity-tag__dot" aria-hidden="true" />
      {severityLabel(severity)}
    </span>
  );
}

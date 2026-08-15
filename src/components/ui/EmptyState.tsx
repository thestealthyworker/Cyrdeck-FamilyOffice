import type { ReactNode } from "react";

interface EmptyStateProps {
  title: string;
  detail: string;
  children?: ReactNode;
}

/** Honest "nothing here yet" state — never a fabricated skeleton of a portfolio that
 * does not exist. Used for first-run and for any section with no data to show. */
export function EmptyState({ title, detail, children }: EmptyStateProps) {
  return (
    <div className="empty-state" role="status">
      <p className="empty-state__title">{title}</p>
      <p className="empty-state__detail">{detail}</p>
      {children}
    </div>
  );
}

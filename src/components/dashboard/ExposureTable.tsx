"use client";

import { useMemo, useState } from "react";
import { edgeTypeLabel, formatDate, formatMoney } from "@/components/dashboard/format";
import { SourceTag } from "@/components/ui/SourceTag";
import type { EntityExposure } from "@/components/dashboard/types";

interface ExposureTableProps {
  entities: EntityExposure[];
  documentIdByFilename?: Map<string, string>;
}

type ViewMode = "company" | "fund";

/**
 * Every number traces to a source document and an as-of date — this is the drill-down.
 *
 * IMPORTANT: `entities` mixes fund-level rows (e.g. Kestrel Ventures Fund III) with the
 * portfolio-company/counterparty rows reached by looking through those funds (e.g. Aurex,
 * Vertexa). Summing the whole array double-counts by construction, so this table never
 * renders a grand total — it groups by `entityType` instead and lets the reader pick the
 * level they want to see.
 */
export function ExposureTable({ entities, documentIdByFilename }: ExposureTableProps) {
  const [view, setView] = useState<ViewMode>("company");
  const [openId, setOpenId] = useState<string | null>(null);

  const companyRows = useMemo(() => entities.filter((e) => e.entityType !== "fund"), [entities]);
  const fundRows = useMemo(() => entities.filter((e) => e.entityType === "fund"), [entities]);

  const visible = view === "company" ? companyRows : fundRows;
  const sorted = [...visible].sort((a, b) => {
    const totalA = a.directTotal + a.guaranteeNotional;
    const totalB = b.directTotal + b.guaranteeNotional;
    return totalB - totalA;
  });

  return (
    <div>
      <div className="exposure-table__toggle" role="tablist" aria-label="Exposure view">
        <button
          type="button"
          role="tab"
          aria-selected={view === "company"}
          className="exposure-table__toggle-btn"
          onClick={() => setView("company")}
        >
          Companies &amp; counterparties
          <span className="exposure-table__toggle-count">{companyRows.length}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={view === "fund"}
          className="exposure-table__toggle-btn"
          onClick={() => setView("fund")}
        >
          Funds &amp; vehicles
          <span className="exposure-table__toggle-count">{fundRows.length}</span>
        </button>
      </div>
      <p className="exposure-table__caveat">
        These two views are different levels of the same graph — a company row is reached
        <em> through</em> a fund row above it. Do not add them together.
      </p>

      <div className="exposure-table" role="table" aria-label="Exposure by entity">
        <div className="exposure-table__head" role="row">
          <span role="columnheader" className="exposure-table__col-name">Entity</span>
          <span role="columnheader" className="exposure-table__col-roles">Roles</span>
          <span role="columnheader" className="exposure-table__col-total">Direct exposure</span>
          <span role="columnheader" className="exposure-table__col-guarantee">Guarantee notional</span>
          <span role="columnheader" className="exposure-table__col-asof">As-of</span>
        </div>

        {sorted.map((entity) => {
        const isOpen = openId === entity.id;
        const edgeTypes = Object.keys(entity.byEdgeType);
        const mixedDates = entity.asOfEarliest !== entity.asOfLatest;

        return (
          <div className="exposure-table__group" key={entity.id}>
            <button
              type="button"
              role="row"
              className="exposure-table__row"
              aria-expanded={isOpen}
              onClick={() => setOpenId(isOpen ? null : entity.id)}
            >
              <span role="cell" className="exposure-table__col-name">
                <span className="exposure-table__disclosure" aria-hidden="true">{isOpen ? "−" : "+"}</span>
                {entity.name}
                <span className="exposure-table__type">{entity.entityType}</span>
              </span>
              <span role="cell" className="exposure-table__col-roles">
                {edgeTypes.map((type) => (
                  <span key={type} className={`role-chip role-chip--${type}`}>
                    {edgeTypeLabel(type)}
                  </span>
                ))}
              </span>
              <span role="cell" className="exposure-table__col-total exposure-table__mono">
                {formatMoney(entity.directTotal)}
              </span>
              <span role="cell" className="exposure-table__col-guarantee exposure-table__mono">
                {entity.guaranteeNotional ? formatMoney(entity.guaranteeNotional) : "—"}
              </span>
              <span role="cell" className="exposure-table__col-asof">
                {mixedDates ? (
                  <span className="exposure-table__mixed-dates" title="Values span multiple as-of dates">
                    {formatDate(entity.asOfEarliest)} → {formatDate(entity.asOfLatest)}
                  </span>
                ) : (
                  formatDate(entity.asOfLatest)
                )}
              </span>
            </button>

            {isOpen ? (
              <div className="exposure-table__detail">
                {entity.paths.length === 0 ? (
                  <p className="exposure-table__empty">No traversal paths recorded for this entity yet.</p>
                ) : (
                  <ul className="exposure-table__paths">
                    {entity.paths.map((path, i) => (
                      <li key={i} className="exposure-table__path">
                        <span className="exposure-table__path-chain">
                          {path.hops.map((hop, hi) => (
                            <span key={hi} className="exposure-table__path-hop">
                              {hi === 0 ? hop.from : null}
                              <span className="exposure-table__path-arrow"> → </span>
                              <strong>{hop.to}</strong>
                              <em className="exposure-table__path-edge"> {edgeTypeLabel(hop.edgeType)}</em>
                              {hop.value ? <span> {formatMoney(hop.value)}</span> : null}
                            </span>
                          ))}
                        </span>
                        <SourceTag
                          document={path.sourceDocument}
                          asOfDate={path.asOfDate}
                          confidence={path.confidence}
                          documentId={path.sourceDocument ? documentIdByFilename?.get(path.sourceDocument) : undefined}
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : null}
          </div>
        );
        })}
      </div>
    </div>
  );
}

import { formatMoney } from "@/components/dashboard/format";
import { SourceTag } from "@/components/ui/SourceTag";
import type { CSSProperties } from "react";
import type { EdgeKind, EntityExposure, ExposurePath, Finding } from "@/components/dashboard/types";

interface ConvergenceHeroProps {
  finding: Finding;
  entity: EntityExposure;
  documentIdByFilename?: Map<string, string>;
}

interface Role {
  edgeType: EdgeKind;
  amount: number;
  parent: string;
  path: ExposurePath | undefined;
  color: string;
}

// Cycled by role index so any number of edge types gets a distinct, semantic-ish color
// without needing a bespoke CSS class per edge kind.
const ROLE_PALETTE = [
  "var(--role-equity)",
  "var(--role-debt)",
  "var(--role-guarantee)",
  "var(--medium)",
  "var(--high)",
  "var(--critical)",
];

const ROLE_HEADING: Partial<Record<EdgeKind, string>> = {
  holds_equity: "EQUITY — HELD INSIDE",
  holds_debt: "DEBT — HELD BY",
  guarantees: "GUARANTEE — WRITTEN BY",
  owns_property: "PROPERTY — OWNED VIA",
  manages: "MANAGED BY",
};

const NODE_WIDTH = 200;
const NODE_GAP = 30;
const NODE_TOP = 52;
const NODE_HEIGHT = 78;
const TARGET_WIDTH = 260;
const TARGET_TOP = 350;
const TARGET_HEIGHT = 92;
const MARGIN = 10;

// SVG text does not wrap. Legal suffixes overflow the role boxes and add nothing at a
// glance — the full names are printed in the traversal paths below.
const short = (name: string) => name.replace(/,?\s+(L\.?P\.?|LLC|Inc\.?|Ltd\.?|Corp\.?)$/i, "");

const parentOf = (path: ExposurePath | undefined, entityName: string): string => {
  const direct = path?.hops.find((h) => h.to === entityName)?.from;
  return direct ?? path?.hops.at(-1)?.from ?? "—";
};

const roleHeading = (edgeType: EdgeKind): string =>
  ROLE_HEADING[edgeType] ?? edgeType.replace(/_/g, " ").toUpperCase();

/**
 * THE centrepiece for cross-asset-class findings: an entity reachable via 2+ distinct
 * edge types converges N role boxes onto one target node — the convergence *is* the
 * finding, legible without narration. Every role, amount, name, and path here comes
 * from `entity.paths` / `entity.byEdgeType`, so this scales from two roles to however
 * many the graph actually produces — nothing is fixed to exactly three.
 */
export function ConvergenceHero({ finding, entity, documentIdByFilename }: ConvergenceHeroProps) {
  const entityName = entity.name;
  const edgeTypes = Object.keys(entity.byEdgeType) as EdgeKind[];

  const roles: Role[] = edgeTypes.map((edgeType, i) => {
    const path = entity.paths.find((p) => p.hops.some((h) => h.edgeType === edgeType));
    return {
      edgeType,
      amount: entity.byEdgeType[edgeType] ?? 0,
      parent: parentOf(path, entityName),
      path,
      color: ROLE_PALETTE[i % ROLE_PALETTE.length],
    };
  });

  const n = Math.max(roles.length, 1);
  const totalWidth = MARGIN * 2 + n * NODE_WIDTH + (n - 1) * NODE_GAP;
  const targetCenterX = totalWidth / 2;
  const targetX = targetCenterX - TARGET_WIDTH / 2;

  // The insight in this finding class is that the SAME counterparty shows up behind
  // more than one role — draw the bridge only when the data actually shows that,
  // never as decoration.
  const parentGroups = new Map<string, number[]>();
  roles.forEach((role, i) => {
    const list = parentGroups.get(role.parent) ?? [];
    list.push(i);
    parentGroups.set(role.parent, list);
  });
  const sharedParentIndices = Array.from(parentGroups.values()).find((list) => list.length >= 2);
  const sharedParentName = sharedParentIndices ? roles[sharedParentIndices[0]].parent : undefined;

  const total = finding.amount;

  const ariaLabel = `Diagram: ${entityName} is reached through ${roles.length} roles — ${roles
    .map((r) => `${roleHeading(r.edgeType).toLowerCase()} via ${r.parent} (${formatMoney(r.amount)})`)
    .join("; ")}${sharedParentName ? `. ${sharedParentName} appears behind more than one of these roles.` : ""}`;

  return (
    <div className="hero">
      <div className="hero__narrative">
        <p className="hero__eyebrow">Finding 01 — cross-asset-class look-through</p>
        <h3 id="headline-claim" className="hero__claim">
          Your hedge is your own position.
        </h3>
        {/* The generated `detail` is the full audit trail — every path, document, and
            as-of date. That belongs below, not in the opening line. The lede is composed
            from the same structured data so it stays true for any entity. */}
        <p className="hero__lede">
          <strong>{entityName}</strong> is reached {roles.length} ways:{" "}
          {roles.map((r, i) => (
            <span key={`lede-${r.edgeType}-${i}`}>
              {i > 0 ? (i === roles.length - 1 ? ", and " : ", ") : ""}
              {roleHeading(r.edgeType).split(" — ")[0].toLowerCase()} via {short(r.parent)}
            </span>
          ))}
          .{" "}
          {sharedParentName
            ? `${short(sharedParentName)} stands behind more than one of them — the protection is the same position wearing a different hat. One credit event hits all ${roles.length}.`
            : `One credit event hits all ${roles.length}.`}
        </p>
        <details className="hero__derivation">
          <summary>Show full derivation</summary>
          <p>{finding.detail}</p>
        </details>
        <div className="hero__total">
          <span className="hero__total-label">Total single-counterparty exposure</span>
          <span className="hero__total-amount">{formatMoney(total)}</span>
          <span className="hero__total-caption">
            {roles.length} traversal paths converge on one entity — reported today as if
            independent
          </span>
        </div>
        <div className="hero__sources">
          {finding.sourceDocuments.map((doc, i) => (
            <SourceTag
              key={doc + i}
              document={doc}
              asOfDate={finding.asOfDates[i] ?? finding.asOfDates[0]}
              documentId={documentIdByFilename?.get(doc)}
            />
          ))}
        </div>
      </div>

      <div className="hero__diagram" role="img" aria-label={ariaLabel}>
        <svg
          viewBox={`0 0 ${totalWidth} 470`}
          className="convergence-svg"
          aria-hidden="true"
        >
          {roles.map((role, i) => {
            const cx = MARGIN + i * (NODE_WIDTH + NODE_GAP) + NODE_WIDTH / 2;
            const landingX =
              n > 1
                ? targetX + 20 + (i * (TARGET_WIDTH - 40)) / (n - 1)
                : targetCenterX;
            const style = { "--role-color": role.color } as CSSProperties;
            return (
              <path
                key={`line-${role.edgeType}-${i}`}
                d={`M ${cx} ${NODE_TOP + NODE_HEIGHT} C ${cx} 240, ${targetCenterX} 285, ${landingX} ${TARGET_TOP}`}
                className="convergence-line"
                style={style}
              />
            );
          })}

          {sharedParentIndices ? (
            <>
              <path
                d={`M ${MARGIN + sharedParentIndices[0] * (NODE_WIDTH + NODE_GAP) + NODE_WIDTH / 2} 52 C ${targetCenterX - 100} 6, ${targetCenterX + 100} 6, ${MARGIN + sharedParentIndices[sharedParentIndices.length - 1] * (NODE_WIDTH + NODE_GAP) + NODE_WIDTH / 2} 52`}
                className="convergence-line convergence-line--bridge"
              />
              <text x={targetCenterX} y="26" textAnchor="middle" className="convergence-bridge-label">
                SAME COUNTERPARTY
              </text>
            </>
          ) : null}

          {roles.map((role, i) => {
            const x = MARGIN + i * (NODE_WIDTH + NODE_GAP);
            const style = { "--role-color": role.color } as CSSProperties;
            return (
              <g className="convergence-node" style={style} key={`${role.edgeType}-${i}`}>
                <rect x={x} y={NODE_TOP} width={NODE_WIDTH} height={NODE_HEIGHT} rx="4" />
                <text x={x + 16} y={NODE_TOP + 24} className="convergence-node__role">
                  {roleHeading(role.edgeType)}
                </text>
                <text x={x + 16} y={NODE_TOP + 47} className="convergence-node__label">
                  {short(role.parent)}
                </text>
                <text x={x + 16} y={NODE_TOP + 67} className="convergence-node__amount">
                  {formatMoney(role.amount)}
                </text>
              </g>
            );
          })}

          <g className="convergence-node convergence-node--target">
            <rect x={targetX} y={TARGET_TOP} width={TARGET_WIDTH} height={TARGET_HEIGHT} rx="4" />
            <text x={targetCenterX} y={TARGET_TOP + 31} textAnchor="middle" className="convergence-node__target-label">
              {short(entityName).toUpperCase()}
            </text>
            <text x={targetCenterX} y={TARGET_TOP + 56} textAnchor="middle" className="convergence-node__target-sub">
              one credit event
            </text>
            <text x={targetCenterX} y={TARGET_TOP + 78} textAnchor="middle" className="convergence-node__target-amount">
              {formatMoney(total)} affected
            </text>
          </g>
        </svg>

        <ul className="hero__legend">
          {roles.map((role, i) => {
            const style = { "--role-color": role.color } as CSSProperties;
            return (
              <li key={`${role.edgeType}-${i}`}>
                <span className="hero__legend-swatch" style={style} />
                {roleHeading(role.edgeType).split("—")[0].trim()} path
              </li>
            );
          })}
        </ul>
      </div>

      {roles.length ? (
        <div className="hero__paths">
          {roles.map((role, i) =>
            role.path ? (
              <PathLine
                key={`${role.edgeType}-${i}`}
                label={roleHeading(role.edgeType).split("—")[0].trim()}
                path={role.path}
                documentId={role.path.sourceDocument ? documentIdByFilename?.get(role.path.sourceDocument) : undefined}
              />
            ) : null,
          )}
        </div>
      ) : null}
    </div>
  );
}

function PathLine({ label, path, documentId }: { label: string; path: ExposurePath; documentId?: string }) {
  return (
    <div className="hero__path-row">
      <span className="hero__path-role">{label}</span>
      <span className="hero__path-chain">
        {path.hops.map((hop, i) => (
          <span key={`${hop.from}-${hop.to}-${i}`} className="hero__path-hop">
            {i === 0 ? hop.from : null}
            <span className="hero__path-arrow"> → </span>
            {hop.to}
            {hop.weightPct ? <span className="hero__path-weight"> ({Math.round(hop.weightPct * 100)}%)</span> : null}
          </span>
        ))}
      </span>
      <SourceTag document={path.sourceDocument} asOfDate={path.asOfDate} confidence={path.confidence} documentId={documentId} />
    </div>
  );
}

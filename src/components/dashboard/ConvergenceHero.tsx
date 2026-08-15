import { formatMoney, formatPct } from "@/components/dashboard/format";
import { SourceTag } from "@/components/ui/SourceTag";
import type { EntityExposure, ExposurePath, Finding } from "@/components/dashboard/types";

interface ConvergenceHeroProps {
  finding: Finding | undefined;
  entity: EntityExposure | undefined;
}

/**
 * THE centrepiece. Aurex Data Centers appears in three roles across three asset
 * classes; the guarantee behind the loan traces back to the same fund that holds
 * the equity. The three roles must visually converge on one node — that
 * convergence *is* the finding, legible without narration.
 */
export function ConvergenceHero({ finding, entity }: ConvergenceHeroProps) {
  const equity = entity?.byEdgeType.holds_equity ?? 459_000;
  const debt = entity?.byEdgeType.holds_debt ?? 2_000_000;
  const total = finding?.amount ?? equity + debt;

  const equityPath = entity?.paths.find((p) => p.hops.some((h) => h.edgeType === "holds_equity"));
  const debtPath = entity?.paths.find((p) => p.hops.some((h) => h.edgeType === "holds_debt"));
  const guaranteePath = entity?.paths.find((p) => p.hops.some((h) => h.edgeType === "guarantees"));

  const fundName =
    equityPath?.hops.find((h) => h.edgeType === "holds_equity")?.from ?? "Kestrel Ventures Fund III";
  const entityName = entity?.name ?? "Aurex Data Centers";

  return (
    <div className="hero">
      <div className="hero__narrative">
        <p className="hero__eyebrow">Finding 01 — cross-asset-class look-through</p>
        <h3 id="headline-claim" className="hero__claim">
          Your hedge is your own position.
        </h3>
        <p className="hero__lede">
          <strong>{entityName}</strong> appears three times, in three roles, across three
          asset classes. The guarantee behind its loan is written by the very fund that
          owns its equity. One credit event hits all three.
        </p>
        <div className="hero__total">
          <span className="hero__total-label">Total single-counterparty exposure</span>
          <span className="hero__total-amount">{formatMoney(total)}</span>
          <span className="hero__total-caption">
            reported today as diversification across two asset classes
          </span>
        </div>
        {finding ? (
          <div className="hero__sources">
            {finding.sourceDocuments.map((doc, i) => (
              <SourceTag key={doc + i} document={doc} asOfDate={finding.asOfDates[i] ?? finding.asOfDates[0]} />
            ))}
          </div>
        ) : null}
      </div>

      <div className="hero__diagram" role="img" aria-label={`Diagram: ${entityName} is held as equity inside ${fundName}, borrows $2,000,000 unsecured, and that same loan is guaranteed by ${fundName} — the fund whose equity is held.`}>
        <svg viewBox="0 0 620 460" className="convergence-svg" aria-hidden="true">
          {/* connective lines drawn first, under the nodes */}
          <path d="M 140 96 C 140 220, 300 260, 310 340" className="convergence-line convergence-line--equity" />
          <path d="M 310 96 C 310 220, 310 260, 310 340" className="convergence-line convergence-line--debt" />
          <path d="M 480 96 C 480 220, 320 260, 316 340" className="convergence-line convergence-line--guarantee" />

          {/* the "same fund" bridge — the insight, drawn as a deliberate arc */}
          <path d="M 140 70 C 260 10, 400 10, 480 70" className="convergence-line convergence-line--bridge" />
          <text x="310" y="34" textAnchor="middle" className="convergence-bridge-label">
            SAME FUND
          </text>

          {/* role node: equity */}
          <g className="convergence-node convergence-node--equity">
            <rect x="20" y="20" width="240" height="76" rx="4" />
            <text x="40" y="45" className="convergence-node__role">EQUITY</text>
            <text x="40" y="68" className="convergence-node__label">{fundName}</text>
            <text x="40" y="86" className="convergence-node__amount">{formatMoney(equity)}</text>
          </g>

          {/* role node: debt */}
          <g className="convergence-node convergence-node--debt">
            <rect x="190" y="20" width="240" height="76" rx="4" />
            <text x="210" y="45" className="convergence-node__role">DEBT — UNSECURED</text>
            <text x="210" y="68" className="convergence-node__label">
              {debtPath?.hops[0]?.from ?? "Blackfin direct loan"}
            </text>
            <text x="210" y="86" className="convergence-node__amount">{formatMoney(debt)}</text>
          </g>

          {/* role node: guarantee */}
          <g className="convergence-node convergence-node--guarantee">
            <rect x="360" y="20" width="240" height="76" rx="4" />
            <text x="380" y="45" className="convergence-node__role">GUARANTEE ON THAT LOAN</text>
            <text x="380" y="68" className="convergence-node__label">{fundName}</text>
            <text x="380" y="86" className="convergence-node__amount">— same fund as equity —</text>
          </g>

          {/* convergence node */}
          <g className="convergence-node convergence-node--target">
            <rect x="180" y="340" width="260" height="92" rx="4" />
            <text x="310" y="371" textAnchor="middle" className="convergence-node__target-label">
              {entityName.toUpperCase()}
            </text>
            <text x="310" y="396" textAnchor="middle" className="convergence-node__target-sub">
              one credit event
            </text>
            <text x="310" y="418" textAnchor="middle" className="convergence-node__target-amount">
              {formatMoney(total)} affected
            </text>
          </g>
        </svg>

        <ul className="hero__legend">
          <li><span className="hero__legend-swatch hero__legend-swatch--equity" />Equity path</li>
          <li><span className="hero__legend-swatch hero__legend-swatch--debt" />Debt path</li>
          <li><span className="hero__legend-swatch hero__legend-swatch--guarantee" />Guarantee path</li>
        </ul>
      </div>

      {equityPath || debtPath || guaranteePath ? (
        <div className="hero__paths">
          {equityPath ? <PathLine label="Equity" path={equityPath} /> : null}
          {debtPath ? <PathLine label="Debt" path={debtPath} weight={null} /> : null}
          {guaranteePath ? <PathLine label="Guarantee" path={guaranteePath} weight={null} /> : null}
        </div>
      ) : null}
    </div>
  );
}

function PathLine({
  label,
  path,
}: {
  label: string;
  path: ExposurePath;
  weight?: null;
}) {
  return (
    <div className="hero__path-row">
      <span className="hero__path-role">{label}</span>
      <span className="hero__path-chain">
        {path.hops.map((hop, i) => (
          <span key={`${hop.from}-${hop.to}-${i}`} className="hero__path-hop">
            {i === 0 ? hop.from : null}
            <span className="hero__path-arrow"> → </span>
            {hop.to}
            {hop.weightPct ? <span className="hero__path-weight"> ({formatPct(hop.weightPct)})</span> : null}
          </span>
        ))}
      </span>
      <SourceTag document={path.sourceDocument} asOfDate={path.asOfDate} confidence={path.confidence} />
    </div>
  );
}

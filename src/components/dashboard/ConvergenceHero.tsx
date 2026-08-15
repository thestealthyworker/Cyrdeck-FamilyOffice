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

  const entityName = entity?.name ?? "Aurex Data Centers";

  // The counterparty that matters is the one immediately above the entity, not the
  // root the path started from. Taking the first hop would label every role
  // "Whitmore Family Office" and bury the finding: the point is that the equity
  // holder and the guarantor are the SAME fund.
  const parentOf = (path: ExposurePath | undefined) =>
    path?.hops.find((h) => h.to === entityName)?.from ?? path?.hops.at(-1)?.from;

  const equityHolder = parentOf(equityPath) ?? "Kestrel Ventures Fund III";
  const guarantor = parentOf(guaranteePath) ?? equityHolder;
  const lender = parentOf(debtPath) ?? "Whitmore Family Office";
  const guarantorIsEquityHolder = guarantor === equityHolder;

  // SVG text does not wrap. Legal suffixes overflow the role boxes and add nothing
  // at a glance — the full names are printed in the traversal paths below.
  const short = (name: string) => name.replace(/,?\s+(L\.?P\.?|LLC|Inc\.?|Ltd\.?|Corp\.?)$/i, "");

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

      <div className="hero__diagram" role="img" aria-label={`Diagram: ${entityName} is held as equity inside ${equityHolder}, owes ${formatMoney(debt)} on an unsecured direct loan, and that same loan is guaranteed by ${guarantor}${guarantorIsEquityHolder ? " — the very fund whose equity is held" : ""}.`}>
        <svg viewBox="0 0 660 470" className="convergence-svg" aria-hidden="true">
          {/* connective lines drawn first, under the nodes */}
          <path d="M 110 130 C 110 240, 300 285, 325 350" className="convergence-line convergence-line--equity" />
          <path d="M 330 130 C 330 240, 330 285, 330 350" className="convergence-line convergence-line--debt" />
          <path d="M 550 130 C 550 240, 360 285, 335 350" className="convergence-line convergence-line--guarantee" />

          {/* The "same fund" bridge is the insight itself, so it is drawn only when
              the guarantor really is the equity holder — never as decoration. */}
          {guarantorIsEquityHolder ? (
            <>
              <path d="M 110 52 C 210 6, 450 6, 550 52" className="convergence-line convergence-line--bridge" />
              <text x="330" y="26" textAnchor="middle" className="convergence-bridge-label">
                SAME FUND
              </text>
            </>
          ) : null}

          {/* role node: equity */}
          <g className="convergence-node convergence-node--equity">
            <rect x="10" y="52" width="200" height="78" rx="4" />
            <text x="26" y="76" className="convergence-node__role">EQUITY — HELD INSIDE</text>
            <text x="26" y="99" className="convergence-node__label">{short(equityHolder)}</text>
            <text x="26" y="119" className="convergence-node__amount">{formatMoney(equity)}</text>
          </g>

          {/* role node: debt */}
          <g className="convergence-node convergence-node--debt">
            <rect x="230" y="52" width="200" height="78" rx="4" />
            <text x="246" y="76" className="convergence-node__role">DEBT — UNSECURED</text>
            <text x="246" y="99" className="convergence-node__label">{short(lender)}</text>
            <text x="246" y="119" className="convergence-node__amount">{formatMoney(debt)}</text>
          </g>

          {/* role node: guarantee */}
          <g className="convergence-node convergence-node--guarantee">
            <rect x="450" y="52" width="200" height="78" rx="4" />
            <text x="466" y="76" className="convergence-node__role">GUARANTEE — WRITTEN BY</text>
            <text x="466" y="99" className="convergence-node__label">{short(guarantor)}</text>
            <text x="466" y="119" className="convergence-node__amount">
              {guarantorIsEquityHolder ? "↑ same fund as the equity" : formatMoney(entity?.guaranteeNotional ?? 0)}
            </text>
          </g>

          {/* convergence node */}
          <g className="convergence-node convergence-node--target">
            <rect x="200" y="350" width="260" height="92" rx="4" />
            <text x="330" y="381" textAnchor="middle" className="convergence-node__target-label">
              {short(entityName).toUpperCase()}
            </text>
            <text x="330" y="406" textAnchor="middle" className="convergence-node__target-sub">
              one credit event
            </text>
            <text x="330" y="428" textAnchor="middle" className="convergence-node__target-amount">
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

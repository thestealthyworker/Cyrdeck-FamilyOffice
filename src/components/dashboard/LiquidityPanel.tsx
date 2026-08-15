import { formatMoney, formatMultiple, formatPct } from "@/components/dashboard/format";
import type { LiquidityResponse } from "@/components/dashboard/types";

interface LiquidityPanelProps {
  data: LiquidityResponse;
}

const BAR_MAX = 3.2;

function CoverageBar({ label, value, tone }: { label: string; value: number; tone: "base" | "stress" }) {
  const pct = Math.min(100, (value / BAR_MAX) * 100);
  return (
    <div className="coverage-bar">
      <div className="coverage-bar__label-row">
        <span className="coverage-bar__label">{label}</span>
        <span className="coverage-bar__value">{formatMultiple(value)}</span>
      </div>
      <div className="coverage-bar__track">
        <div className={`coverage-bar__fill coverage-bar__fill--${tone}`} style={{ width: `${pct}%` }} />
        <div className="coverage-bar__benchmark" style={{ left: `${(3 / BAR_MAX) * 100}%` }} />
      </div>
    </div>
  );
}

export function LiquidityPanel({ data }: LiquidityPanelProps) {
  const { base, stress, benchmark, asymmetry, monteCarlo } = data;

  return (
    <div className="liquidity-panel">
      <div className="liquidity-panel__bars">
        <CoverageBar label="Base coverage" value={base.coverage} tone="base" />
        <CoverageBar label="Stressed coverage" value={stress.coverage} tone="stress" />
        <p className="liquidity-panel__benchmark-caption">
          Benchmark: {benchmark.name} ({formatMultiple(benchmark.target)}) —{" "}
          <strong className={benchmark.passes ? undefined : "liquidity-panel__benchmark-fail"}>
            {benchmark.passes ? "passes" : "fails"}
          </strong>{" "}
          at {formatMultiple(benchmark.actual)}
        </p>
      </div>

      <div className="liquidity-panel__grid">
        <div className="liquidity-stat">
          <span className="liquidity-stat__label">Shortfall under stress</span>
          <span className="liquidity-stat__value liquidity-stat__value--critical">{formatMoney(stress.shortfall)}</span>
        </div>
        <div className="liquidity-stat">
          <span className="liquidity-stat__label">Calls due under stress</span>
          <span className="liquidity-stat__value">{formatMoney(stress.callsDue)}</span>
        </div>
        <div className="liquidity-stat">
          <span className="liquidity-stat__label">Liquid book, stressed</span>
          <span className="liquidity-stat__value">{formatMoney(stress.liquidValue)}</span>
        </div>
        <div className="liquidity-stat">
          <span className="liquidity-stat__label">Undrawn commitments</span>
          <span className="liquidity-stat__value">{formatMoney(base.undrawnTotal)}</span>
        </div>
      </div>

      <div className="liquidity-panel__asymmetry">
        <p className="liquidity-panel__asymmetry-figure">
          A {formatMoney(asymmetry.shortfall)} gap puts {formatMoney(asymmetry.navAtRisk)} of NAV at risk —{" "}
          <strong>{formatMultiple(asymmetry.ratio, 0)}</strong>.
        </p>
        <p className="liquidity-panel__asymmetry-rationale">{asymmetry.rationale}</p>
      </div>

      <details className="liquidity-panel__assumptions">
        <summary>Stress assumptions &amp; {monteCarlo.paths.toLocaleString()}-path simulation</summary>
        <dl className="liquidity-panel__assumptions-list">
          <div>
            <dt>Equity shock</dt>
            <dd>{formatPct(stress.assumptions.equityShock)}</dd>
          </div>
          <div>
            <dt>Bond shock</dt>
            <dd>{formatPct(stress.assumptions.bondShock)}</dd>
          </div>
          <div>
            <dt>Call acceleration</dt>
            <dd>{formatPct(stress.assumptions.callAcceleration)}</dd>
          </div>
          <div>
            <dt>Distributions</dt>
            <dd>{formatPct(stress.assumptions.distributions)}</dd>
          </div>
          <div>
            <dt>P5 / P50 / P95 min coverage</dt>
            <dd>
              {formatMultiple(monteCarlo.minCoverageP5)} / {formatMultiple(monteCarlo.minCoverageP50)} /{" "}
              {formatMultiple(monteCarlo.minCoverageP95)}
            </dd>
          </div>
          <div>
            <dt>Probability of shortfall</dt>
            <dd>{formatPct(monteCarlo.probShortfall)}</dd>
          </div>
        </dl>
      </details>
    </div>
  );
}

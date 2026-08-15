/**
 * Structural types mirroring the frozen API contracts in `src/lib/graph.ts` and
 * `src/lib/liquidity.ts`. Those files are owned by other agents and may not exist
 * yet — these local copies let the UI compile and render against the same shape.
 * Swap to `import type { ... } from '@/lib/graph'` / `'@/lib/liquidity'` once those
 * land, without changing anything else in this file's consumers.
 */

export type EdgeKind =
  | "holds_equity"
  | "holds_debt"
  | "guarantees"
  | "owns_property"
  | "manages";

export interface ExposureHop {
  from: string;
  to: string;
  edgeType: EdgeKind;
  value: number | null;
  weightPct: number | null;
}

export interface ExposurePath {
  hops: ExposureHop[];
  sourceDocument: string | null;
  asOfDate: string;
  confidence: number;
}

export interface EntityExposure {
  id: string;
  name: string;
  entityType: string;
  sector: string | null;
  byEdgeType: Partial<Record<EdgeKind, number>>;
  directTotal: number;
  guaranteeNotional: number;
  pathCount: number;
  edgeTypeCount: number;
  asOfEarliest: string;
  asOfLatest: string;
  paths: ExposurePath[];
}

export type FindingId = "cross_asset_class" | "hidden_concentration";
export type Severity = "critical" | "high" | "medium";

export interface Finding {
  id: FindingId;
  severity: Severity;
  headline: string;
  detail: string;
  amount: number;
  entities: string[];
  sourceDocuments: string[];
  asOfDates: string[];
}

export interface ExposureResponse {
  root: string;
  entities: EntityExposure[];
  findings: Finding[];
  peBookValue: number;
  generatedAt: string;
}

export interface LiquidityBase {
  liquidValue: number;
  undrawnTotal: number;
  coverage: number;
}

export interface LiquidityStress {
  liquidValue: number;
  callsDue: number;
  coverage: number;
  shortfall: number;
  assumptions: {
    equityShock: number;
    bondShock: number;
    callAcceleration: number;
    distributions: number;
  };
}

export interface LiquidityBenchmark {
  name: string;
  target: number;
  actual: number;
  passes: boolean;
}

export interface LiquidityAsymmetry {
  shortfall: number;
  navAtRisk: number;
  ratio: number;
  rationale: string;
}

export interface LiquidityMonteCarlo {
  paths: number;
  minCoverageP5: number;
  minCoverageP50: number;
  minCoverageP95: number;
  probShortfall: number;
}

export interface LiquidityResponse {
  base: LiquidityBase;
  stress: LiquidityStress;
  benchmark: LiquidityBenchmark;
  asymmetry: LiquidityAsymmetry;
  monteCarlo: LiquidityMonteCarlo;
  asOfDates: string[];
  generatedAt: string;
}

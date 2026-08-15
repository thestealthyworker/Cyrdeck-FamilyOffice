/**
 * Exposure graph traversal.
 *
 * Walks the entity graph outward from the family-office root and computes total
 * exposure to every reachable node, grouped by `edge_type` and summed over all
 * inbound paths. Findings are DERIVED from the traversal — never hardcoded.
 *
 * The load-bearing architectural bet: equity holdings, direct loans and guarantees
 * are all edges in ONE typed table between the SAME nodes. That is what makes
 * cross-asset-class look-through computable at all.
 */

import { supabase } from './supabase'

// ---------------------------------------------------------------------------
// Public types (imported by the dashboard — frozen contract)
// ---------------------------------------------------------------------------

export type EdgeKind =
  | 'holds_equity'
  | 'holds_debt'
  | 'guarantees'
  | 'owns_property'
  | 'manages'

export type ExposureHop = {
  from: string
  to: string
  edgeType: EdgeKind
  value: number | null
  weightPct: number | null
}

export type ExposurePath = {
  hops: ExposureHop[]
  sourceDocument: string | null
  asOfDate: string
  confidence: number
}

export type EntityExposure = {
  id: string
  name: string
  entityType: string
  sector: string | null
  byEdgeType: Partial<Record<EdgeKind, number>>
  directTotal: number
  guaranteeNotional: number
  pathCount: number
  edgeTypeCount: number
  asOfEarliest: string
  asOfLatest: string
  paths: ExposurePath[]
}

export type FindingId = 'cross_asset_class' | 'hidden_concentration'

export type Finding = {
  id: FindingId
  severity: 'critical' | 'high' | 'medium'
  headline: string
  detail: string
  amount: number
  entities: string[]
  sourceDocuments: string[]
  asOfDates: string[]
}

export type ExposureResponse = {
  root: string
  entities: EntityExposure[]
  findings: Finding[]
  peBookValue: number
  generatedAt: string
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Edge types that add to `directTotal`. Guarantees are notional, not additive. */
const ADDITIVE_EDGE_TYPES: readonly EdgeKind[] = [
  'holds_equity',
  'holds_debt',
  'owns_property',
]

/** Ownership flows through these; a loan or guarantee does not confer look-through. */
const LOOK_THROUGH_EDGE_TYPES: readonly EdgeKind[] = ['holds_equity', 'owns_property']

/** Cycle guard is per-path, but cap depth so a malformed graph cannot hang a request. */
const MAX_PATH_DEPTH = 8

/** An indirect position at or above this share of the PE book is a concentration. */
const CONCENTRATION_THRESHOLD = 0.1

/** Minimum distinct inbound paths before "hidden" concentration is meaningful. */
const MIN_PATHS_FOR_CONCENTRATION = 2

// ---------------------------------------------------------------------------
// Row shapes as returned by Postgres (numerics arrive as strings)
// ---------------------------------------------------------------------------

type EntityRow = {
  id: string
  canonical_name: string
  entity_type: string
  sector: string | null
  geography: string | null
  is_root: boolean
}

type EdgeRow = {
  id: string
  from_entity_id: string
  to_entity_id: string
  edge_type: EdgeKind
  weight_pct: string | number | null
  value: string | number | null
  as_of_date: string
  confidence: string | number | null
  source_document_id: string | null
  source_note: string | null
}

type DocumentRow = { id: string; filename: string }

function toNumber(raw: string | number | null | undefined): number | null {
  if (raw === null || raw === undefined) return null
  const parsed = typeof raw === 'number' ? raw : Number(raw)
  return Number.isFinite(parsed) ? parsed : null
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values))
}

function formatUsd(amount: number): string {
  return `$${Math.round(amount).toLocaleString('en-US')}`
}

function formatPct(fraction: number): string {
  return `${(fraction * 100).toFixed(1)}%`
}

// ---------------------------------------------------------------------------
// Data access
// ---------------------------------------------------------------------------

type GraphData = {
  entities: EntityRow[]
  edges: EdgeRow[]
  documents: Map<string, string>
}

async function loadGraph(): Promise<GraphData> {
  const [entitiesResult, edgesResult, documentsResult] = await Promise.all([
    supabase
      .from('entities')
      .select('id, canonical_name, entity_type, sector, geography, is_root'),
    supabase
      .from('edges')
      .select(
        'id, from_entity_id, to_entity_id, edge_type, weight_pct, value, as_of_date, confidence, source_document_id, source_note',
      ),
    supabase.from('documents').select('id, filename'),
  ])

  if (entitiesResult.error) {
    throw new Error(`Failed to load entities: ${entitiesResult.error.message}`)
  }
  if (edgesResult.error) {
    throw new Error(`Failed to load edges: ${edgesResult.error.message}`)
  }
  if (documentsResult.error) {
    throw new Error(`Failed to load documents: ${documentsResult.error.message}`)
  }

  const documents = new Map<string, string>(
    ((documentsResult.data ?? []) as DocumentRow[]).map((doc) => [doc.id, doc.filename]),
  )

  return {
    entities: (entitiesResult.data ?? []) as EntityRow[],
    edges: (edgesResult.data ?? []) as EdgeRow[],
    documents,
  }
}

// ---------------------------------------------------------------------------
// Traversal
// ---------------------------------------------------------------------------

/** A single discovered path from root to a node, with the value it contributes. */
type DiscoveredPath = {
  targetId: string
  terminalEdgeType: EdgeKind
  /** Guarantor entity id when `terminalEdgeType === 'guarantees'`. */
  terminalFromId: string
  contribution: number | null
  path: ExposurePath
}

/**
 * Depth-first walk from the root.
 *
 * A path's contribution is the terminal edge's absolute `value` when the source
 * document states one; otherwise it is `weight_pct x` the value flowing into the
 * edge's origin, i.e. the `Sigma (Pi weights) x leaf value` rule from the spec.
 */
function traverse(data: GraphData, root: EntityRow): DiscoveredPath[] {
  const edgesByFrom = new Map<string, EdgeRow[]>()
  for (const edge of data.edges) {
    const bucket = edgesByFrom.get(edge.from_entity_id)
    if (bucket) {
      bucket.push(edge)
      continue
    }
    edgesByFrom.set(edge.from_entity_id, [edge])
  }

  const nameById = new Map<string, string>(
    data.entities.map((entity) => [entity.id, entity.canonical_name]),
  )

  const discovered: DiscoveredPath[] = []

  const walk = (
    nodeId: string,
    inboundValue: number | null,
    hops: readonly ExposureHop[],
    confidences: readonly number[],
    onPath: ReadonlySet<string>,
  ): void => {
    if (hops.length >= MAX_PATH_DEPTH) return

    for (const edge of edgesByFrom.get(nodeId) ?? []) {
      if (onPath.has(edge.to_entity_id)) continue

      const weightPct = toNumber(edge.weight_pct)
      const explicitValue = toNumber(edge.value)
      const derivedValue =
        weightPct !== null && inboundValue !== null ? weightPct * inboundValue : null
      const contribution = explicitValue ?? derivedValue

      const hop: ExposureHop = {
        from: nameById.get(edge.from_entity_id) ?? edge.from_entity_id,
        to: nameById.get(edge.to_entity_id) ?? edge.to_entity_id,
        edgeType: edge.edge_type,
        value: contribution,
        weightPct,
      }
      const nextHops = [...hops, hop]
      const nextConfidences = [...confidences, toNumber(edge.confidence) ?? 1]

      discovered.push({
        targetId: edge.to_entity_id,
        terminalEdgeType: edge.edge_type,
        terminalFromId: edge.from_entity_id,
        contribution,
        path: {
          hops: nextHops,
          sourceDocument: edge.source_document_id
            ? (data.documents.get(edge.source_document_id) ?? null)
            : null,
          asOfDate: edge.as_of_date,
          confidence: Math.min(...nextConfidences),
        },
      })

      // Ownership look-through only: you do not see through a borrower or a guarantor.
      if (!LOOK_THROUGH_EDGE_TYPES.includes(edge.edge_type)) continue

      walk(
        edge.to_entity_id,
        contribution,
        nextHops,
        nextConfidences,
        new Set([...onPath, edge.to_entity_id]),
      )
    }
  }

  walk(root.id, null, [], [], new Set([root.id]))
  return discovered
}

function aggregate(
  data: GraphData,
  discovered: readonly DiscoveredPath[],
): EntityExposure[] {
  const entityById = new Map<string, EntityRow>(
    data.entities.map((entity) => [entity.id, entity]),
  )

  const grouped = new Map<string, DiscoveredPath[]>()
  for (const found of discovered) {
    const bucket = grouped.get(found.targetId)
    if (bucket) {
      bucket.push(found)
      continue
    }
    grouped.set(found.targetId, [found])
  }

  const exposures: EntityExposure[] = []

  for (const [entityId, paths] of grouped) {
    const entity = entityById.get(entityId)
    if (!entity) continue

    const byEdgeType: Partial<Record<EdgeKind, number>> = {}
    let directTotal = 0
    let guaranteeNotional = 0

    for (const found of paths) {
      const amount = found.contribution ?? 0
      byEdgeType[found.terminalEdgeType] =
        (byEdgeType[found.terminalEdgeType] ?? 0) + amount

      if (found.terminalEdgeType === 'guarantees') {
        guaranteeNotional += amount
        continue
      }
      if (ADDITIVE_EDGE_TYPES.includes(found.terminalEdgeType)) {
        directTotal += amount
      }
    }

    const asOfDates = paths.map((found) => found.path.asOfDate).sort()

    exposures.push({
      id: entity.id,
      name: entity.canonical_name,
      entityType: entity.entity_type,
      sector: entity.sector,
      byEdgeType,
      directTotal,
      guaranteeNotional,
      pathCount: paths.length,
      edgeTypeCount: Object.keys(byEdgeType).length,
      asOfEarliest: asOfDates[0],
      asOfLatest: asOfDates[asOfDates.length - 1],
      paths: paths.map((found) => found.path),
    })
  }

  return exposures.sort((a, b) => b.directTotal - a.directTotal)
}

/**
 * PE book denominator: the family office's own equity stakes in funds, at the
 * fund level (not looked through — that would double-count).
 */
function computePeBookValue(data: GraphData, root: EntityRow): number {
  const fundIds = new Set(
    data.entities.filter((entity) => entity.entity_type === 'fund').map((e) => e.id),
  )

  return data.edges
    .filter(
      (edge) =>
        edge.from_entity_id === root.id &&
        edge.edge_type === 'holds_equity' &&
        fundIds.has(edge.to_entity_id),
    )
    .reduce((total, edge) => total + (toNumber(edge.value) ?? 0), 0)
}

// ---------------------------------------------------------------------------
// Findings — all derived from the traversal above
// ---------------------------------------------------------------------------

function pathEvidence(paths: readonly ExposurePath[]): {
  documents: string[]
  dates: string[]
} {
  return {
    documents: unique(
      paths.map((p) => p.sourceDocument).filter((doc): doc is string => doc !== null),
    ),
    dates: unique(paths.map((p) => p.asOfDate)).sort(),
  }
}

function describeLegs(exposure: EntityExposure): string {
  return exposure.paths
    .map((path) => {
      const terminal = path.hops[path.hops.length - 1]
      const connector = terminal.edgeType === 'guarantees' ? 'guaranteed by' : 'via'
      const via = path.hops.length > 1 ? ` ${connector} ${terminal.from}` : ' held directly'
      const amount = terminal.value === null ? 'unvalued' : formatUsd(terminal.value)
      return `${terminal.edgeType} ${amount}${via} (${path.sourceDocument ?? 'unsourced'}, as-of ${path.asOfDate})`
    })
    .join('; ')
}

/**
 * THE HEADLINE. An entity reachable via two or more DIFFERENT edge types is a
 * single counterparty that a siloed, asset-class-partitioned report presents as
 * diversification. Escalated to critical when a `guarantees` edge into that entity
 * originates from an entity that is ITSELF reachable from the root — the credit
 * protection is then the family office's own position wearing a different hat.
 */
function findCrossAssetClass(
  exposures: readonly EntityExposure[],
  reachableIds: ReadonlySet<string>,
  discovered: readonly DiscoveredPath[],
  nameById: ReadonlyMap<string, string>,
): Finding[] {
  const findings: Finding[] = []

  for (const exposure of exposures) {
    if (exposure.edgeTypeCount < 2) continue

    const correlatedGuarantors = unique(
      discovered
        .filter(
          (found) =>
            found.targetId === exposure.id &&
            found.terminalEdgeType === 'guarantees' &&
            reachableIds.has(found.terminalFromId),
        )
        .map((found) => nameById.get(found.terminalFromId) ?? found.terminalFromId),
    )

    const evidence = pathEvidence(exposure.paths)
    const kinds = Object.keys(exposure.byEdgeType).join(' + ')

    const correlationClause =
      correlatedGuarantors.length > 0
        ? ` The ${formatUsd(exposure.guaranteeNotional)} guarantee backing this exposure is provided by ${correlatedGuarantors.join(', ')} — an entity the family office is itself exposed to, so the credit protection is correlated to the very position it is meant to protect: one credit event impairs the equity, leaves the loan unsecured, and weakens the guarantee simultaneously.`
        : ''

    findings.push({
      id: 'cross_asset_class',
      severity: correlatedGuarantors.length > 0 ? 'critical' : 'high',
      headline:
        correlatedGuarantors.length > 0
          ? `Your hedge is your own position: ${formatUsd(exposure.directTotal)} to ${exposure.name} across ${exposure.edgeTypeCount} asset classes`
          : `${formatUsd(exposure.directTotal)} single-counterparty exposure to ${exposure.name} spans ${exposure.edgeTypeCount} asset classes`,
      detail:
        `${exposure.name} is reached over ${exposure.pathCount} path(s) as ${kinds}: ${describeLegs(exposure)}. ` +
        `Direct exposure totals ${formatUsd(exposure.directTotal)} (guarantee notional of ${formatUsd(exposure.guaranteeNotional)} excluded — it is credit support, not additive exposure).` +
        correlationClause +
        ` Evidence spans ${evidence.documents.length} document(s) — ${evidence.documents.join(', ')} — with as-of dates ${evidence.dates.join(', ')}; these are different reporting dates, so this total is a superposition, not a point-in-time figure.`,
      amount: exposure.directTotal,
      entities: unique([exposure.name, ...correlatedGuarantors]),
      sourceDocuments: evidence.documents,
      asOfDates: evidence.dates,
    })
  }

  return findings
}

/**
 * An operating company reached through two or more DIFFERENT funds — invisible in
 * any single statement — whose combined equity is a large share of the PE book.
 */
function findHiddenConcentration(
  exposures: readonly EntityExposure[],
  peBookValue: number,
): Finding[] {
  if (peBookValue <= 0) return []

  const findings: Finding[] = []

  for (const exposure of exposures) {
    const indirectEquityPaths = exposure.paths.filter(
      (path) =>
        path.hops.length > 1 &&
        path.hops[path.hops.length - 1].edgeType === 'holds_equity',
    )
    if (indirectEquityPaths.length < MIN_PATHS_FOR_CONCENTRATION) continue

    const intermediaries = unique(
      indirectEquityPaths.map((path) => path.hops[path.hops.length - 1].from),
    )
    if (intermediaries.length < MIN_PATHS_FOR_CONCENTRATION) continue

    const combined = indirectEquityPaths.reduce(
      (total, path) => total + (path.hops[path.hops.length - 1].value ?? 0),
      0,
    )
    const share = combined / peBookValue
    if (share < CONCENTRATION_THRESHOLD) continue

    const evidence = pathEvidence(indirectEquityPaths)
    const legs = indirectEquityPaths
      .map((path) => {
        const terminal = path.hops[path.hops.length - 1]
        const weight = terminal.weightPct === null ? '' : ` (${formatPct(terminal.weightPct)} of fund)`
        return `${formatUsd(terminal.value ?? 0)} via ${terminal.from}${weight} — ${path.sourceDocument ?? 'unsourced'}, as-of ${path.asOfDate}`
      })
      .join('; ')

    findings.push({
      id: 'hidden_concentration',
      severity: share >= 0.15 ? 'high' : 'medium',
      headline: `${exposure.name} is ${formatPct(share)} of the private equity book across ${intermediaries.length} supposedly diversified funds`,
      detail:
        `${exposure.name} appears inside ${intermediaries.join(' and ')}, so no single statement shows the position: ${legs}. ` +
        `Combined look-through value ${formatUsd(combined)} against a PE book of ${formatUsd(peBookValue)} = ${formatPct(share)}. ` +
        `The two legs are reported as-of ${evidence.dates.join(' and ')} in ${evidence.documents.join(' and ')} — different reporting dates, so the sum never existed at any single moment and is a lower bound on the risk, not a precise figure.`,
      amount: combined,
      entities: unique([exposure.name, ...intermediaries]),
      sourceDocuments: evidence.documents,
      asOfDates: evidence.dates,
    })
  }

  return findings
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export async function computeExposure(): Promise<ExposureResponse> {
  const data = await loadGraph()

  const root = data.entities.find((entity) => entity.is_root)
  if (!root) {
    throw new Error('No root entity found: exactly one row in `entities` must have is_root = true')
  }

  const discovered = traverse(data, root)
  const entities = aggregate(data, discovered)
  const peBookValue = computePeBookValue(data, root)

  const reachableIds = new Set(entities.map((entity) => entity.id))
  const nameById = new Map<string, string>(
    data.entities.map((entity) => [entity.id, entity.canonical_name]),
  )

  const findings = [
    ...findCrossAssetClass(entities, reachableIds, discovered, nameById),
    ...findHiddenConcentration(entities, peBookValue),
  ]

  return {
    root: root.canonical_name,
    entities,
    findings,
    peBookValue,
    generatedAt: new Date().toISOString(),
  }
}

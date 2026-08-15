import { supabase } from '@/lib/supabase'

/**
 * Liquidity stress simulation — Finding 3, "the liquidity collision".
 *
 * Undrawn PE/VC commitments vs. the liquid book, stressed against the
 * Cambridge Associates 3x post-stress liquid-to-annual-cash-needs standard.
 * See sample_data/DATA_DICTIONARY.md ("Finding 3") and PLAN.md ("Simulation").
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LiquidityBase {
  liquidValue: number
  undrawnTotal: number
  coverage: number
}

export interface StressAssumptions {
  equityShock: number
  bondShock: number
  callAcceleration: number
  distributions: number
}

export interface LiquidityStress {
  liquidValue: number
  callsDue: number
  coverage: number
  shortfall: number
  assumptions: StressAssumptions
}

export interface LiquidityBenchmark {
  name: string
  target: number
  actual: number
  passes: boolean
}

export interface LiquidityAsymmetry {
  shortfall: number
  navAtRisk: number
  ratio: number
  rationale: string
}

export interface MonteCarloSummary {
  paths: number
  minCoverageP5: number
  minCoverageP50: number
  minCoverageP95: number
  probShortfall: number
}

export interface LiquidityResponse {
  base: LiquidityBase
  stress: LiquidityStress
  benchmark: LiquidityBenchmark
  asymmetry: LiquidityAsymmetry
  monteCarlo: MonteCarloSummary
  asOfDates: string[]
  generatedAt: string
}

interface CommitmentRow {
  entity_id: string
  total: string
  drawn: string
  undrawn: string
  distributions: string
  call_notice_days: number | null
  as_of_date: string
  confidence: string
}

interface LiquidAccountRow {
  value: string
  as_of_date: string
  source_note: string | null
}

interface LiquidAsset {
  label: string
  amount: number
  assetClass: 'cash' | 'equity' | 'bond'
}

// ---------------------------------------------------------------------------
// Named constants — the stress scenario and institutional benchmark.
// Shock rates are the scenario definition, not data pulled from Postgres;
// the $4.2M total they're applied to IS read from the `edges` table below.
// ---------------------------------------------------------------------------

const EQUITY_SHOCK = -0.3 // public equity, −30%
const BOND_SHOCK = -0.05 // investment-grade bonds, −5%
const CALL_ACCELERATION = 0.65 // 65% of undrawn commitments called within 12mo
const STRESSED_DISTRIBUTIONS = 0 // distributions dry up under stress

const CAMBRIDGE_ASSOCIATES_STANDARD = 3 // post-stress liquid-to-annual-cash-needs, 3x

// Reported NAV per fund capital statement (doc 1: Meridian $9.42M; doc 2: Kestrel
// est. fair value of LP interest $3.06M). No `nav` column exists on `commitments`
// today, so this is encoded here — same treatment as the liquid-book shock rates —
// rather than invented. See sample_data/DATA_DICTIONARY.md doc 1 & doc 2.
const FUND_NAV_BY_ENTITY_HINT: Array<{ hint: string; nav: number }> = [
  { hint: 'meridian', nav: 9_420_000 },
  { hint: 'kestrel', nav: 3_060_000 },
]

const MERIDIAN_LPA_FORFEITURE_CLAUSE = 'Meridian LPA §6.4'

const MONTE_CARLO_PATHS = 1000
const QUARTERS_PER_YEAR = 4
// Base-case pacing curve: gradual quarterly call-out of the annual call amount.
const BASE_PACING_WEIGHTS = [0.15, 0.25, 0.3, 0.3]
// Stress pacing curve: front-loaded, calls accelerate into the dislocation.
const STRESS_PACING_WEIGHTS = [0.4, 0.3, 0.2, 0.1]

// ---------------------------------------------------------------------------
// Data access
// ---------------------------------------------------------------------------

async function fetchCommitments(): Promise<CommitmentRow[]> {
  const { data, error } = await supabase
    .from('commitments')
    .select('entity_id, total, drawn, undrawn, distributions, call_notice_days, as_of_date, confidence')

  if (error) {
    throw new Error(`Failed to load commitments: ${error.message}`)
  }
  return (data ?? []) as CommitmentRow[]
}

async function fetchLiquidAccount(): Promise<LiquidAccountRow> {
  const { data: account, error: accountError } = await supabase
    .from('entities')
    .select('id')
    .ilike('canonical_name', '%Ashworth%')
    .limit(1)
    .maybeSingle()

  if (accountError) {
    throw new Error(`Failed to resolve Ashworth custody account entity: ${accountError.message}`)
  }
  if (!account) {
    throw new Error('No entity found matching the Ashworth custody account')
  }

  const { data: edge, error: edgeError } = await supabase
    .from('edges')
    .select('value, as_of_date, source_note')
    .eq('edge_type', 'holds_equity')
    .eq('to_entity_id', account.id)
    .limit(1)
    .maybeSingle()

  if (edgeError) {
    throw new Error(`Failed to load liquid account edge: ${edgeError.message}`)
  }
  if (!edge) {
    throw new Error('No holds_equity edge found for the Ashworth custody account')
  }
  return edge as LiquidAccountRow
}

async function fetchFundNames(entityIds: string[]): Promise<Map<string, string>> {
  if (entityIds.length === 0) return new Map()
  const { data, error } = await supabase.from('entities').select('id, canonical_name').in('id', entityIds)
  if (error) {
    throw new Error(`Failed to load fund entities: ${error.message}`)
  }
  const map = new Map<string, string>()
  for (const row of (data ?? []) as Array<{ id: string; canonical_name: string }>) {
    map.set(row.id, row.canonical_name)
  }
  return map
}

// ---------------------------------------------------------------------------
// Liquid book composition parsing
// ---------------------------------------------------------------------------

/**
 * Parses the Ashworth custody `source_note` (e.g. "Cash $850k T+0, US LC equity
 * $1.95M, Intl dev equity $720k, IG bonds $680k") into typed line items so
 * differentiated stress shocks can be applied per asset class.
 */
export function parseLiquidComposition(sourceNote: string | null, fallbackTotal: number): LiquidAsset[] {
  if (!sourceNote) {
    // No composition detail available — treat the whole book as unshocked cash
    // rather than guessing at a split.
    return [{ label: 'Total liquid book', amount: fallbackTotal, assetClass: 'cash' }]
  }

  const segments = sourceNote.split(',').map((segment) => segment.trim())
  const assets: LiquidAsset[] = []

  for (const segment of segments) {
    const match = segment.match(/([A-Za-z /]+)\s*\$?([\d.]+)\s*([kKmM])?/)
    if (!match) continue

    const [, rawLabel, rawAmount, rawUnit] = match
    const label = rawLabel.trim()
    let amount = Number.parseFloat(rawAmount)
    if (Number.isNaN(amount)) continue

    const unit = rawUnit?.toLowerCase()
    if (unit === 'k') amount *= 1_000
    if (unit === 'm') amount *= 1_000_000

    const lowerLabel = label.toLowerCase()
    let assetClass: LiquidAsset['assetClass'] = 'cash'
    if (lowerLabel.includes('bond')) {
      assetClass = 'bond'
    } else if (lowerLabel.includes('equity')) {
      assetClass = 'equity'
    } else if (lowerLabel.includes('cash')) {
      assetClass = 'cash'
    }

    assets.push({ label, amount, assetClass })
  }

  if (assets.length === 0) {
    return [{ label: 'Total liquid book', amount: fallbackTotal, assetClass: 'cash' }]
  }
  return assets
}

function shockRateFor(assetClass: LiquidAsset['assetClass']): number {
  switch (assetClass) {
    case 'equity':
      return EQUITY_SHOCK
    case 'bond':
      return BOND_SHOCK
    case 'cash':
    default:
      return 0
  }
}

function stressedLiquidValue(assets: LiquidAsset[]): number {
  return assets.reduce((sum, asset) => sum + asset.amount * (1 + shockRateFor(asset.assetClass)), 0)
}

// ---------------------------------------------------------------------------
// Deterministic base / stress case
// ---------------------------------------------------------------------------

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

function computeBase(liquidValue: number, undrawnTotal: number): LiquidityBase {
  return {
    liquidValue,
    undrawnTotal,
    coverage: round2(liquidValue / undrawnTotal),
  }
}

function computeStress(assets: LiquidAsset[], undrawnTotal: number): LiquidityStress {
  const liquidValue = stressedLiquidValue(assets)
  const callsDue = undrawnTotal * CALL_ACCELERATION
  const shortfall = Math.max(0, callsDue - liquidValue)

  return {
    liquidValue: Math.round(liquidValue * 100) / 100,
    callsDue: Math.round(callsDue * 100) / 100,
    coverage: round2(liquidValue / callsDue),
    shortfall: Math.round(shortfall * 100) / 100,
    assumptions: {
      equityShock: EQUITY_SHOCK,
      bondShock: BOND_SHOCK,
      callAcceleration: CALL_ACCELERATION,
      distributions: STRESSED_DISTRIBUTIONS,
    },
  }
}

function resolveNav(fundName: string): number {
  const lowerName = fundName.toLowerCase()
  const match = FUND_NAV_BY_ENTITY_HINT.find((entry) => lowerName.includes(entry.hint))
  return match?.nav ?? 0
}

function computeAsymmetry(shortfall: number, commitments: CommitmentRow[], fundNames: Map<string, string>): LiquidityAsymmetry {
  const navAtRisk = commitments.reduce((sum, commitment) => {
    const name = fundNames.get(commitment.entity_id) ?? ''
    return sum + resolveNav(name)
  }, 0)

  const ratio = shortfall > 0 ? round2(navAtRisk / shortfall) : 0

  return {
    shortfall,
    navAtRisk,
    ratio,
    rationale: `Defaulting on a capital call risks forfeiture of up to 100% of the LP interest (${MERIDIAN_LPA_FORFEITURE_CLAUSE}). A $${shortfall.toLocaleString(
      'en-US',
    )} liquidity gap therefore puts $${navAtRisk.toLocaleString('en-US')} of NAV at risk — roughly ${Math.round(ratio)}x the size of the shortfall that triggers it.`,
  }
}

// ---------------------------------------------------------------------------
// Monte Carlo — pacing + distribution draws, quarterly walk, min coverage
// ---------------------------------------------------------------------------

/** Deterministic, dependency-free PRNG (mulberry32) so runs are reproducible. */
function mulberry32(seed: number): () => number {
  let state = seed
  return () => {
    state |= 0
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Uniform draw in [min, max). */
function uniform(rng: () => number, min: number, max: number): number {
  return min + rng() * (max - min)
}

interface PathInputs {
  commitments: CommitmentRow[]
  liquidAssets: LiquidAsset[]
}

function runMonteCarlo({ commitments, liquidAssets }: PathInputs): MonteCarloSummary {
  const rng = mulberry32(0x5eed_5eed)
  const minCoverages: number[] = []

  for (let path = 0; path < MONTE_CARLO_PATHS; path += 1) {
    // Per-path liquid book: shock rates jitter around the stress scenario.
    const equityShockDraw = uniform(rng, EQUITY_SHOCK - 0.05, EQUITY_SHOCK + 0.05)
    const bondShockDraw = uniform(rng, BOND_SHOCK - 0.02, BOND_SHOCK + 0.02)
    let liquid = liquidAssets.reduce((sum, asset) => {
      const rate = asset.assetClass === 'equity' ? equityShockDraw : asset.assetClass === 'bond' ? bondShockDraw : 0
      return sum + asset.amount * (1 + rate)
    }, 0)

    // Per-path call acceleration and distribution draws, per commitment.
    const perCommitmentQuarterlyCalls: number[][] = commitments.map((commitment) => {
      const undrawn = Number.parseFloat(commitment.undrawn)
      const acceleration = uniform(rng, CALL_ACCELERATION - 0.1, Math.min(1, CALL_ACCELERATION + 0.1))
      const annualCalled = undrawn * acceleration
      // Blend base and stress pacing curves per path — the stress case is
      // front-loaded, but not every path accelerates identically.
      const frontLoadBias = uniform(rng, 0, 1)
      return BASE_PACING_WEIGHTS.map((baseWeight, quarter) => {
        const stressWeight = STRESS_PACING_WEIGHTS[quarter]
        const weight = baseWeight * (1 - frontLoadBias) + stressWeight * frontLoadBias
        return annualCalled * weight
      })
    })

    const quarterlyDistributions = commitments.map(() => {
      // Under stress, distributions collapse toward zero with only a small
      // chance of a modest trickle.
      const annualDistribution = uniform(rng, 0, 0.05) * uniform(rng, 0, 1) < 0.9 ? 0 : uniform(rng, 0, 150_000)
      return Array.from({ length: QUARTERS_PER_YEAR }, () => annualDistribution / QUARTERS_PER_YEAR)
    })

    let pathMinCoverage = Number.POSITIVE_INFINITY

    for (let quarter = 0; quarter < QUARTERS_PER_YEAR; quarter += 1) {
      let callsThisQuarter = 0
      let distributionsThisQuarter = 0

      for (let i = 0; i < commitments.length; i += 1) {
        callsThisQuarter += perCommitmentQuarterlyCalls[i][quarter]
        distributionsThisQuarter += quarterlyDistributions[i][quarter]
      }

      liquid += distributionsThisQuarter
      const coverage = callsThisQuarter > 0 ? liquid / callsThisQuarter : Number.POSITIVE_INFINITY
      pathMinCoverage = Math.min(pathMinCoverage, coverage)
      liquid -= callsThisQuarter
    }

    minCoverages.push(Number.isFinite(pathMinCoverage) ? pathMinCoverage : 0)
  }

  minCoverages.sort((a, b) => a - b)
  const percentile = (p: number): number => {
    const index = Math.min(minCoverages.length - 1, Math.max(0, Math.floor(p * (minCoverages.length - 1))))
    return round2(minCoverages[index])
  }

  const shortfallCount = minCoverages.filter((coverage) => coverage < 1).length

  return {
    paths: MONTE_CARLO_PATHS,
    minCoverageP5: percentile(0.05),
    minCoverageP50: percentile(0.5),
    minCoverageP95: percentile(0.95),
    probShortfall: round2(shortfallCount / minCoverages.length),
  }
}

// ---------------------------------------------------------------------------
// Orchestration
// ---------------------------------------------------------------------------

export async function runLiquidityStressSimulation(): Promise<LiquidityResponse> {
  const [commitments, liquidAccount] = await Promise.all([fetchCommitments(), fetchLiquidAccount()])

  if (commitments.length === 0) {
    throw new Error('No commitments found — cannot compute undrawn total')
  }

  const undrawnTotal = commitments.reduce((sum, commitment) => sum + Number.parseFloat(commitment.undrawn), 0)
  const liquidValue = Number.parseFloat(liquidAccount.value)
  const liquidAssets = parseLiquidComposition(liquidAccount.source_note, liquidValue)

  const fundNames = await fetchFundNames(commitments.map((commitment) => commitment.entity_id))

  const base = computeBase(liquidValue, undrawnTotal)
  const stress = computeStress(liquidAssets, undrawnTotal)
  const benchmark: LiquidityBenchmark = {
    name: 'Cambridge Associates 3x post-stress liquid-to-annual-cash-needs standard',
    target: CAMBRIDGE_ASSOCIATES_STANDARD,
    actual: stress.coverage,
    passes: stress.coverage >= CAMBRIDGE_ASSOCIATES_STANDARD,
  }
  const asymmetry = computeAsymmetry(stress.shortfall, commitments, fundNames)
  const monteCarlo = runMonteCarlo({ commitments, liquidAssets })

  const asOfDates = Array.from(
    new Set([...commitments.map((commitment) => commitment.as_of_date), liquidAccount.as_of_date]),
  ).sort()

  return {
    base,
    stress,
    benchmark,
    asymmetry,
    monteCarlo,
    asOfDates,
    generatedAt: new Date().toISOString(),
  }
}

import { NextResponse } from 'next/server'
import { runLiquidityStressSimulation } from '@/lib/liquidity'

export const dynamic = 'force-dynamic'

// Finding 3 — the liquidity collision: undrawn commitments vs. the liquid
// book, stressed and benchmarked against the Cambridge Associates 3x
// post-stress liquid-to-annual-cash-needs standard. See
// sample_data/DATA_DICTIONARY.md and PLAN.md ("Simulation").
export async function GET() {
  try {
    const result = await runLiquidityStressSimulation()
    return NextResponse.json(result)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error running liquidity simulation'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}

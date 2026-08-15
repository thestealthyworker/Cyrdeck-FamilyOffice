import { NextResponse } from 'next/server'

import { computeExposure } from '@/lib/graph'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  try {
    const exposure = await computeExposure()
    return NextResponse.json(exposure, {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unexpected error'
    console.error('[api/exposure] traversal failed:', error)
    return NextResponse.json(
      { error: 'Failed to compute exposure graph', detail: message },
      { status: 500 },
    )
  }
}

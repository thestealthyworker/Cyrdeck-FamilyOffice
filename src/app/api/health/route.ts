import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// Proves the deployed app reaches Postgres and the seeded graph is present.
export async function GET() {
  const [entities, edges] = await Promise.all([
    supabase.from('entities').select('*', { count: 'exact', head: true }),
    supabase.from('edges').select('*', { count: 'exact', head: true }),
  ])

  const error = entities.error ?? edges.error
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    entities: entities.count,
    edges: edges.count,
  })
}

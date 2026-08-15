import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Server-only Supabase client, built with the service-role key.
 *
 * RLS on this database allows public reads but has NO write policies (see
 * supabase/migrations/0004_rls_public_read_only.sql) — the service role key bypasses RLS
 * entirely, which is the only way the extraction pipeline can write. This module must
 * never be imported from client components, and `SUPABASE_SERVICE_ROLE_KEY` must never be
 * prefixed with `NEXT_PUBLIC_` or otherwise shipped to the browser.
 */

let cachedClient: SupabaseClient | null = null

export function getSupabaseAdmin(): SupabaseClient {
  if (cachedClient) return cachedClient

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL is not configured')
  }
  if (!serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured')
  }

  cachedClient = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  return cachedClient
}

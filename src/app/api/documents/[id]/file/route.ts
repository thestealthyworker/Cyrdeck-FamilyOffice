import { NextResponse } from 'next/server'

import { getSupabaseAdmin } from '@/lib/supabase-admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const STORAGE_BUCKET = 'documents'
const SIGNED_URL_EXPIRY_SECONDS = 300

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * Mints a short-lived signed URL for a document's storage object and redirects to it.
 * The bucket stays private — this is the only sanctioned way to reach the underlying
 * file, and the signed URL expires in 5 minutes.
 */
export async function GET(_request: Request, { params }: RouteParams): Promise<NextResponse> {
  const { id } = await params
  const supabaseAdmin = getSupabaseAdmin()

  const { data: documentRow, error: documentError } = await supabaseAdmin
    .from('documents')
    .select('storage_path, filename')
    .eq('id', id)
    .maybeSingle()

  if (documentError) {
    return NextResponse.json(
      { error: 'Failed to look up document', detail: documentError.message },
      { status: 500 },
    )
  }

  if (!documentRow) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 })
  }

  const { data: signedUrlData, error: signedUrlError } = await supabaseAdmin.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(documentRow.storage_path as string, SIGNED_URL_EXPIRY_SECONDS)

  if (signedUrlError || !signedUrlData?.signedUrl) {
    return NextResponse.json(
      { error: 'Source document is unavailable', detail: signedUrlError?.message },
      { status: 404 },
    )
  }

  return NextResponse.redirect(signedUrlData.signedUrl, { status: 302 })
}

import { NextResponse } from 'next/server'

import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { extractDocument } from '@/lib/extract'
import { resolveEntities, type NameHint } from '@/lib/resolve'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const STORAGE_BUCKET = 'documents'
const FAMILY_OFFICE_NAME = 'Whitmore Family Office'

function guessMimeType(file: File): string {
  if (file.type) return file.type
  const lower = file.name.toLowerCase()
  if (lower.endsWith('.pdf')) return 'application/pdf'
  if (lower.endsWith('.xlsx')) {
    return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  }
  return 'application/octet-stream'
}

function sanitizeFilename(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9._-]/g, '_')
}

async function markFailed(documentId: string, message: string): Promise<void> {
  const supabaseAdmin = getSupabaseAdmin()
  await supabaseAdmin
    .from('documents')
    .update({ extraction_status: 'failed', extraction_error: message.slice(0, 2000) })
    .eq('id', documentId)
}

export async function POST(request: Request): Promise<NextResponse> {
  const supabaseAdmin = getSupabaseAdmin()

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Expected multipart/form-data with a "file" field' }, { status: 400 })
  }

  const file = formData.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Missing "file" in form data' }, { status: 400 })
  }

  const mimeType = guessMimeType(file)
  const lowerName = file.name.toLowerCase()
  if (!lowerName.endsWith('.pdf') && !lowerName.endsWith('.xlsx')) {
    return NextResponse.json({ error: 'Only .pdf and .xlsx files are supported' }, { status: 400 })
  }

  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  const storagePath = `uploads/${Date.now()}-${sanitizeFilename(file.name)}`
  const uploadResult = await supabaseAdmin.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, buffer, { contentType: mimeType, upsert: false })

  if (uploadResult.error) {
    return NextResponse.json(
      { error: 'Failed to store document', detail: uploadResult.error.message },
      { status: 500 },
    )
  }

  const { data: documentRow, error: insertError } = await supabaseAdmin
    .from('documents')
    .insert({
      storage_path: storagePath,
      filename: file.name,
      doc_type: 'other',
      extraction_status: 'processing',
    })
    .select('id')
    .single()

  if (insertError || !documentRow) {
    return NextResponse.json(
      { error: 'Failed to create document record', detail: insertError?.message },
      { status: 500 },
    )
  }

  const documentId = documentRow.id as string

  try {
    const extraction = await extractDocument({ filename: file.name, mimeType, buffer })

    const hints: NameHint[] = extraction.entities.map((e) => ({
      name: e.name,
      entity_type: e.entity_type,
      sector: e.sector,
      geography: e.geography,
    }))

    const namesToResolve = new Set<string>()
    for (const e of extraction.entities) namesToResolve.add(e.name)
    for (const edge of extraction.edges) {
      namesToResolve.add(edge.from_entity_name)
      namesToResolve.add(edge.to_entity_name)
    }
    for (const c of extraction.commitments) namesToResolve.add(c.entity_name)

    const nameToEntityId = await resolveEntities(
      Array.from(namesToResolve),
      hints,
      documentId,
    )

    // Defensive: the family office root must always resolve to the single existing root
    // row, never to a duplicate the resolver might otherwise create.
    if (namesToResolve.has(FAMILY_OFFICE_NAME)) {
      const { data: root } = await supabaseAdmin
        .from('entities')
        .select('id')
        .eq('is_root', true)
        .maybeSingle()
      if (root) nameToEntityId.set(FAMILY_OFFICE_NAME, root.id as string)
    }

    const skippedEdges: string[] = []
    const edgeRows = extraction.edges
      .map((edge) => {
        const fromId = nameToEntityId.get(edge.from_entity_name)
        const toId = nameToEntityId.get(edge.to_entity_name)
        if (!fromId || !toId || fromId === toId) {
          skippedEdges.push(`${edge.from_entity_name} -> ${edge.to_entity_name}`)
          return null
        }
        return {
          from_entity_id: fromId,
          to_entity_id: toId,
          edge_type: edge.edge_type,
          weight_pct: edge.weight_pct,
          value: edge.value,
          currency: edge.currency,
          as_of_date: edge.as_of_date,
          confidence: edge.confidence,
          source_document_id: documentId,
          source_note: edge.source_note,
        }
      })
      .filter((row): row is NonNullable<typeof row> => row !== null)

    const skippedCommitments: string[] = []
    const commitmentRows = extraction.commitments
      .map((commitment) => {
        const entityId = nameToEntityId.get(commitment.entity_name)
        if (!entityId) {
          skippedCommitments.push(commitment.entity_name)
          return null
        }
        return {
          entity_id: entityId,
          total: commitment.total,
          drawn: commitment.drawn,
          undrawn: commitment.undrawn,
          distributions: commitment.distributions,
          call_notice_days: commitment.call_notice_days,
          as_of_date: commitment.as_of_date,
          confidence: commitment.confidence,
          source_document_id: documentId,
        }
      })
      .filter((row): row is NonNullable<typeof row> => row !== null)

    if (edgeRows.length > 0) {
      const { error } = await supabaseAdmin.from('edges').insert(edgeRows)
      if (error) throw new Error(`Failed to write edges: ${error.message}`)
    }
    if (commitmentRows.length > 0) {
      const { error } = await supabaseAdmin.from('commitments').insert(commitmentRows)
      if (error) throw new Error(`Failed to write commitments: ${error.message}`)
    }

    const { error: updateError } = await supabaseAdmin
      .from('documents')
      .update({
        doc_type: extraction.doc_type,
        as_of_date: extraction.as_of_date,
        counterparty: extraction.counterparty,
        extraction_status: 'extracted',
        extraction_error: null,
      })
      .eq('id', documentId)

    if (updateError) throw new Error(`Failed to finalize document status: ${updateError.message}`)

    return NextResponse.json({
      documentId,
      filename: file.name,
      doc_type: extraction.doc_type,
      as_of_date: extraction.as_of_date,
      counterparty: extraction.counterparty,
      entitiesResolved: nameToEntityId.size,
      edgesWritten: edgeRows.length,
      commitmentsWritten: commitmentRows.length,
      skippedEdges,
      skippedCommitments,
      extraction_status: 'extracted',
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unexpected extraction error'
    console.error(`[api/documents] extraction failed for ${file.name}:`, error)
    await markFailed(documentId, message)
    return NextResponse.json(
      { error: 'Extraction failed', detail: message, documentId, extraction_status: 'failed' },
      { status: 500 },
    )
  }
}

/**
 * Entity resolution — the critical path (see PLAN.md §3).
 *
 * ONE Claude call per document upload, over the newly extracted names plus every
 * existing `entities.canonical_name` and `aliases.raw_name` in the database, asking
 * which raw names refer to the same real-world entity. No hand-rolled fuzzy string
 * matching — "Vertexa Software, Inc." and "Vertexa Software Inc" must land on the same
 * node purely from the model's judgement.
 *
 * `aliases.is_manual_override` is an escape hatch: if a human has already pinned a raw
 * name to a specific entity, that pin always wins and is never re-resolved or overwritten.
 */

import Anthropic from '@anthropic-ai/sdk'

import { getSupabaseAdmin } from './supabase-admin'
import type { EntityType } from './extract'

const MODEL = 'claude-sonnet-5'

export interface NameHint {
  name: string
  entity_type: EntityType
  sector: string | null
  geography: string | null
}

interface ExistingEntityRow {
  id: string
  canonical_name: string
  entity_type: string
  sector: string | null
  geography: string | null
}

interface ExistingAliasRow {
  id: string
  entity_id: string
  raw_name: string
  is_manual_override: boolean
}

const RESOLVE_TOOL: Anthropic.Tool = {
  name: 'resolve_entities',
  description:
    'For every name in `names_to_resolve`, decide which real-world entity it refers to: either an existing entity (by exact canonical_name from `existing_entities`) or a new entity not yet in the database.',
  input_schema: {
    type: 'object',
    properties: {
      resolutions: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            raw_name: {
              type: 'string',
              description: 'Exactly one of the strings from names_to_resolve, verbatim.',
            },
            canonical_name: {
              type: 'string',
              description:
                'If this matches an existing entity, this MUST be that entity\'s canonical_name verbatim from existing_entities. If it is a genuinely new entity, choose the fullest / most formal spelling among any names_to_resolve that refer to it (e.g. prefer "Vertexa Software, Inc." over "Vertexa Software Inc").',
            },
            is_new_entity: { type: 'boolean' },
            confidence: { type: 'number', minimum: 0, maximum: 1 },
          },
          required: ['raw_name', 'canonical_name', 'is_new_entity', 'confidence'],
        },
      },
    },
    required: ['resolutions'],
  },
}

let cachedClient: Anthropic | null = null

function getAnthropicClient(): Anthropic {
  if (cachedClient) return cachedClient
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not configured')
  cachedClient = new Anthropic({ apiKey })
  return cachedClient
}

function buildPrompt(
  namesToResolve: string[],
  existingEntities: ExistingEntityRow[],
  existingAliases: ExistingAliasRow[],
  hintsByName: Map<string, NameHint>,
): string {
  const existingLines = existingEntities
    .map((e) => `- ${e.canonical_name} (type: ${e.entity_type}${e.sector ? `, sector: ${e.sector}` : ''})`)
    .join('\n')

  const aliasesByEntity = new Map<string, string[]>()
  for (const alias of existingAliases) {
    const bucket = aliasesByEntity.get(alias.entity_id) ?? []
    bucket.push(alias.raw_name)
    aliasesByEntity.set(alias.entity_id, bucket)
  }
  const aliasLines = existingEntities
    .map((e) => {
      const raws = (aliasesByEntity.get(e.id) ?? []).filter((r) => r !== e.canonical_name)
      return raws.length > 0 ? `- "${e.canonical_name}" is also spelled: ${raws.map((r) => `"${r}"`).join(', ')}` : null
    })
    .filter((line): line is string => line !== null)
    .join('\n')

  const newNameLines = namesToResolve
    .map((name) => {
      const hint = hintsByName.get(name)
      return hint
        ? `- "${name}" (extracted type: ${hint.entity_type}${hint.sector ? `, sector: ${hint.sector}` : ''}${hint.geography ? `, geography: ${hint.geography}` : ''})`
        : `- "${name}"`
    })
    .join('\n')

  return `## Existing entities in the database
${existingLines || '(none yet)'}

## Known alternate spellings already on file
${aliasLines || '(none yet)'}

## Names to resolve (from a newly-uploaded document)
${newNameLines}

For EACH name in "Names to resolve", determine whether it refers to an entity already in "Existing entities" (possibly under a different spelling/capitalization/suffix — e.g. "Inc" vs "Inc." vs no suffix, extra punctuation, abbreviated legal suffixes) or is a genuinely new entity not yet on file. Two or more names in "Names to resolve" may also refer to the SAME new entity as each other — give them identical canonical_name in that case. Call resolve_entities exactly once with one resolution per input name.`
}

async function fetchExistingState(): Promise<{
  entities: ExistingEntityRow[]
  aliases: ExistingAliasRow[]
}> {
  const supabaseAdmin = getSupabaseAdmin()
  const [entitiesResult, aliasesResult] = await Promise.all([
    supabaseAdmin.from('entities').select('id, canonical_name, entity_type, sector, geography'),
    supabaseAdmin.from('aliases').select('id, entity_id, raw_name, is_manual_override'),
  ])

  if (entitiesResult.error) {
    throw new Error(`Failed to load existing entities: ${entitiesResult.error.message}`)
  }
  if (aliasesResult.error) {
    throw new Error(`Failed to load existing aliases: ${aliasesResult.error.message}`)
  }

  return {
    entities: (entitiesResult.data ?? []) as ExistingEntityRow[],
    aliases: (aliasesResult.data ?? []) as ExistingAliasRow[],
  }
}

/**
 * Resolves a batch of newly-extracted names (from one document) against the existing
 * graph, writing any new `entities` and `aliases` rows, and returns a raw-name -> entity_id
 * map covering every input name.
 */
export async function resolveEntities(
  names: readonly string[],
  hints: readonly NameHint[],
  sourceDocumentId: string,
): Promise<Map<string, string>> {
  const supabaseAdmin = getSupabaseAdmin()
  const uniqueNames = Array.from(new Set(names.map((n) => n.trim()).filter(Boolean)))
  const result = new Map<string, string>()
  if (uniqueNames.length === 0) return result

  const { entities: existingEntities, aliases: existingAliases } = await fetchExistingState()

  // Manual overrides always win and are never re-resolved by the model.
  const overrideByRawNameLower = new Map<string, ExistingAliasRow>()
  for (const alias of existingAliases) {
    if (alias.is_manual_override) {
      overrideByRawNameLower.set(alias.raw_name.trim().toLowerCase(), alias)
    }
  }

  const overriddenNames: string[] = []
  const namesNeedingResolution: string[] = []
  for (const name of uniqueNames) {
    const override = overrideByRawNameLower.get(name.toLowerCase())
    if (override) {
      result.set(name, override.entity_id)
      overriddenNames.push(name)
    } else {
      namesNeedingResolution.push(name)
    }
  }

  if (namesNeedingResolution.length > 0) {
    const hintsByName = new Map(hints.map((h) => [h.name, h]))
    const client = getAnthropicClient()
    const prompt = buildPrompt(namesNeedingResolution, existingEntities, existingAliases, hintsByName)

    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 4000,
      tools: [RESOLVE_TOOL],
      tool_choice: { type: 'tool', name: 'resolve_entities' },
      messages: [{ role: 'user', content: prompt }],
    })

    const toolUse = response.content.find(
      (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use',
    )
    if (!toolUse) {
      throw new Error('Entity resolution call did not return a resolve_entities tool call')
    }

    const input = toolUse.input as {
      resolutions?: { raw_name: string; canonical_name: string; is_new_entity: boolean }[]
    }
    const resolutions = input.resolutions ?? []

    const existingByCanonicalLower = new Map(
      existingEntities.map((e) => [e.canonical_name.trim().toLowerCase(), e]),
    )
    // Entities created within THIS batch, keyed by chosen canonical_name (case-insensitive),
    // so multiple new spellings resolving to the same brand-new entity share one row.
    const newlyCreatedByCanonicalLower = new Map<string, string>()

    for (const resolution of resolutions) {
      const rawName = resolution.raw_name?.trim()
      const canonicalName = resolution.canonical_name?.trim()
      if (!rawName || !canonicalName) continue
      const canonicalLower = canonicalName.toLowerCase()

      let entityId = existingByCanonicalLower.get(canonicalLower)?.id
      if (!entityId) entityId = newlyCreatedByCanonicalLower.get(canonicalLower)

      if (!entityId) {
        const hint = hintsByName.get(rawName)
        const { data: inserted, error } = await supabaseAdmin
          .from('entities')
          .insert({
            canonical_name: canonicalName,
            entity_type: hint?.entity_type ?? 'company',
            sector: hint?.sector ?? null,
            geography: hint?.geography ?? null,
            is_root: false,
          })
          .select('id')
          .single()

        if (error || !inserted) {
          throw new Error(`Failed to create entity "${canonicalName}": ${error?.message}`)
        }
        entityId = inserted.id as string
        newlyCreatedByCanonicalLower.set(canonicalLower, entityId)
      }

      result.set(rawName, entityId)
    }

    // Any name the model failed to resolve (shouldn't happen, but never silently drop data)
    // falls back to being its own new entity.
    for (const name of namesNeedingResolution) {
      if (result.has(name)) continue
      const hint = hintsByName.get(name)
      const { data: inserted, error } = await supabaseAdmin
        .from('entities')
        .insert({
          canonical_name: name,
          entity_type: hint?.entity_type ?? 'company',
          sector: hint?.sector ?? null,
          geography: hint?.geography ?? null,
          is_root: false,
        })
        .select('id')
        .single()
      if (error || !inserted) {
        throw new Error(`Failed to create fallback entity "${name}": ${error?.message}`)
      }
      result.set(name, inserted.id as string)
    }
  }

  // Write alias rows for every resolved name, skipping any (raw_name, source_document_id)
  // combination that is already pinned by a manual override.
  const aliasRows = uniqueNames
    .filter((name) => !overriddenNames.includes(name))
    .map((name) => ({
      entity_id: result.get(name) as string,
      raw_name: name,
      source_document_id: sourceDocumentId,
      is_manual_override: false,
    }))

  if (aliasRows.length > 0) {
    const { error } = await supabaseAdmin
      .from('aliases')
      .upsert(aliasRows, { onConflict: 'entity_id,raw_name,source_document_id', ignoreDuplicates: true })
    if (error) {
      throw new Error(`Failed to write aliases: ${error.message}`)
    }
  }

  return result
}

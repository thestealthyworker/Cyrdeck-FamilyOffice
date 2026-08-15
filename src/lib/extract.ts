/**
 * Document extraction — one Claude call per document, structured via tool-use.
 *
 * The hard part is not reading the file, it is mapping MEANING onto the fixed graph
 * vocabulary (holds_equity / holds_debt / guarantees / owns_property / manages) even when
 * the source document uses completely different labels for the same concept (see
 * sample_data/DATA_DICTIONARY.md — "Subscription/Commitment" vs "Total Commitment", etc).
 * The system prompt below is written in terms of what each field MEANS, not which label
 * to look for, specifically so it generalizes across the five fixture archetypes.
 */

import Anthropic from '@anthropic-ai/sdk'
import * as XLSX from 'xlsx'

const MODEL = 'claude-sonnet-5'

export type DocType =
  | 'pe_capital_statement'
  | 'lp_investor_report'
  | 're_appraisal'
  | 'loan_schedule'
  | 'custody_statement'
  | 'other'

export type EntityType =
  | 'fund'
  | 'company'
  | 'property'
  | 'borrower'
  | 'lender'
  | 'account'
  | 'family_office'

export type EdgeType = 'holds_equity' | 'holds_debt' | 'guarantees' | 'owns_property' | 'manages'

export interface ExtractedEntity {
  name: string
  entity_type: EntityType
  sector: string | null
  geography: string | null
}

export interface ExtractedEdge {
  from_entity_name: string
  to_entity_name: string
  edge_type: EdgeType
  weight_pct: number | null
  value: number | null
  currency: string
  as_of_date: string
  confidence: number
  source_note: string | null
}

export interface ExtractedCommitment {
  entity_name: string
  total: number
  drawn: number
  undrawn: number
  distributions: number
  call_notice_days: number | null
  as_of_date: string
  confidence: number
}

export interface ExtractionResult {
  doc_type: DocType
  as_of_date: string
  counterparty: string | null
  entities: ExtractedEntity[]
  edges: ExtractedEdge[]
  commitments: ExtractedCommitment[]
}

const DOC_TYPES: readonly DocType[] = [
  'pe_capital_statement',
  'lp_investor_report',
  're_appraisal',
  'loan_schedule',
  'custody_statement',
  'other',
]

const ENTITY_TYPES: readonly EntityType[] = [
  'fund',
  'company',
  'property',
  'borrower',
  'lender',
  'account',
  'family_office',
]

const EDGE_TYPES: readonly EdgeType[] = [
  'holds_equity',
  'holds_debt',
  'guarantees',
  'owns_property',
  'manages',
]

const FAMILY_OFFICE_NAME = 'Whitmore Family Office'

const SYSTEM_PROMPT = `You are a financial-document extraction engine for a family office exposure graph. You read one bespoke report at a time (PE capital statements, LP investor reports, real-estate appraisals, private-credit loan schedules, custody statements) and output a strictly typed graph fragment: entities (nodes) and edges (typed relationships), plus commitment schedules where relevant.

The recipient / root entity across ALL documents is always "${FAMILY_OFFICE_NAME}" — use that exact string whenever an edge represents something the family office itself holds, owns, or lends.

## Map by MEANING, not by label

Source documents use wildly different vocabulary for the same underlying concept. Map on what a field MEANS, never on literal string matching against a label you've seen before. Examples of concepts that get different names in different documents:
- Total commitment ≡ Subscription amount ≡ Commitment amount — the LP's total contractual commitment to a fund.
- Paid-in capital ≡ Drawn to date ≡ Capital called — cumulative capital actually called and funded so far.
- Remaining unfunded commitment ≡ Undrawn balance ≡ Uncalled capital — what is left that the GP can still call.
- NAV ≡ Reported net asset value ≡ Estimated fair value of LP interest ≡ Fund value — the current mark of the LP's fund interest.
- Cumulative distributions ≡ Distributions to date — capital returned to the LP so far.
Do not assume any one document uses the "standard" label. Read every field for what it represents financially, then place it in the correct output field.

## Edge types — what each one means

- holds_equity: an ownership/LP interest. Used for (a) the family office's LP interest in a fund (value = NAV / fair value of the LP interest), (b) a fund's look-through position in an underlying portfolio company (weight_pct = % of fund NAV, value = weight_pct × fund NAV if not stated directly), (c) the family office's interest in a custody/liquid account (value = total account value).
- holds_debt: a direct loan or debt claim. Used for (a) the family office as direct lender to a borrower on a private-credit / loan schedule (value = principal outstanding), (b) a third-party lender's mortgage against a property, if disclosed (from = the lender, to = the property; value = outstanding balance).
- guarantees: a guarantee or sponsor-support arrangement backing a debt obligation. from = the guarantor entity, to = the entity/borrower whose debt is being guaranteed, value = the guaranteed notional amount. THIS IS THE MOST IMPORTANT AND MOST EASILY MISSED EDGE TYPE. Guarantee language can appear as a footnote, a "Notes" worksheet, a "Sponsor Support" disclosure, or similar — never assume it is only in a dedicated "guarantee" section. Read every sheet, every note, every disclosure paragraph. If a loan or credit facility is described as backed, supported, or guaranteed by a named fund or sponsor, emit a guarantees edge even if the guarantor is not the primary subject of this document.
- owns_property: the family office's ownership of real estate (value = appraised/reconciled market value). If the property is legally held through a wholly-owned holding LLC, still use "${FAMILY_OFFICE_NAME}" as the from-entity and note the holding-entity name in source_note.
- manages: a GP/manager relationship (optional — only emit if clearly stated and it does not duplicate a holds_equity edge).

## Spreadsheets

If you are given multiple worksheets, READ EVERY ONE. Material facts (e.g. an unsecured-debt flag, a guarantee disclosure) are sometimes placed on a secondary sheet like "Notes" rather than the main schedule. Missing a second sheet is a critical extraction failure.

## Entity types

- fund: a PE/VC/credit fund (the vehicle itself, e.g. "X Partners IV, L.P.")
- company: an operating/portfolio company held (directly or look-through) as equity
- property: a real-estate asset
- borrower: an entity that owes a direct loan to the family office (or another lender)
- lender: a third-party lender (e.g. a mortgage bank) that is NOT the family office
- account: a custody/brokerage account holding liquid securities. Name this entity after the CUSTODIAN/BANK issuing the statement (e.g. "Ashworth Custody Account"), not an internal account label the statement happens to print (e.g. "Consolidated Liquid" or similar) — the custodian's name is the stable identifier other reports will reference.
- family_office: only "${FAMILY_OFFICE_NAME}" itself

## Commitments

Emit one commitments row per fund that has an unfunded/undrawn commitment disclosed in this document: entity_name = the fund's name (matching a "fund" entity you also emitted), total / drawn / undrawn / distributions in the same currency, call_notice_days as an integer number of business days if disclosed (else null).

## Dates

Every edge and commitment carries its OWN as_of_date — the reporting date stated in this specific document (never today's date, never a generic "latest" date). If the document states one as-of date for the whole report, use it for every row extracted from this document unless a specific row states a different date.

## Confidence

Every edge and commitment carries a confidence score in [0, 1] reflecting how certain YOU are that the extracted value is correct and correctly mapped, given ambiguity in the source document. A directly stated, unambiguous number (e.g. a table cell with a clear header) should be close to 1.0 (e.g. 0.95-0.99). A value you had to infer or derive (e.g. computing weight_pct × NAV because only the percentage was given, or connecting a guarantee mentioned in a footnote) should be lower (e.g. 0.75-0.9) to reflect that extra inferential step. Never use a constant confidence value for every row — think about each row individually.

## Output discipline

Only extract facts actually present in the document given. Do not invent entities, values, or relationships. Use exact names as they appear in the source for "name"/"from_entity_name"/"to_entity_name" fields — do not normalize spelling yourself (a separate entity-resolution step handles that). Call the record_extraction tool exactly once with the complete result.`

const EXTRACTION_TOOL: Anthropic.Tool = {
  name: 'record_extraction',
  description:
    'Record the structured extraction of this document: its reporting metadata, the entities it mentions, the typed graph edges it establishes, and any commitment schedules it discloses.',
  input_schema: {
    type: 'object',
    properties: {
      doc_type: { type: 'string', enum: DOC_TYPES },
      as_of_date: {
        type: 'string',
        description: 'The document-wide as-of / reporting date, ISO format YYYY-MM-DD.',
      },
      counterparty: {
        type: ['string', 'null'],
        description: 'The GP, manager, appraiser, lender, or custodian issuing this document.',
      },
      entities: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            entity_type: { type: 'string', enum: ENTITY_TYPES },
            sector: { type: ['string', 'null'] },
            geography: { type: ['string', 'null'] },
          },
          required: ['name', 'entity_type', 'sector', 'geography'],
        },
      },
      edges: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            from_entity_name: { type: 'string' },
            to_entity_name: { type: 'string' },
            edge_type: { type: 'string', enum: EDGE_TYPES },
            weight_pct: {
              type: ['number', 'null'],
              description: 'Fraction 0-1 (not a percentage like 20), if this edge is a % of something.',
            },
            value: { type: ['number', 'null'], description: 'Absolute USD value of this edge, if stated or derivable.' },
            currency: { type: 'string', default: 'USD' },
            as_of_date: { type: 'string', description: 'ISO YYYY-MM-DD' },
            confidence: { type: 'number', minimum: 0, maximum: 1 },
            source_note: { type: ['string', 'null'] },
          },
          required: [
            'from_entity_name',
            'to_entity_name',
            'edge_type',
            'weight_pct',
            'value',
            'currency',
            'as_of_date',
            'confidence',
            'source_note',
          ],
        },
      },
      commitments: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            entity_name: { type: 'string' },
            total: { type: 'number' },
            drawn: { type: 'number' },
            undrawn: { type: 'number' },
            distributions: { type: 'number' },
            call_notice_days: { type: ['integer', 'null'] },
            as_of_date: { type: 'string' },
            confidence: { type: 'number', minimum: 0, maximum: 1 },
          },
          required: [
            'entity_name',
            'total',
            'drawn',
            'undrawn',
            'distributions',
            'call_notice_days',
            'as_of_date',
            'confidence',
          ],
        },
      },
    },
    required: ['doc_type', 'as_of_date', 'counterparty', 'entities', 'edges', 'commitments'],
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

/** Renders every worksheet of an .xlsx workbook as labeled CSV text. */
function workbookToText(buffer: Buffer): string {
  const workbook = XLSX.read(buffer, { type: 'buffer' })
  return workbook.SheetNames.map((sheetName) => {
    const sheet = workbook.Sheets[sheetName]
    const csv = XLSX.utils.sheet_to_csv(sheet)
    return `## Sheet: ${sheetName}\n${csv}`
  }).join('\n\n')
}

function isPdf(mimeType: string, filename: string): boolean {
  return mimeType === 'application/pdf' || filename.toLowerCase().endsWith('.pdf')
}

function isSpreadsheet(mimeType: string, filename: string): boolean {
  const lower = filename.toLowerCase()
  return (
    mimeType.includes('spreadsheet') ||
    mimeType.includes('excel') ||
    lower.endsWith('.xlsx') ||
    lower.endsWith('.xls')
  )
}

function coerceDocType(value: unknown): DocType {
  return typeof value === 'string' && (DOC_TYPES as readonly string[]).includes(value)
    ? (value as DocType)
    : 'other'
}

function coerceEntityType(value: unknown): EntityType | null {
  return typeof value === 'string' && (ENTITY_TYPES as readonly string[]).includes(value)
    ? (value as EntityType)
    : null
}

function coerceEdgeType(value: unknown): EdgeType | null {
  return typeof value === 'string' && (EDGE_TYPES as readonly string[]).includes(value)
    ? (value as EdgeType)
    : null
}

function clampConfidence(value: unknown, fallback: number): number {
  const num = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(num)) return fallback
  return Math.min(1, Math.max(0, num))
}

function asStringOrNull(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

function asNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined) return null
  const num = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(num) ? num : null
}

/**
 * Validates and coerces the raw tool-call input into the ExtractionResult shape,
 * dropping rows that are missing data required by the DB's NOT NULL constraints
 * (as_of_date, confidence) rather than letting a bad write crash the whole document.
 */
function parseToolInput(raw: unknown, documentAsOfDate: string): ExtractionResult {
  const input = raw as Record<string, unknown>

  const docType = coerceDocType(input.doc_type)
  const asOfDate = typeof input.as_of_date === 'string' && input.as_of_date ? input.as_of_date : documentAsOfDate
  const counterparty = asStringOrNull(input.counterparty)

  const rawEntities = Array.isArray(input.entities) ? input.entities : []
  const entities: ExtractedEntity[] = rawEntities
    .map((e: Record<string, unknown>) => {
      const entityType = coerceEntityType(e.entity_type)
      if (typeof e.name !== 'string' || !e.name.trim() || !entityType) return null
      return {
        name: e.name.trim(),
        entity_type: entityType,
        sector: asStringOrNull(e.sector),
        geography: asStringOrNull(e.geography),
      }
    })
    .filter((e: ExtractedEntity | null): e is ExtractedEntity => e !== null)

  const rawEdges = Array.isArray(input.edges) ? input.edges : []
  const edges: ExtractedEdge[] = rawEdges
    .map((e: Record<string, unknown>) => {
      const edgeType = coerceEdgeType(e.edge_type)
      if (
        typeof e.from_entity_name !== 'string' ||
        !e.from_entity_name.trim() ||
        typeof e.to_entity_name !== 'string' ||
        !e.to_entity_name.trim() ||
        !edgeType
      ) {
        return null
      }
      const edgeAsOf = typeof e.as_of_date === 'string' && e.as_of_date ? e.as_of_date : asOfDate
      return {
        from_entity_name: e.from_entity_name.trim(),
        to_entity_name: e.to_entity_name.trim(),
        edge_type: edgeType,
        weight_pct: asNumberOrNull(e.weight_pct),
        value: asNumberOrNull(e.value),
        currency: typeof e.currency === 'string' && e.currency ? e.currency : 'USD',
        as_of_date: edgeAsOf,
        confidence: clampConfidence(e.confidence, 0.7),
        source_note: asStringOrNull(e.source_note),
      }
    })
    .filter((e: ExtractedEdge | null): e is ExtractedEdge => e !== null)

  const rawCommitments = Array.isArray(input.commitments) ? input.commitments : []
  const commitments: ExtractedCommitment[] = rawCommitments
    .map((c: Record<string, unknown>) => {
      if (typeof c.entity_name !== 'string' || !c.entity_name.trim()) return null
      const total = asNumberOrNull(c.total)
      const undrawn = asNumberOrNull(c.undrawn)
      if (total === null || undrawn === null) return null
      const commitmentAsOf = typeof c.as_of_date === 'string' && c.as_of_date ? c.as_of_date : asOfDate
      return {
        entity_name: c.entity_name.trim(),
        total,
        drawn: asNumberOrNull(c.drawn) ?? 0,
        undrawn,
        distributions: asNumberOrNull(c.distributions) ?? 0,
        call_notice_days:
          typeof c.call_notice_days === 'number' ? Math.round(c.call_notice_days) : null,
        as_of_date: commitmentAsOf,
        confidence: clampConfidence(c.confidence, 0.7),
      }
    })
    .filter((c: ExtractedCommitment | null): c is ExtractedCommitment => c !== null)

  return { doc_type: docType, as_of_date: asOfDate, counterparty, entities, edges, commitments }
}

export interface ExtractDocumentParams {
  filename: string
  mimeType: string
  buffer: Buffer
}

/** Runs the single structured-extraction Claude call for one uploaded document. */
export async function extractDocument({
  filename,
  mimeType,
  buffer,
}: ExtractDocumentParams): Promise<ExtractionResult> {
  const client = getAnthropicClient()

  const userContent: Anthropic.MessageParam['content'] = []

  if (isPdf(mimeType, filename)) {
    userContent.push({
      type: 'document',
      source: {
        type: 'base64',
        media_type: 'application/pdf',
        data: buffer.toString('base64'),
      },
    })
    userContent.push({
      type: 'text',
      text: `The attached PDF is "${filename}". Extract it per the system instructions and call record_extraction.`,
    })
  } else if (isSpreadsheet(mimeType, filename)) {
    const text = workbookToText(buffer)
    userContent.push({
      type: 'text',
      text: `The following is the full contents of every worksheet in "${filename}" (each preceded by its sheet name), rendered as CSV. Read every sheet before extracting — material facts are sometimes only on a secondary sheet.\n\n${text}\n\nExtract this workbook per the system instructions and call record_extraction.`,
    })
  } else {
    throw new Error(`Unsupported file type for ${filename} (mimeType: ${mimeType})`)
  }

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 8000,
    system: SYSTEM_PROMPT,
    tools: [EXTRACTION_TOOL],
    tool_choice: { type: 'tool', name: 'record_extraction' },
    messages: [{ role: 'user', content: userContent }],
  })

  const toolUse = response.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use',
  )
  if (!toolUse) {
    throw new Error(`Claude did not return a record_extraction tool call for ${filename}`)
  }

  // Fallback as-of-date if the model somehow omits it: today is wrong for this domain,
  // so we require the model's own value — this fallback only guards against undefined
  // crashing downstream date coercion for individual edges that omit their own date.
  const documentAsOfDate =
    typeof (toolUse.input as Record<string, unknown>).as_of_date === 'string'
      ? ((toolUse.input as Record<string, unknown>).as_of_date as string)
      : ''
  if (!documentAsOfDate) {
    throw new Error(`Claude did not report an as_of_date for ${filename}`)
  }

  return parseToolInput(toolUse.input, documentAsOfDate)
}

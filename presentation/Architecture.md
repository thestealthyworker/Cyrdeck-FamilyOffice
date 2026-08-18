# Architecture — One Page

**Cyrdeck Exposure Graph** · Track 3, Single Family Office
Live: cyrdeck-familyoffice.vercel.app · Repo: github.com/thestealthyworker/Cyrdeck-FamilyOffice

## The claim

Look-through that crosses **asset classes**, not just fund layers. Conventional look-through is built for fund-of-funds and feeder structures — equity wrappers inside equity wrappers. It cannot represent a direct loan and a fund holding as two edges to the *same* entity, because asset class is a load-bearing axis of those schemas. That gap is the entire product.

## Pipeline

```
Upload / email  →  Extract  →  RESOLVE ENTITIES  →  Typed graph  →  Traverse  →  Findings
                                      ↑
                            the critical path
```

Documents (PDF, XLSX) land in Supabase Storage. One Claude call per document extracts structured data — PDFs as native document blocks, every worksheet of a spreadsheet rendered to CSV so disclosures hidden on a second sheet are not missed. A second Claude call resolves extracted names against all existing entities and aliases; no hand-rolled fuzzy matching. Resolved edges and commitments are written, and the traversal re-derives every finding on the next read.

Entity resolution is the critical path: if two spellings of one company fail to merge, every finding evaporates.

## Schema — five tables, three rules

`documents` · `entities` (nodes) · `aliases` · `edges` (typed) · `commitments`

1. **One typed `edges` table**, not one per asset class. `edge_type ∈ {holds_equity, holds_debt, guarantees, owns_property, manages}`. Equity, debt and guarantees are edges between the same nodes — this is what makes cross-asset-class exposure computable, and what a siloed incumbent cannot retrofit cheaply.
2. **`guarantees` is a first-class edge type**, never a text note on a loan record.
3. **`as_of_date` and `confidence` are `NOT NULL`** on every value-bearing row. A number without a date is a lie; an unscored extraction is an unaudited claim.

## How findings are derived

Rules, not assertions. Traversal walks outward from the single `is_root` entity, following only ownership edges for look-through, with cycle guards and a depth cap.

- **`cross_asset_class`** fires on any entity reachable via ≥2 distinct edge types, escalating to *critical* when a guarantee into it originates from an entity that is itself reachable from the root — a guarantor whose capacity is correlated to the exposure it secures.
- **`hidden_concentration`** fires on entities reached via ≥2 distinct intermediaries above 10% of the private-equity book.
- **Liquidity** sums undrawn commitments against all custody accounts, applies per-asset-class stress shocks, and runs a 1,000-path Monte Carlo benchmarked to the Cambridge Associates 3× post-stress standard.

Uploading a previously unseen document produced a new finding with no code change — verified live.

## Stack

Next.js 16 / React 19 / TypeScript / Tailwind 4 on Vercel · Supabase Postgres + Storage · Anthropic Claude for extraction and resolution. Reads use a publishable key; **RLS is enabled with public `select` and no write policies**, so writes require the service role, held only server-side.

## Known simplifications, declared

No auth, no multi-tenancy, a single hardcoded family-office root, extraction tuned to the fixture archetypes, and synthetic sample data (no organiser data pack existed for this track). RLS is read-only rather than tenant-scoped.

## Boilerplate disclosure

Generated or third-party: the `create-next-app` scaffold, Next.js, React, Tailwind, `@supabase/supabase-js`, `@anthropic-ai/sdk`, `xlsx`, and the Fraunces / IBM Plex typefaces. Ours: the schema design, the traversal and findings logic, the liquidity model, the extraction and resolution prompts, and the dashboard.

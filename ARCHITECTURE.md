# Architecture — Exposure Graph (Track 3, Single Family Office)

Live: https://cyrdeck-familyoffice.vercel.app · Repo: https://github.com/thestealthyworker/Cyrdeck-FamilyOffice

This document is the honest account of what was built, why, and what was cut. It is written
to be checked against the source, not taken on faith.

---

## 1. The problem and the seam we own

A family office's risk is not unknown — it is unaggregated. Everything needed to see it is
already written down, across twenty documents in a dozen formats from nine counterparties
that nobody reads together. 73% of family offices cite private-market data as their single
biggest technology challenge; 75% report internal expertise gaps in private-market
analytics (Masttro). NAVs lag 45–75 days after quarter-end, so every number on file is
already stale and from a different date.

**We do not claim a green field.** Two vendors already cover large parts of this space, and
we say so explicitly rather than let a judge discover it:

- **Aleta** (launched 15 May 2026) does capital-call and distribution forecasting across
  funds and vintages, J-curve modelling, and bull/base/bear stress testing, including
  evaluating the impact of a new commitment before allocating.
- **Masttro** does fund look-through — proportional allocation through fund layers so a
  family office can interrogate exposure at the company level, with concentration flags
  by GP and vintage.

Neither connects to the other, and neither crosses asset classes. That is the specific,
narrow claim we make:

> **Look-through that crosses asset classes, not just fund layers.**

Conventional look-through — Masttro's included, per its public material — is built for
fund-of-funds and feeder structures: equity wrappers nested inside equity wrappers, where
"asset class" is a fixed axis of the data model (PE holdings in one table, credit
positions in another, real estate in a third). That works for the case it was built for.
It cannot represent a **direct loan** and a **fund holding** as two edges into the *same*
entity, because the tables that would need to intersect don't share a key. A borrower ID
in a loan schedule and a portfolio-company row in a fund's schedule of investments are
different objects in different systems, by construction, even when they are the same
company.

Our fixture portfolio's headline finding — Aurex Data Centers held as fund equity, as an
unsecured direct loan, and guaranteed by the very fund that holds the equity — is
structurally invisible to that kind of model. It is only computable if equity holdings,
debt positions, and guarantees are edges in one graph over one set of entity nodes. That is
the whole architectural bet, described in §3–4 below.

---

## 2. Architecture

```
Upload  →  Extract  →  Resolve entities  →  Graph  →  Traverse  →  Findings
                              ↑
                  this is the critical path
```

- **Upload / Extract.** Source documents (PDF capital statements, LP reports, appraisals,
  XLSX loan schedules and custody statements) land in Supabase Storage; an LLM extraction
  step reads each fixture archetype and writes structured rows — entities, aliases, edges,
  commitments — each tagged with the source document, an `as_of_date`, and a `confidence`
  score.
- **Resolve entities.** The extractor sees raw names as they appear on each document —
  "Vertexa Software, Inc." on one PDF, "Vertexa Software Inc" on another. Nothing
  downstream works until these are recognized as the same node. This is why entity
  resolution, not extraction accuracy, is the critical path: if "Vertexa Software, Inc." ≠
  "Vertexa Software Inc," or the Kestrel guarantee note doesn't get linked to the Kestrel
  fund entity, the findings simply do not fire — there is no fallback that fixes it later.
  Raw names are kept in `aliases`, pointing at a canonical row in `entities`, so the graph
  is built on canonical nodes regardless of how a counterparty happened to spell the name.
- **Graph.** Canonical entities and typed edges live in Postgres (`src/lib/graph.ts` reads
  `entities`, `edges`, `documents` directly via `supabase.from(...)`).
- **Traverse.** `computeExposure()` in `src/lib/graph.ts` does a depth-first walk from the
  single root entity (the family office), following every outbound edge, capped at depth 8
  as a cycle guard, and looking through only `holds_equity` and `owns_property` edges — a
  loan or a guarantee does not confer look-through, because you don't own what you lent
  against or what someone else pledged.
- **Findings.** Two finding functions run over the traversal output and the aggregated
  per-entity exposure: `findCrossAssetClass` and `findHiddenConcentration`, both in
  `src/lib/graph.ts`. Neither is told what to find; see §4.

Two API routes expose this: `GET /api/exposure` (`src/app/api/exposure/route.ts`) calls
`computeExposure()`; `GET /api/liquidity` (`src/app/api/liquidity/route.ts`) calls
`runLiquidityStressSimulation()` from `src/lib/liquidity.ts`. Both are `force-dynamic`,
uncached, computed fresh from Postgres on every request — there is no precomputed findings
table. The dashboard (`src/components/dashboard/useDashboardData.ts`) is a client component
that fetches both routes and renders `ExposureTable`, `FindingCard`, `LiquidityPanel`, and
`ConvergenceHero`; drill-down to source document and as-of date works because every
`ExposurePath` carries `sourceDocument` and `asOfDate` fields straight through from the
edge row that produced it.

---

## 3. Schema and the three rules

```
documents     id, storage_path, filename, doc_type, as_of_date, extraction_status
entities      id, canonical_name, entity_type, sector, geography, is_root
aliases       id, entity_id, raw_name, source_document_id
edges         id, from_entity_id, to_entity_id, edge_type, weight_pct, value,
              as_of_date, confidence, source_document_id, source_note
commitments   id, entity_id, total, drawn, undrawn, distributions,
              call_notice_days, as_of_date, confidence
```

Three decisions are load-bearing, and each is enforced at the schema level, not as
application convention:

1. **One `edges` table, typed by `edge_type` — not one table per asset class.** The enum
   is `holds_equity | holds_debt | guarantees | owns_property | manages`. An equity
   holding, a direct loan, and a guarantee are the same kind of object — a directed,
   valued, dated relationship between two entities — differing only in a label. Put them
   in separate tables (an `equity_holdings` table, a `loans` table, a `guarantees` table)
   and every cross-asset-class query becomes an application-layer join across
   schema-inconsistent shapes; put them in one typed table and it becomes one recursive
   traversal. This is the single choice that makes the headline finding computable, and it
   is the choice a siloed incumbent's schema cannot cheaply retrofit — asset-class
   partitioning is usually a foundational modeling decision, not a late add.
2. **`guarantees` is a first-class edge type, not a text note on a loan record.** A
   guarantee is not metadata about a loan; it is a separate exposure with its own source
   and its own counterparty, which happens to point at the same node as the loan it backs.
   Modeling it as a note field makes it unqueryable — you cannot traverse into a string.
   Modeling it as an edge means `findCrossAssetClass` can ask "does a guarantee into this
   node originate from an entity I am also otherwise exposed to?" as a graph query.
3. **Every value row carries `as_of_date` and `confidence`, NOT NULL, no exceptions.** A
   number without a date is a lie by omission — this portfolio's five source documents
   span 2026-03-31 to 2026-07-31, and a naive sum across them ($32,380,000) is a figure
   that never existed at any single moment. Every finding in `graph.ts` reports the actual
   as-of dates behind its number for exactly this reason (see `pathEvidence()` and the
   "superposition, not a point-in-time figure" language in `findCrossAssetClass`).
   `confidence` is the honest answer to "what if your LLM extraction is wrong" — it is
   carried through the traversal as the minimum confidence along a path
   (`Math.min(...nextConfidences)` in `traverse()`), so a finding built on a shaky
   extraction is visibly shakier than one built on a clean one, rather than presenting
   both with equal certainty.

---

## 4. How the findings are computed

Both findings fall out of the traversal; neither is a hardcoded rule about Aurex or
Vertexa by name. This is verifiable directly in `src/lib/graph.ts`.

**Cross-asset-class exposure (`findCrossAssetClass`, lines ~405–455).** For every entity
reached during traversal, count the number of *distinct* `edge_type` values among the
paths that reach it (`exposure.edgeTypeCount`). Any entity reached via two or more
different edge types qualifies — this is a general condition over `byEdgeType`, computed
in `aggregate()`, not a name check. Severity escalates from `high` to `critical` only when
a further condition holds: a `guarantees` edge into that entity originates from an entity
that is *itself* reachable from the root (`reachableIds.has(found.terminalFromId)`). That
second condition is what turns "diversified across three asset classes" into "your hedge
is your own position" — the code computes it by intersecting the guarantor's entity ID
against the set of entities already reachable from the family office, which is exactly the
graph-theoretic statement of "the guarantor is also a portfolio holding." Live result on
the seed data: Aurex Data Centers, `directTotal` $2,459,000, `guaranteeNotional`
$2,000,000, reached via 3 distinct edge types, severity `critical`.

**Hidden concentration (`findHiddenConcentration`, lines ~461–514).** For every entity
reached via an indirect (length > 1) equity path, collect the set of distinct
intermediary funds it came through. If reached via 2 or more distinct intermediaries
(`MIN_PATHS_FOR_CONCENTRATION = 2`) whose combined look-through value is at least 10% of
the PE book (`CONCENTRATION_THRESHOLD = 0.1`, where the PE book itself is computed
separately in `computePeBookValue()` as the sum of the root's own `holds_equity` edges
into fund entities — not looked through, to avoid double-counting), it's flagged.
Live result: Vertexa Software, $2,496,000, 20.0% of a $12,480,000 PE book, reached through
two funds under two name spellings that entity resolution had already merged.

Both thresholds (`0.1`, `2`) are named constants at the top of the file, not inlined magic
numbers, and both are generic conditions over the graph shape — they would fire on any
entity satisfying them, not only the two that happen to appear in the fixture set.

**Liquidity stress (`src/lib/liquidity.ts`).** This one is closer to a conventional
model — comparable to what Aleta already ships — and we present it as such, not as
differentiated. Undrawn commitments ($5,650,000) against the liquid book ($4,200,000)
give a base coverage of 0.74x. Under stress (public equity −30%, IG bonds −5%, capital
calls accelerated to 65% of undrawn within 12 months, distributions to zero), the liquid
book stresses to $3,365,000 against $3,672,500 of calls due: coverage 0.92x, shortfall
$307,500. This is benchmarked against the Cambridge Associates prescribed 3x post-stress
liquid-to-annual-cash-needs standard (`CAMBRIDGE_ASSOCIATES_STANDARD = 3` in
`liquidity.ts`), not an invented threshold. A 1,000-path Monte Carlo
(`runMonteCarlo()`, seeded mulberry32 PRNG for reproducibility) jitters shock rates and
call/distribution timing per path and reports P5/P50/P95 minimum coverage and probability
of shortfall, walked quarterly against blended base/stress pacing curves.

---

## 5. Known simplifications — declared up front

- **No auth, no multi-tenancy.** There is one hardcoded family office (Whitmore Family
  Office) and one root entity (`is_root = true` in `entities`). `computeExposure()`
  throws if zero or more than one root row exists; it does not support multiple
  households.
- **Extraction is narrowed to the five fixture archetypes** described in
  `sample_data/DATA_DICTIONARY.md`: a PE capital statement, an LP report with deliberately
  different vocabulary, a real estate appraisal, a two-sheet private credit schedule, and
  a custody statement. It has not been tested against arbitrary real-world document
  layouts.
- **All data is synthetic.** No organizer data pack existed for Track 3 at build time. The
  five fixtures were engineered — five formats, five different as-of dates, two deliberate
  name-spelling variants, and a guarantee link deliberately split across two documents
  from two counterparties (one of them on a second worksheet) — specifically to test
  whether extraction and entity resolution could reconstruct the findings from documents
  alone. `sample_data/DATA_DICTIONARY.md` is the gold truth these are checked against.
- **RLS is present but not tenant-scoped.** See §6 for the reasoning; this is a real
  security decision, not an oversight, but it is a single-tenant posture dressed as
  row-level security, not actual multi-tenant isolation.
- **The Monte Carlo's fund NAVs are hardcoded by name-hint**
  (`FUND_NAV_BY_ENTITY_HINT` in `liquidity.ts`), because no `nav` column exists on
  `commitments` yet — this is flagged in-code as the same category of decision as the
  stress shock rates (a scenario parameter, not a fabricated data point), but it is
  string-matching on fund name (`'meridian'`, `'kestrel'`) rather than a foreign key, and
  would silently return 0 NAV for a fund whose name doesn't contain either substring.

---

## 6. Boilerplate and third-party disclosure

The application started as an unmodified `create-next-app` output — the `package.json`
`name` field read `"scaffold"` until late in the build, when it was renamed to
`cyrdeck-familyoffice`. The scaffold was generated, not written.

**Generated / third-party, not ours:**

- Next.js 16.3.1 / React 19.2.8 / React DOM 19.2.8 — framework, App Router, dev/build/lint
  scripts, TypeScript config, ESLint config (`eslint-config-next`) — all scaffold defaults.
- Tailwind CSS 4 (`@tailwindcss/postcss`) — styling engine, not a custom design system.
- `@supabase/supabase-js` — the Postgres/Storage client SDK; we call it directly, we did
  not write a data-access layer around it beyond the query functions in `graph.ts` and
  `liquidity.ts`.
- Fonts: Fraunces, IBM Plex Sans, IBM Plex Mono, loaded via `next/font/google` in
  `src/app/layout.tsx` — Google-hosted font families, not custom type.
- The general shape of a Next.js API route (`route.ts` exporting `GET`) and the
  `NextResponse.json(...)` response pattern are framework conventions, not novel code.

**Genuinely ours:**

- The schema design in §3, specifically the decision to unify equity, debt, and guarantee
  relationships into one typed `edges` table with `guarantees` as first-class and
  `as_of_date`/`confidence` as non-nullable — this is the entire thesis of the project and
  is bespoke to this problem.
- The traversal and findings logic in `src/lib/graph.ts` — the depth-first walk with
  look-through restricted to ownership edges, the cross-asset-class detection with its
  guarantor-correlation escalation, and the hidden-concentration detection with its
  PE-book denominator — all hand-written, none of it is a library call.
  `src/lib/liquidity.ts` — the stress scenario, the Cambridge Associates benchmark
  comparison, the asymmetry framing, and the seeded Monte Carlo simulation.
- The dashboard components in `src/components/dashboard/` — `ExposureTable`,
  `FindingCard`, `LiquidityPanel`, `ConvergenceHero`, and the `useDashboardData.ts`
  fetch/state layer that wires them to `/api/exposure` and `/api/liquidity`.
- The entity resolution approach described in §2 (LLM-driven alias merge with a manual
  alias-override escape hatch), and the extraction pipeline feeding the five fixture
  archetypes.

---

## 7. Honest framing note

Two things we deliberately did not overstate:

**LP default is the tail risk, not the headline.** Defaulting on a capital call can
contractually trigger forfeiture of up to 100% of the LP interest (Meridian LPA §6.4,
per `sample_data/DATA_DICTIONARY.md` doc 1) — the liquidity module surfaces this and
computes a roughly 40.6x ratio of NAV-at-risk ($12,480,000) to the $307,500 stressed
shortfall that could trigger it (`computeAsymmetry()` in `liquidity.ts`). But LP defaults
are, per the competitive-landscape research, "relatively rare" in practice — the
contractual terms are harsh specifically to deter default, not because default is common.
The primary, defensible cost of a liquidity shortfall is not forfeiture; it is being
forced to sell liquid, growth-oriented assets at the bottom of a drawdown to fund a
capital call, which is the mechanism Cambridge Associates describes and the one this
project leads with. Forfeiture is real, disclosed, and quantified — it is not the
headline.

**The naive portfolio total is not a real number.** Summing every value across all five
source documents gives $32,380,000. That figure is presented nowhere in this system as an
actual portfolio value, because the five documents carry five different as-of dates
(2026-03-31 through 2026-07-31) — the sum mixes a March fund valuation with a July custody
statement and pretends they describe the same moment. They don't. Every finding this
system produces instead reports its own as-of date range explicitly
(`asOfDates` on every `Finding`, `evidence.dates` in the finding detail text) and says so
plainly when a total spans more than one reporting date — see the "superposition, not a
point-in-time figure" and "never existed at any single moment" language in
`findCrossAssetClass` and `findHiddenConcentration` in `src/lib/graph.ts`. Mixed as-of
dates are a data quality fact about this market, not a bug to paper over with a single
clean-looking number.

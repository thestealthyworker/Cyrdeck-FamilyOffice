# Track 3 — Single Family Office
## Cross-asset-class exposure: the risk that lives between the silos

**Event:** CybrDeck Hackathon, Sat 15 Aug 2026 · **Deadline:** 5:00 PM · **Now:** 10:29 AM
**GitHub:** thestealthyworker · **Status:** planning complete — ready for Claude Code

---

## 1. The problem (validated — see `COMPETITIVE_LANDSCAPE.md`)

A family office's risk is not unknown. It is **unaggregated**.

Everything needed to understand it is already written down — in twenty documents, in
twelve formats, from nine counterparties, that nobody reads together. The consequence:

- **73%** of family offices cite private-market data as their single biggest technology
  challenge; **75%** report internal expertise gaps in private-market analytics.
- Most still run PE administration **on spreadsheets across 20+ funds**, while PE has
  grown to **~21% of AUM** and alternatives to ~45% of the average portfolio.
- NAVs **lag 45–75 days** after quarter-end, so every number in the file is stale and
  from a different date.

The failure mode this produces, per Cambridge Associates: in a weakening market "the
ratio of distributions to contributions will likely decline" — capital calls accelerate
exactly as the distributions that would have funded them dry up. Families are then forced
to "sell growth-focused assets during a drawdown to fund liquidity needs, **undoing
hard-earned portfolio outperformance**."

> **Honest framing note:** LP *default* (and forfeiture of the LP interest) is a real
> contractual risk but is documented as "relatively rare." **Do not headline it.** The
> primary, defensible cost is **forced selling at the bottom**. Forfeiture is the tail.

Cambridge prescribes a **3× post-stress liquid-to-annual-cash-needs buffer** as the
institutional standard. Our fixture portfolio sits at **0.92×**. Use their threshold, not
an invented one.

---

## 2. What we build, and the seam we own

The product is unchanged in mechanism: **you forward the statements you already receive,
and the system maintains one live answer to "what am I actually exposed to?"** Documents
arrive → extracted → cross-checked against the **entity graph** → the risk number changes.

But the **headline claim is now narrow and defensible**, because much of this ground is
taken (`COMPETITIVE_LANDSCAPE.md`): **Aleta** shipped capital-call forecasting and
scenario stress-testing on 15 May 2026; **Masttro** ships fund look-through. Do not claim
a green field.

### The claim we own

> **Look-through that crosses asset classes, not just fund layers.**

Conventional look-through is built for fund-of-funds and feeder structures — equity
wrappers inside equity wrappers. It cannot represent a **direct loan** and a **fund
holding** as two edges to the *same entity*, because asset-class silos are load-bearing in
those data models. That is the gap, and our headline finding sits squarely in it.

### The headline finding: your hedge is your own position

**Aurex Data Centers** appears in the document set three times, in three different roles,
across three asset classes:

1. **Equity** — held inside Kestrel Ventures Fund III (~**$459,000**)
2. **Debt** — a **$2,000,000 unsecured** direct loan via Blackfin
3. **The guarantee backing that loan** — provided by **Kestrel Ventures Fund III itself**,
   the very fund whose equity you own (disclosed in Blackfin's *second* worksheet, and
   in a "Sponsor Support" note buried in Kestrel's LP report)

So: one credit event at Aurex impairs the equity, leaves the loan unsecured **and**
weakens the guarantee that was the loan's only credit support — because the guarantor's
capacity is correlated to the same portfolio. **$2,459,000 of exposure that a conventional
report presents as diversification across two asset classes, with a credit protection that
is really just your own position wearing a different hat.**

You cannot see this in a table. You cannot see it in fund-layer look-through. You can only
see it if guarantor relationships are edges in the same graph as holdings — which is the
entire architectural bet.

### Supporting findings (keep, but don't lead with them)

- **Hidden single-company concentration.** Vertexa Software sits inside Meridian IV *and*
  Kestrel III under two spellings — **$2,496,000 = 20% of the entire PE book**. Real, but
  Masttro-adjacent; use it as the warm-up, not the punchline.
- **Liquidity collision.** $5.65M undrawn vs $4.2M liquid = **0.74× base coverage**. Under
  stress (equity −30%, calls accelerate to 65% of undrawn, distributions → 0):
  **0.92× coverage, $307,500 shortfall — against Cambridge's 3× standard.** Aleta does
  this; present it as table stakes we also cover, not as the differentiator.

---

## 3. Architecture

```
Forward/upload  →  Extract  →  RESOLVE ENTITIES  →  Graph  →  Traverse  →  Findings
                                      ↑
                          this is the whole product
```

Next.js + TypeScript on Vercel · Supabase Postgres + Storage · LLM structured extraction.

### Schema — the load-bearing decisions

```
documents     id, storage_path, filename, doc_type, as_of_date, extraction_status
entities      id, canonical_name, entity_type (fund|company|property|borrower|
              lender|account), sector, geography                    ← graph NODES
aliases       id, entity_id, raw_name, source_document_id           ← the compounding asset
edges         id, from_entity_id, to_entity_id,
              edge_type (holds_equity | holds_debt | guarantees |
                         owns_property | manages),                  ← graph EDGES
              weight_pct, value, as_of_date, confidence,
              source_document_id
commitments   id, entity_id, total, drawn, undrawn, call_notice_days
```

Three rules, enforced at schema level:

1. **One `edges` table, typed — not separate tables per asset class.** Equity holdings,
   debt positions, and guarantees are all edges between the same nodes. *This single
   choice is what makes the headline finding computable*, and it's what asset-class-siloed
   incumbents can't retrofit cheaply.
2. **`guarantees` is a first-class edge type.** Not a text note on a loan record.
3. **Every value carries `as_of_date` + `confidence`.** No exceptions. A number without a
   date is a lie; an LLM extraction without a confidence score is an unaudited claim — and
   the confidence flag is also the honest answer to "what if your AI is wrong."

**Total exposure to any node** = sum over all inbound paths from the family office root:
`Σ (Π edge weights along path) × leaf value`, grouped by `edge_type` so a single company's
equity, debt, and guarantee exposure surface together.

### Entity resolution — the critical path
Do **not** hand-roll fuzzy matching. After extraction, one LLM call over the full extracted
name list: *"which of these refer to the same real-world entity?"* → write `entities` +
`aliases`. Keep a manual alias-override in the schema as the escape hatch. If this step
fails, every finding evaporates — build it early, test it immediately.

### Simulation — table stakes, keep it cheap
Per commitment: draw call timing from a pacing curve (accelerated under stress), draw
distributions (→ 0 under stress), shock the liquid book by asset type, walk quarters,
record minimum coverage across ~1,000 paths. A few hundred lines. Compare output to
Cambridge's 3× standard.

---

## 4. Build plan — 10:29 AM → 5:00 PM (~6.5h)

**Declared cuts, up front:** no auth, no multi-tenancy, no RLS, single hardcoded family
office, extraction narrowed to the five fixture archetypes. All defensible "known
simplifications" in the architecture summary.

| # | Phase | Time | Done when |
|---|---|---|---|
| 1 | Repo, Supabase schema, Vercel link, env | 40m | Deployed route reads from Postgres |
| 2 | Extraction → `edges` + `commitments`, with as_of_date + confidence | 90m | All 5 fixtures match `DATA_DICTIONARY.md` gold values |
| 3 | **Entity resolution + multi-type edge traversal** | 70m | **Headline finding computed from the DB, not hardcoded** |
| 4 | Liquidity simulation vs Cambridge 3× | 50m | Reproduces 0.92× / $307,500 |
| 5 | Dashboard: exposure-by-entity view, 3 findings, drill-down to source doc | 90m | A stranger reads the Aurex finding without narration |
| 6 | Deploy, verify repo + demo resolve, architecture summary, 60s video, submit | 45m | Form submitted before 5:00 PM |

Buffer ~35m. **Cut-line: if behind at phase 5, drop the graph visualisation, never the
graph computation.** The findings are the product; the node diagram is decoration.

**Demo insurance:** seed the DB with the fixtures pre-extracted so the dashboard is never
empty; still do one live upload in the video.

**60-second video script** — lead with the finding, not the tech:
- 0–10s upload
- 10–35s **Aurex**: "you own the equity, you hold the unsecured loan, and the guarantee
  protecting that loan is from the fund you own the equity in. One event, three hits."
- 35–50s Vertexa 20%-of-PE-book, and 0.92× vs Cambridge's 3×
- 50–60s "Aleta forecasts your cash. Masttro sees through your funds. Neither crosses
  asset classes. This does — from an inbox."

---

## 5. Sample data (`sample_data/`)

No organizer data pack exists. Five synthetic fixtures, **five formats, five different
as-of dates** (2026-03-31 → 2026-07-31, so naive summing is provably wrong), engineered to
carry the findings. Verified by `check_math.py`. Gold truth in `DATA_DICTIONARY.md`.

| File | Type | As-of | Carries |
|---|---|---|---|
| `01_meridian_growth_IV_capital_statement.pdf` | PE capital account + schedule of investments | 2026-06-30 | Vertexa 20%; $2.15M undrawn |
| `02_kestrel_ventures_III_investor_report.pdf` | LP report, *different vocabulary* | 2026-03-31 | Vertexa again; Aurex equity; $3.5M undrawn; **"Sponsor Support" guarantee note** |
| `03_harbor_view_terrace_appraisal.pdf` | RE appraisal | 2026-05-15 | $8.25M value, $4.0M mortgage |
| `04_blackfin_private_credit_schedule.xlsx` | Loan schedule, 2 sheets | 2026-06-30 | **Aurex unsecured $2M + Kestrel guarantee (sheet 2)**; Nordvale covenant watch |
| `05_ashworth_custody_liquid_account.xlsx` | Custody — the liquid book | 2026-07-31 | $4.2M |

The guarantee link is deliberately split across **two documents from two counterparties**,
one of them on a second worksheet — the extractor has to find both and the resolver has to
connect them. That difficulty *is* the demo.

---

## 6. Open items

- **LLM key** — you have one; into Vercel env at phase 1. Don't paste it in chat.
- **Supabase / Vercel** — projects not yet created. Connecting the Supabase + Vercel MCP
  connectors would make Claude Code self-sufficient; otherwise create manually and hand
  over URL + keys at phase 1.
- **GitHub** — sandbox can't complete browser OAuth. Use a repo-scoped PAT, or
  `gh auth login` where you have a browser.
- **Real organizer data** — if released mid-event, prioritise it; keep fixtures as fallback.

## 7. Risks

- **Entity resolution is the critical path.** If "Vertexa Software, Inc." ≠ "Vertexa
  Software Inc", or the Kestrel guarantee doesn't link to the Kestrel fund node, the
  findings vanish. Manual alias-override is the escape hatch.
- **Don't overclaim on stage.** Name Aleta and Masttro; state the seam precisely. A
  novelty claim gets punctured in ten seconds and costs more than it wins.
- **Disclose boilerplate** (Next.js starter, shadcn, libraries) in the architecture
  summary — required by the code-integrity rule.

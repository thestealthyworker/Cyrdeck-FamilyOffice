# WORKFLOW — End to End
## How external and internal data interact, and what comes out

Companion to `PLAN.md` and `COMPETITIVE_LANDSCAPE.md`. This document exists to answer one
question: **what actually happens, from a document landing in an inbox to a number
changing on a screen** — and what can go wrong at each step.

---

## 0. The two kinds of data

Everything in this system is one of two things. Keeping them straight is most of the
architecture.

### EXTERNAL — arrives from the outside, you don't control it

| Input | Source | Cadence | Notes |
|---|---|---|---|
| Fund capital account statements | GP / fund administrator | Quarterly | **45–75 day lag** after period end |
| **Capital call notices** | GP | Irregular, unpredictable | **10 business day fuse.** Different urgency class to everything else |
| Distribution notices | GP | Irregular | Reduces future obligation pressure |
| Property appraisals | Appraiser | Annual or ad-hoc | Often the stalest data in the book |
| Loan / servicer schedules | Credit servicer | Monthly–quarterly | Covenant status lives here |
| Custody statements | Bank / custodian | Monthly or daily | **The liquid book — the denominator of everything** |
| Market prices | Market data feed | Continuous | Moves the liquid book without any document arriving |
| LLM API | Anthropic / OpenAI | On demand | Hard external dependency; plan for failure |

### INTERNAL — state you own, and that compounds

| State | What it is | Why it matters |
|---|---|---|
| **Entity graph** | Nodes (companies, funds, properties, borrowers, lenders) + typed edges | The product. Everything else serves this |
| **Alias corpus** | `"Vertexa Software, Inc."` = `"Vertexa Software Inc"` = `"Vertexa"` | The moat. Grows per document, never depreciates |
| **Commitment register** | Total / drawn / undrawn per fund, notice periods | Your obligations — the thing that's invisible today |
| **Policy thresholds** | Coverage floor (Cambridge 3×), concentration limits, staleness limit | Turns raw numbers into findings |
| **Confidence calibration** | How much to trust extraction, per GP and per field | Improves as analysts correct things |
| **Analyst overrides** | Human corrections, confirmed/rejected merges | The feedback loop |

> **The core interaction:** external data is *episodic and untrusted*. Internal state is
> *cumulative and curated*. Every arriving document is a claim to be reconciled against
> what you already know — not a row to be appended.

---

## 1. The pipeline

```
 EXTERNAL                    PIPELINE                      INTERNAL STATE
 ────────                    ────────                      ──────────────

 documents ────────►  ① ARRIVAL ─────────────────────────► document registry
                          │  classify, dedup, date              (dedup check reads back)
                          ▼
 LLM API ──────────►  ② EXTRACTION ──────────────────────► candidate facts
                          │  raw text → typed facts             + confidence + as_of
                          ▼
 LLM API ──────────►  ③ RESOLUTION ◄─────────────────────► alias corpus
                          │  names → entity IDs                 (reads AND writes)
                          ▼
                      ④ GRAPH WRITE ────────────────────► entities + edges
                          │  append-only, with provenance       (never overwrite)
                          ▼
 market data ──────►  ⑤ TRAVERSAL & COMPUTE ◄───────────► thresholds
                          │  paths → exposures → ratios
                          ▼
                      ⑥ OUTCOME  ──────────────────────► findings, ratio, alerts
                          │
                          ▼
                      ⑦ FEEDBACK ───────────────────────► alias corpus, calibration
                             analyst confirms/corrects        (the compounding step)
```

---

## 2. Stage by stage

### ① ARRIVAL
**In (external):** a file — forwarded email attachment or drag-drop.
**Reads (internal):** document registry, to check whether this is a duplicate or a restatement.
**Does:** stores the original, classifies `doc_type`, extracts `as_of_date`, assigns a fuse
if it's a capital call notice.
**Out:** a `documents` row, status `pending`.

**Critical:** classify **capital call notice** separately from **statement**. A statement
updates your picture; a call notice starts a clock. Different urgency, different UX.

**Fails when:** duplicate re-send (dedup on content hash + as_of_date), scanned image with
no text layer (needs OCR), password-protected file, a format never seen before.
**Human:** none, unless classification confidence is low.

---

### ② EXTRACTION
**In (external):** the document text; the LLM API.
**Reads (internal):** the per-`doc_type` schema, plus any prior extraction from the *same
GP* — format memory means the second statement from Meridian is easier than the first.
**Does:** one structured-output LLM call per document → typed facts, each carrying
`as_of_date` and `confidence`. Emits unresolved entity name strings.
**Out:** candidate facts, not yet in the graph.

**Fails when:**
- A figure is hallucinated or transposed → **confidence score + human review queue**
- A second worksheet is missed (the Kestrel guarantee lives on Blackfin's sheet 2)
- Vocabulary drift: `"undrawn balance"` (Kestrel) vs `"remaining unfunded commitment"`
  (Meridian) are the same concept. **Map to canonical fields, never to raw labels.**

**Human:** reviews anything below the confidence floor.

---

### ③ RESOLUTION — the critical path
**In (external):** the LLM API.
**Reads (internal):** the alias corpus and existing entity nodes.
**Does:** one LLM call over all extracted names — *"which of these refer to the same
real-world entity?"* — resolved against known aliases first.
**Out:** entity IDs; new nodes; **new aliases written back**.

**This is where the product is won or lost.** Two failure modes, and they are *not*
symmetrical:

| Failure | Effect | Severity |
|---|---|---|
| **False split** — "Vertexa Software, Inc." ≠ "Vertexa Software Inc" | The finding silently disappears. You under-report risk | Bad |
| **False merge** — two genuinely different companies combined | You report a concentration that **doesn't exist**. Someone might act on it | **Worse** |

In a risk product a false positive that triggers a sale is more damaging than a missed
finding. **Require human confirmation for any merge above a materiality threshold.** Keep
a manual alias override as the permanent escape hatch.

---

### ④ GRAPH WRITE
**Does:** writes typed edges — `holds_equity`, `holds_debt`, `guarantees`,
`owns_property`, `manages` — each with `weight_pct`, `value`, `as_of_date`, `confidence`,
and `source_document_id`.
**Out:** an updated graph.

**Append, never overwrite.** A new statement doesn't replace the old edge, it adds a
newer-dated one. That gives you history, "what changed this quarter," and full provenance
back to a source document for every number on screen.

**Fails when:** the same holding is extracted twice from two documents → double counting.
**Enforce idempotency on `(source_document, entity, as_of_date)`.**

---

### ⑤ TRAVERSAL & COMPUTE
**In (external):** market prices, to shock the liquid book (static assumptions are fine
for the MVP).
**Reads (internal):** the graph, policy thresholds.
**Does:**

1. **Look-through exposure** — for each entity, sum over all inbound paths from the family
   office root: `Σ (Π edge weights) × leaf value`, **grouped by `edge_type`** so equity,
   debt and guarantee exposure to one company surface *together*. This is the whole bet.
2. **Concentration** — exposure vs thresholds, at company and counterparty level.
3. **Coverage ratio** — undrawn commitments vs liquid book, base and stressed, against
   Cambridge's 3× standard.
4. **Staleness** — days since each `as_of_date`; flag past the limit.

**Fails when:** double counting (see ④); circular guarantee paths (**cap traversal depth**);
mixing as-of dates silently (**always surface the date spread, never hide it**).

---

### ⑥ OUTCOME — what the product actually emits

Five things, and only five:

1. **The coverage ratio.** One number, always current. `0.92× vs 3.00× standard`.
2. **Ranked findings**, by severity — e.g. *"Aurex Data Centers: $2,459,000 across equity,
   unsecured debt, and a guarantee written by the fund you hold the equity through."*
3. **Change alerts** — fired when a threshold is *crossed*, not on every recompute. Alert
   on the transition, or you train people to ignore you.
4. **Provenance** — every figure links back to its source document and date. Non-negotiable
   in a risk tool: an unauditable number is worthless.
5. **The review queue** — low-confidence extractions and proposed merges awaiting a human.

---

### ⑦ FEEDBACK — where the moat forms
Analyst confirms, corrects, or rejects. Each action writes back to the alias corpus and
confidence calibration. **The system is measurably better on document #500 than on #5**,
and that improvement is per-GP and cross-client. This is the step that makes the corpus —
not the algorithm — the defensible asset.

---

## 3. Three clocks

The same pipeline runs on three different rhythms. Design for all three or the product
feels broken.

| Clock | Trigger | Path | User experience |
|---|---|---|---|
| **Quarterly** | Statements arrive in a batch, 45–75 days stale | Full pipeline, recompute everything | "Your picture has been updated. Three things changed." |
| **Event** | A **capital call notice** lands — 10 business day fuse | Fast path: update commitment, recompute coverage *immediately* | "This call takes you to 0.71×. Here's what you'd sell." |
| **Continuous** | Nothing arrives; markets move | Re-shock the liquid book only | **The ratio drifts with no document at all** |

> The third clock is the one people miss. **Your risk number changes when nothing lands in
> your inbox** — because the denominator moved. A system that only recalculates on document
> arrival is structurally blind between quarters, which is exactly when a drawdown happens.

---

## 4. Worked example — the Aurex finding, end to end

| Stage | What happens |
|---|---|
| ① | Two documents arrive from two counterparties: Kestrel LP report (as-of 31-Mar) and Blackfin loan schedule (as-of 30-Jun). Different senders, different formats, 91 days apart |
| ② | From Kestrel: equity holding, `"Aurex Data Centers, Inc."`, 15% of $3,060,000. Plus a prose "Sponsor Support" note about unsecured guarantees. From Blackfin **sheet 2**: loan BF-2025-002, $2,000,000, unsecured, *"guarantee from lead sponsor (Kestrel Ventures Fund III LP)"* |
| ③ | Resolver unifies `"Aurex Data Centers, Inc."` (Kestrel) with `"Aurex Data Centers, Inc."` (Blackfin) → one node. **And** resolves `"Kestrel Ventures Fund III LP"` in Blackfin's text to the *existing Kestrel fund node* |
| ④ | Three edges written: `holds_equity`(FO→Kestrel→Aurex), `holds_debt`(FO→Aurex, $2,000,000, unsecured), `guarantees`(Kestrel→Aurex debt) |
| ⑤ | Traversal groups all three by entity: total Aurex exposure **$2,459,000**. Then detects that the guarantor node is *itself* a node the family office holds equity in — correlated credit support |
| ⑥ | Finding emitted: *"$2,459,000 exposure to Aurex across two asset classes. The guarantee backing the unsecured $2M loan is written by Kestrel Ventures Fund III — the same fund you own the equity through. One credit event impairs the equity, leaves the loan unsecured, and weakens its only credit support."* Provenance: 2 documents, 3 extracted facts |
| ⑦ | Analyst confirms. `Kestrel Ventures Fund III LP` ↔ `Kestrel Ventures Fund III, L.P.` enters the alias corpus permanently |

**Note what was required:** two documents, from two counterparties, 91 days apart, one fact
buried on a second worksheet and one in a prose footnote — connected through a typed edge
that isn't a holding at all. No table produces this. No fund-layer look-through produces
this.

---

## 5. What is in scope by 5:00 PM

| Stage | MVP today | Deferred |
|---|---|---|
| ① Arrival | Drag-drop upload, 5 known archetypes | Email forwarding, OCR, arbitrary formats |
| ② Extraction | One LLM call per doc, confidence + as_of | Per-GP format memory, multi-page tables |
| ③ Resolution | One LLM call + manual override | Merge confirmation UI, materiality gating |
| ④ Graph write | Typed append-only edges | Full temporal history / diffing |
| ⑤ Compute | Look-through by edge_type, coverage vs 3×, staleness | Live market data (use static shocks) |
| ⑥ Outcome | Ratio, 3 findings, provenance links | Alerting, review queue UI |
| ⑦ Feedback | Manual alias override only | Calibration learning |

**Do not skip in the MVP:** `confidence` + `as_of_date` on every value (④), grouping
exposure by `edge_type` (⑤), and provenance links (⑥). Those three are what make it a risk
system rather than a demo.

---

## 6. External dependency failure

| Fails | Effect | Mitigation |
|---|---|---|
| LLM API down / rate-limited | No extraction | Queue docs as `pending`, retry; **pre-seeded fixtures mean the demo still runs** |
| Malformed / unreadable document | One doc fails | Fail that document, never the batch. Show it as `needs_review` |
| Market data unavailable | Can't stress the liquid book | Fall back to static shock assumptions (MVP does this anyway) |
| Supabase unreachable | Total outage | Out of scope for a one-day MVP — note it in the architecture summary |

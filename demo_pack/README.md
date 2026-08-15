# Demo Pack — Drag-In Ingestion Demonstration

Five **synthetic** statements for **Whitmore Family Office**, built to be dragged one at a
time into the live Exposure Graph app to prove ingestion works on real-looking documents —
not on the seeded `sample_data/` fixtures the graph already knows about.

These documents deliberately **cross-reference entities already present in the graph**
(Aurex Data Centers Inc., Vertexa Software Inc., Kestrel Ventures Fund III LP, Meridian
Growth Partners IV LP, Coastal Trust Bank, Calder Marine Terminals LLC, Ashworth Custody,
Nordvale Materials Ltd, Sunridge Logistics Corp, Halcyon Medical Devices LLC, 142 Harbor
View Terrace) so that uploading them should trigger entity resolution against existing
nodes, not just create five isolated new subgraphs.

Regenerate with:

```bash
python3 demo_pack/generate.py
```

(idempotent — safe to re-run; requires `reportlab` and `openpyxl`, both `pip3 install --user`)

---

## 1. `01_ridgeline_capital_VI_capital_statement.pdf`

PE capital account statement + schedule of investments.
**As-of 2026-06-30**, issued 2026-07-18. GP: Ridgeline Capital Management LLC.
Fund: Ridgeline Capital Partners VI, L.P. (vintage 2022, Growth Equity, North America).

| Field | Value |
|---|---|
| Commitment | $8,000,000 |
| Paid-in | $5,200,000 |
| Remaining Unfunded Commitment | $2,800,000 |
| Cumulative distributions | $340,000 |
| Reported NAV | $6,100,000 |
| Call notice | 10 business days |

Schedule of investments (% of fund NAV): **Aurex Data Centres, Inc. 14.0%** ($854,000) —
note the British spelling "Centres", a deliberate entity-resolution test against the
graph's existing "Aurex Data Centers Inc." node — **Vertexa Software Inc 11.0%**
($671,000), Brightline Energy Storage 9.0%, Cobalt Freight Systems 7.0%, twelve others 59.0%.

**Should cause the engine to derive:** a new fund-holding edge (Whitmore FO → Ridgeline
Capital Partners VI LP), plus look-through equity edges into Aurex Data Centers and
Vertexa Software — both of which should resolve to entities already in the graph, adding
a *third* source of Vertexa exposure and a *second* source of Aurex equity exposure
(compounding the existing single-company-concentration finding). Also contributes a new
undrawn-commitment figure ($2,800,000) to the liquidity-coverage calculation.

## 2. `02_calder_marine_equity_purchase_agreement.pdf`

Equity purchase / holding confirmation. **As-of / closing 2026-07-20**.
Counterparty/arranger: Ironvale Partners LLP.

Confirms Whitmore Family Office acquired a **40% membership interest in Calder Marine
Terminals, LLC** (note the comma — a spelling variant against the graph's existing
"Calder Marine Terminals LLC" node) for **$3,100,000**. Calder operates two bulk
marine terminals. The interest is illiquid — no established secondary market, ROFR held
by remaining members.

**Should cause the engine to derive:** a new direct-equity edge (Whitmore FO → Calder
Marine Terminals LLC, 40%, $3,100,000) that resolves to the existing Calder node despite
the punctuation difference, and a new illiquid-asset entry for liquidity-coverage
purposes (no offsetting near-term cash flow).

## 3. `03_ironvale_private_credit_schedule.xlsx`

Two worksheets. **As-of 2026-07-31**. Lender/manager: Ironvale Private Credit.

**Sheet 1 — "Loan Schedule":**

| Facility ID | Borrower | Principal Outstanding | Coupon | Maturity | Security | Covenant Status |
|---|---|---|---|---|---|---|
| IVP-2026-003 | Vertexa Software, Inc. | $2,400,000 | 12.50% | 2029-09-30 | Unsecured | Compliant |
| IVP-2025-021 | Brightline Energy Storage Inc. | $1,650,000 | 10.25% | 2028-06-30 | Senior Secured | Compliant |

**Sheet 2 — "Notes":** states that facility IVP-2026-003 is unsecured and ranks behind
secured creditors, **and** — only here, on the second worksheet, is where it lives —
that it carries a **sponsor guarantee provided by Ridgeline Capital Partners VI, L.P.**
covering the full outstanding principal.

**Should cause the engine to derive:** the headline finding for this pack — a direct
unsecured-debt edge into Vertexa Software ($2,400,000) whose only credit support is a
guarantee from Ridgeline Capital Partners VI, L.P., the *same fund* introduced in
document 1, which Whitmore already holds equity exposure to via the fund's own NAV and
(look-through) via its Vertexa position. This mirrors the existing Aurex-style
"your hedge is your own position" pattern, but now on Vertexa: equity in Vertexa (direct
via Ridgeline look-through), debt to Vertexa (direct loan), and the debt's guarantor is
the equity holder itself. A wrapper-level view of sheet 1 alone would show a clean
"unsecured but compliant" loan; only reading sheet 2 reveals the guarantee is circular.
This tests that the extractor visits every worksheet, not just the first.

## 4. `04_brightwater_custody_statement.xlsx`

Custody/brokerage statement — the liquid book. **As-of 2026-08-05**.
Custodian: Brightwater Trust Company. Account: Whitmore Family Office — Reserve Portfolio.

| Asset | Type | Market Value | Settlement / Liquidity |
|---|---|---|---|
| Cash & Money Market | Cash | $1,200,000 | T+0 |
| US Large Cap Equity Index | Public Equity | $2,400,000 | T+2 |
| Municipal Bond Ladder | Fixed Income | $900,000 | T+2 |
| **Total** | | **$4,500,000** | |

**Should cause the engine to derive:** a second liquid-book position (distinct from the
existing Ashworth Custody account) that feeds directly into the liquidity-coverage
calculation. Combined with Ashworth Custody's $4,200,000, Whitmore's total identifiable
liquid book becomes $8,700,000, against which the newly-added Ridgeline undrawn
commitment ($2,800,000) and any other outstanding calls should be tested for coverage.

## 5. `05_gladstone_industrial_appraisal.pdf`

Real estate appraisal summary. **As-of / effective date 2026-06-15**.
Appraiser: Harlow & Vance Appraisal Group.
Property: Gladstone Industrial Park, Units 4–9, Savannah, GA.
Owning entity: Gladstone Park Holdings LLC (100% Whitmore Family Office).

| Field | Value |
|---|---|
| Reconciled market value (as-is) | $9,800,000 |
| First mortgage (Coastal Trust Bank) | $5,200,000 o/s @ 6.10% fixed, matures 2032-08 |
| Net equity | $4,600,000 |
| Liquidity | Illiquid — 6–9 month marketing period |
| Prior appraisal on file | March 2025 |

**Should cause the engine to derive:** a new wholly-owned real estate node (Gladstone
Park Holdings LLC) with a mortgage liability edge to **Coastal Trust Bank** — resolving
to the same lender node already backing the 142 Harbor View Terrace mortgage in
`sample_data/`, producing a second, previously invisible single-lender concentration
(Coastal Trust Bank now secures two unrelated properties in the portfolio). The March
2025 → June 2026 appraisal gap (15 months) is a valuation-staleness signal consistent
with the existing Harbor View Terrace finding pattern.

---

## Vocabulary variation (deliberate, cross-document)

| Concept | Doc 1 (Ridgeline) | Doc 2 (Calder/Ironvale) | Doc 3 (Ironvale Credit) | Doc 4 (Brightwater) | Doc 5 (Gladstone) |
|---|---|---|---|---|---|
| Undrawn capital | "Remaining Unfunded Commitment" | — | — | — | — |
| Ownership stake | — | "Interest Acquired" / "Membership Interest" | — | — | — |
| Debt seniority | — | — | "Security" column: Unsecured / Senior Secured | — | — |
| Cash-equivalent standing | — | — | — | "Settlement / Liquidity" | — |
| Mortgage detail | — | — | — | — | "First Mortgage Outstanding" |

Each document also carries its own statement/report reference number, a page footer with
issuer name and page number, and a disclaimer paragraph in the house style of its
(fictional) issuer — plus a discreet italic footer line on every file stating it is
synthetic sample data for demonstration purposes only.

## Entity-resolution stress points (by design)

- **Aurex Data Centres, Inc.** (doc 1, British spelling) vs. **Aurex Data Centers Inc.**
  (existing graph node).
- **Calder Marine Terminals, LLC** (doc 2, comma before LLC) vs. **Calder Marine
  Terminals LLC** (existing graph node).
- **Vertexa Software, Inc.** (doc 3) vs. **Vertexa Software Inc** (doc 1) vs. **Vertexa
  Software, Inc.** (existing `sample_data` doc 1) / **Vertexa Software Inc** (existing
  `sample_data` doc 2) — three more spelling variants layered onto an already-tested
  entity-resolution case.
- **Ridgeline Capital Partners VI, L.P.** appears as both a fund (doc 1, NAV/equity) and
  a loan guarantor (doc 3, sheet 2 only) — the guarantee edge is only extractable if the
  ingestion pipeline reads every worksheet in a multi-sheet workbook, not just the first.
- **Coastal Trust Bank** (doc 5) resolves to the same lender already in `sample_data`
  behind 142 Harbor View Terrace.

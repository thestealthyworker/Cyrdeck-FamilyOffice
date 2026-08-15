# Sample Data — Gold Truth & Engineered Findings

Five **synthetic** fixtures standing in for the "bespoke reports" a single family office
receives. No organizer data pack exists for Track 3, so these were built to be
deliberately adversarial: five different formats, five different as-of dates, and three
pieces of **hidden structure** that a wrapper-level (spreadsheet) view cannot see.

Recipient entity throughout: **Whitmore Family Office** (fictional).

> These files are the test harness for the Exposure Graph. If the pipeline reproduces the
> three findings at the bottom of this document **from the documents alone** — not
> hardcoded — the MVP works.

---

## 1. `01_meridian_growth_IV_capital_statement.pdf`
PE capital account statement + schedule of investments. **As-of 2026-06-30** (issued Aug 12 — a 43-day reporting lag).

| Field | Gold value |
|---|---|
| Fund / GP | Meridian Growth Partners IV, L.P. / Meridian Capital Management LLC |
| Vintage / strategy / geography | 2019 / Growth Equity, Tech & Healthcare / North America |
| Total commitment | $10,000,000 |
| Paid-in capital (inception) | $7,850,000 |
| Cumulative distributions | $2,100,000 |
| Reported NAV | $9,420,000 |
| **Remaining unfunded commitment** | **$2,150,000** |
| Call notice period | **10 business days** |
| Default consequence | **Forfeiture of up to 100% of LP interest** (LPA §6.4) |

Schedule of investments (% of fund NAV): **Vertexa Software, Inc. 20.0%** ($1,880,000) ·
Lumen Health Systems 12.0% · Nimbus Robotics 9.0% · Ardent Bio Labs 8.0% · other 10 cos 51.0%

## 2. `02_kestrel_ventures_III_investor_report.pdf`
LP report — **deliberately different vocabulary and layout**. **As-of 2026-03-31** (delivered May 28).

Uses "Subscription / Commitment", "Drawn to date", "**Undrawn balance**", "Estimated Fair
Value of LP Interest" for the same concepts doc 1 calls "Total Commitment", "Paid-In
Capital", "Remaining Unfunded Commitment", "NAV". A naive extractor maps these wrong.

| Field | Gold value |
|---|---|
| Fund | Kestrel Ventures Fund III, L.P. (Delaware) |
| Vintage / strategy | 2021 / Early & Growth Stage Technology |
| Commitment | $6,000,000 |
| Drawn to date | $2,500,000 |
| **Undrawn balance** | **$3,500,000** |
| Distributions to date | $310,000 |
| Est. fair value of LP interest | $3,060,000 |
| Deployment period | Active through 2027; drawdowns **front-loaded into dislocations** |

Underlying positions: **Vertexa Software Inc 20.0%** ($612,000) ·
**Aurex Data Centers, Inc. 15.0%** ($459,000) · Polaris Freight AI 12.0% · 9 others 53.0%

## 3. `03_harbor_view_terrace_appraisal.pdf`
Real estate appraisal summary. **As-of 2026-05-15**.

| Field | Gold value |
|---|---|
| Property | 142 Harbor View Terrace, Miami, FL 33139 — 24-unit multifamily |
| Owning entity | 142 Harbor View Holdings LLC (100% Whitmore FO) |
| Reconciled market value (as-is) | $8,250,000 |
| Mortgage | Coastal Trust Bank — $4,000,000 o/s @ 5.75% fixed, matures 2031-03 |
| Net equity | $4,250,000 |
| Liquidity | Illiquid — 6–9 month marketing period |
| Prior appraisal on file | April 2024 (**valuation staleness signal**) |

## 4. `04_blackfin_private_credit_schedule.xlsx`
Direct lending schedule, 2 sheets ("Loan Schedule", "Notes"). **As-of 2026-06-30**.

| Loan ID | Borrower | Principal | Rate | Maturity | Status |
|---|---|---|---|---|---|
| BF-2023-011 | Sunridge Logistics Corp. | $3,200,000 | 10.5% | 2027-08-14 | Compliant |
| BF-2024-004 | Halcyon Medical Devices LLC | $1,750,000 | 11.5% | 2028-02-01 | Compliant |
| BF-2022-019 | Nordvale Materials Ltd. | $4,500,000 | 9.8% | 2026-11-30 | **Watch — DSCR 1.05x vs 1.20x** |
| BF-2025-002 | **Aurex Data Centers, Inc.** | $2,000,000 | 12.0% | 2029-01-15 | Compliant but **UNSECURED** |

The "Notes" sheet flags that BF-2025-002 is unsecured and would rank behind all secured
creditors in a downside — material to Finding 2, and only in the second sheet.

## 5. `05_ashworth_custody_liquid_account.xlsx`
Custody statement — **the liquid book**. **As-of 2026-07-31**. Without this the liquidity
collision is uncomputable.

| Asset | Type | Value | Liquidity |
|---|---|---|---|
| Cash & Money Market | Cash | $850,000 | T+0 |
| US Large Cap Equity Index | Public Equity | $1,950,000 | T+2 |
| Intl Developed Equity | Public Equity | $720,000 | T+2 |
| Investment Grade Bond Fund | Fixed Income | $680,000 | T+2 |
| **Total** | | **$4,200,000** | |

---

## The three engineered findings (verified by `check_math.py`)

Naive sum of everything: **$32,380,000** — a number that never existed at any single
moment, since the inputs span 2026-03-31 → 2026-07-31.

### Finding 1 — Hidden single-company concentration
**Vertexa Software** appears in docs 1 and 2, under two different name spellings, in two
different formats, with two different as-of dates.

- via Meridian IV: 20% × $9,420,000 = **$1,884,000**
- via Kestrel III: 20% × $3,060,000 = **$612,000**
- **Total: $2,496,000 — 20% of the entire private equity book** ($12,480,000), 7.7% of the
  whole portfolio.

Use the *PE-book denominator* in the demo. "Two diversified funds, 26 companies" → one
company is a fifth of the allocation.

### Finding 2 (THE HEADLINE) — Your hedge is your own position
**Aurex Data Centers** appears three times, in three roles, across three asset classes:

| Role | Where | Amount |
|---|---|---|
| Equity | inside Kestrel Ventures III (doc 2, 15% weight) | **$459,000** |
| Unsecured debt | Blackfin BF-2025-002 (doc 4) | **$2,000,000** |
| **Guarantee backing that debt** | **provided by Kestrel Ventures Fund III** — doc 4 sheet 2, corroborated by the "Sponsor Support" note in doc 2 | — |

**Total single-counterparty exposure: $2,459,000.**

The kicker: one credit event at Aurex impairs the equity, leaves the loan unsecured, **and
weakens the guarantee that was the loan's only credit support** — because the guarantor is
the same fund whose equity you own. The credit protection is your own position wearing a
different hat.

Conventional look-through is built for fund-of-funds / feeder structures and cannot
represent a direct loan and a fund holding as edges to the same node. This finding is only
computable if `guarantees` is a first-class edge type in the same graph as holdings.

**Extraction difficulty (this is the point):** the guarantee link is split across two
documents from two different counterparties, one of them on a *second worksheet*. The
extractor must find both; the resolver must connect them.

### Finding 3 — The liquidity collision
Undrawn commitments **$5,650,000** ($2.15M + $3.5M) vs liquid book **$4,200,000** →
base-case coverage **0.74×**.

Stress (equity −30%, IG −5%, calls accelerate to 65% of undrawn within 12mo,
distributions → 0):

- Liquid book → **$3,365,000**
- Calls due → **$3,672,500**
- Coverage **0.92×** → **shortfall $307,500**

**The asymmetry:** default on a call = forfeiture of up to 100% of the LP interest
(doc 1, LPA §6.4). A **$307,500** gap puts **$12,480,000** of NAV at risk — **40×**.

---

## Notes for the build
1. Test extraction against these gold values **before** wiring the dashboard.
2. Ship them as seed data in the repo so the demo is never empty; still do one live
   upload in the video.
3. Doc 2's vocabulary mismatch and the two Vertexa spellings are the entity-resolution
   test — if those fail, Findings 1 and 2 disappear.
4. If organizers release real data mid-event, prioritise it and keep these as fallback.

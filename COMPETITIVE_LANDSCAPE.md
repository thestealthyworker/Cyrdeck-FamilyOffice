# Track 3 — Problem Validation & Competitive Landscape

Research done 15 Aug 2026, before build. Two questions: **is the problem real**, and
**does the product already exist?** Answers: yes, and largely yes. Both matter for the
"investor due diligence readiness" judging criterion.

---

## 1. The problem is real and quantified

| Evidence | Source |
|---|---|
| **73%** of family offices cite private-market data as their single biggest technology challenge | Masttro |
| **75%** report internal expertise gaps in private-market analytics | Masttro |
| PE NAVs **lag 45–75 days** after quarter-end | Masttro |
| Most family offices still run PE administration **on spreadsheets across 20+ funds** | Masttro |
| PE has grown to **~21% of AUM**; alternatives ~45% of the average family office portfolio | Masttro |
| "No two fund managers format their notices the same way. Terminology varies, layouts differ" | Masttro |
| In a weakening market "the ratio of distributions to contributions will likely decline" — obligations rise exactly as funding sources fall | Cambridge Associates |
| Recommended buffer: **3× post-stress liquid assets to annual cash needs** | Cambridge Associates |
| Worst outcome is forced selling: "sell growth-focused assets during a drawdown to fund liquidity needs, undoing hard-earned portfolio outperformance" | Cambridge Associates |
| LP default penalties include penalty interest, forced sale at *lesser of* fair value or book value, compulsory redemption, forfeiture of prior contributions | Private Equity Wire / Masttro |
| **But: LP defaults are "relatively rare"** — harsh terms deter them | Private Equity Wire |

### What this changes in our pitch
- ✅ The **adverse correlation** claim is validated by Cambridge Associates — calls accelerate
  as distributions dry up. That was the core of Finding 3 and it holds.
- ✅ The **as-of-date incoherence** claim is validated — a documented 45–75 day NAV lag.
- ⚠️ **Soften the forfeiture framing.** Forfeiture is a real contractual risk but rarely
  realised. The *honest* primary cost is **forced selling at the bottom**, with forfeiture
  as the tail. Cambridge's language ("undoing hard-earned outperformance") is the better
  quote — and it survives a knowledgeable judge, where "you'll lose $12.5M" would not.
- ✅ Our fixture portfolio sits at **0.92× coverage under stress** against Cambridge's
  prescribed **3×**. That is a far stronger framing than an invented threshold: *the
  institutional standard is 3×, this portfolio is at 0.92×.*

---

## 2. The product substantially exists

| Vendor | Does | Doesn't (per public material) |
|---|---|---|
| **Aleta** — launched **15 May 2026**, 3 months ago | Capital call + distribution forecasting across funds/vintages, J-curve modelling, **bull/base/bear stress testing**, **evaluating impact of new commitments before allocating**, Takahashi-Alexander cash-flow model, automated ingestion of capital calls / K-1s / fund statements. Free to existing clients. | Company-level look-through not mentioned |
| **Masttro** | **Look-through reporting** — proportional allocation through fund layers, "interrogate exposure at the company level"; concentration flags by GP and vintage; capital call automation | Forward liquidity modelling / stress testing not addressed |
| **Canoe Intelligence** | Best-in-class alternative-asset document extraction | A pipe — feeds other systems, not a risk engine |
| **Addepar** | Multi-asset reporting & aggregation | Backward-looking; fund-level; priced for RIAs / MFOs |
| **Asora, Altoo, Asset Vantage, AlternativeSoft** | Various family office reporting / analytics | — |

**Blunt conclusion:** "nobody does this" is **false and must not be claimed**. Aleta ships
the liquidity forecasting *including the what-if-new-commitment screen*. Masttro ships the
look-through.

---

## 3. The seam that is actually still open

Three things survive the research:

1. **Look-through that crosses asset classes, not just fund layers.** Masttro's look-through
   is described for fund-of-funds and feeder structures — equity wrappers. Our **Finding 2**
   (Aurex Data Centers held as *fund equity* AND as a *direct unsecured loan*) requires
   treating a loan and a fund holding as two edges to the **same entity node**. Conventional
   models put those in different asset-class silos by construction. This is the least-covered
   claim we have.
2. **Nobody appears to connect the two.** Aleta forecasts cash. Masttro sees through funds.
   The insight that *your liquidity stress and your concentration are the same graph* — that
   the company you're doubled-up on is also the one whose fund is about to call capital —
   requires both, and no single vendor is publicly claiming both.
3. **Access, not capability.** Every one of these is a platform you migrate onto: enterprise
   pricing, onboarding, data migration. They sell to family offices that already have staff
   and budget. The 73%-with-a-data-problem and 75%-with-an-expertise-gap cohort is
   substantially the group that *cannot* buy them. **Forward an email, get an answer in 60
   seconds** is a different acquisition motion, not a different feature.

## 4. How to position at judging

Do **not** claim a green field. Say this instead:

> "Aleta shipped capital-call forecasting in May. Masttro does fund look-through. Neither
> connects them, neither crosses asset classes, and both require you to migrate onto a
> platform first. We answer the same question from an inbox — and we catch the exposure
> that sits in two different asset-class buckets, which a look-through built for feeder
> funds structurally cannot see."

That Aleta shipped this three months ago is **evidence the problem is urgent**, not evidence
we're too late. Someone funded a team to solve it. Knowing the landscape cold and naming the
seam precisely *is* due-diligence readiness — it beats a novelty claim a judge can puncture
in ten seconds.

---

## Sources
- Cambridge Associates — Liquidity Hazard Planning for Families of Wealth
  https://www.cambridgeassociates.com/insight/liquidity-hazard-planning-for-families-of-wealth/
- Masttro — Capital Call Processing for Family Offices
  https://masttro.com/insights/capital-call-processing-for-family-offices
- Masttro — Private Equity Portfolio Monitoring Software
  https://masttro.com/insights/private-equity-portfolio-monitoring-software
- Private Equity Wire — The consequences of LP defaults due to capital calls
  https://www.privateequitywire.co.uk/consequences-lp-defaults-due-capital-calls/
- Yahoo Finance — Aleta Launches Private Markets Forecasting Tool for Family Offices
  https://finance.yahoo.com/markets/stocks/articles/aleta-launches-private-markets-forecasting-144200418.html
- Asora — Unfunded Commitment glossary
  https://www.asora.com/glossary/unfunded-commitment

# VC Pitch Deck

`Cyrdeck_Exposure_Graph_VC_Deck.pptx` — 10 slides, 16:9. Regenerate with:

```bash
npm install --no-save pptxgenjs
node presentation/build_deck.js
```

The palette and typography are taken from the live product, so the deck and the application read as one thing: warm paper ground, ink and severity-red, Georgia against Calibri.

## Slides

| # | Slide | Purpose |
|---|---|---|
| 1 | Your hedge is your own position | The claim, and the $2,459,000 number that proves it |
| 2 | The risk isn't unknown, it's unaggregated | Problem sizing with cited industry figures |
| 3 | Obligations rise as funding dries up | The failure mode, benchmarked to Cambridge Associates' 3× standard |
| 4 | One company, three roles, three asset classes | The finding conventional reporting cannot produce |
| 5 | Forward the statements you already receive | Product and the ingestion loop |
| 6 | One typed edge table is the whole moat | Why incumbents can't retrofit this |
| 7 | We do not claim a green field | Honest competitive read |
| 8 | What it's worth to them — and to us | Value analysis: customer ROI and market model |
| 9 | Sold by inbox, not by migration | Business model and go-to-market |
| 10 | Built, deployed, ingesting | Status and ask |

## Where every number comes from

This matters more than the design. Figures fall into three classes, and the deck labels them:

**Computed by the live product** — $2,459,000 cross-asset-class exposure, $2,496,000 concentration, 0.92× stressed coverage, $307,500 shortfall, the 41× asymmetry, 14-second ingest. These are real outputs of the deployed application against the fixture portfolio, not illustrations.

**Cited third-party research** — 73% citing private-market data as their biggest technology challenge, 75% expertise gaps, 45–75 day NAV lag, 20+ funds on spreadsheets, alternatives at ~45% of portfolio (Masttro); the 3× post-stress liquidity standard and the forced-selling framing (Cambridge Associates). Full sources in [`../COMPETITIVE_LANDSCAPE.md`](../COMPETITIVE_LANDSCAPE.md).

**Our modelling assumptions, labelled as such** — firm counts (~8,000 single family offices, ~30,000 multi-family offices and RIAs with alternatives), ACV assumptions ($24k, $18k), and the resulting ~$1.7B addressable figure and $8–12M three-year SOM. The slide states these are assumptions and that firm counts need verification in diligence.

## Two things deliberately not in the deck

**No traction claims.** There are no customers, no revenue, no pipeline, because there are none. Slide 10 says what is built and what is next, and nothing more. A fabricated logo wall is the fastest way to lose a room.

**No novelty claim.** Slide 7 names Aleta and Masttro and says plainly what each already ships. Aleta launched in May 2026, which is evidence the problem is urgent and fundable — not evidence of being late. Claiming a green field invites a ten-second puncture from anyone who knows the space.

## The one soft number

The "~$2.5M preserved by avoiding one 20% forced drawdown" on slide 8 is an illustration, not a measurement — it applies a plausible drawdown to the $12,480,000 the product identifies as at risk. Present it as the shape of the argument, not a promise. The defensible half is the part the product computes: a $307,500 gap sitting against $12,480,000 of NAV.

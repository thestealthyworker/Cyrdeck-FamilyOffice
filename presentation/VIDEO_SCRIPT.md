# 60-Second Walkthrough — Recording Script

Lead with the finding, not the technology. Nobody funds a pipeline; they fund the thing the pipeline found.

**Live URL:** https://cyrdeck-familyoffice.vercel.app
**File to upload on camera:** `demo_pack/02_calder_marine_equity_purchase_agreement.pdf`

---

## Before you hit record

- [ ] **Verify Calder Marine is still debt-only.** This is the whole trick — the upload must create a *new* finding, not modify an existing one. Check: `curl -s https://cyrdeck-familyoffice.vercel.app/api/exposure | grep -o '"name":"Calder[^}]*edgeTypeCount":[0-9]'` — you want `1`. If it already reads `2`, someone has uploaded this file and you need a different one (see *If the state is wrong* below).
- [ ] Page loaded, scrolled to the top, hero fully rendered.
- [ ] `02_calder_marine_equity_purchase_agreement.pdf` visible in a Finder window positioned so you can drag it into the upload panel without hunting.
- [ ] Browser zoom ~110%, bookmarks bar hidden, no other tabs, notifications off.
- [ ] Record at 1440p or higher. The figures are the story; if they're not legible the video fails.

---

## Script

Total ≈ 156 words. At a natural 155 wpm that lands at ~60 seconds with no slack. Read it once against a timer before recording.

| Time | On screen | Voiceover |
|---|---|---|
| **0:00–0:07** | Hero, static. Let it breathe for a beat before speaking. | "A family office's risk isn't unknown. It's *unaggregated* — sitting in twenty documents that nobody reads together." |
| **0:07–0:20** | Slowly trace the three converging boxes, then the Aurex node. | "Aurex Data Centers appears three times here. Equity inside a fund. A two-million-dollar unsecured loan. And the guarantee behind that loan — written by the *same fund* that holds the equity. One credit event hits all three." |
| **0:20–0:32** | Scroll to the upload panel. Drag the Calder PDF in. **Cut the wait — see production notes.** | "None of that is hardcoded. Watch — I'll drop in a document the system has never seen. It extracts it, resolves the entities, and re-derives the whole graph." |
| **0:32–0:42** | New Calder finding visible in the findings list. Point at it. | "A new finding appears on its own. Calder Marine — we already lent to them, now we own equity too. Two asset classes, one counterparty." |
| **0:42–0:52** | Scroll to liquidity. Then click one source chip to open the real document. | "Stressed coverage is 0.92 times against Cambridge's 3× institutional standard. And every figure opens the statement it came from." |
| **0:52–1:00** | Back to hero, or hold on the open source document. | "Aleta forecasts your cash. Masttro sees through your funds. Neither crosses asset classes. This does — from documents you already receive." |

---

## Production notes

**The 14-second ingest is your biggest problem.** Extraction genuinely takes about 14 seconds, which is a quarter of your runtime spent watching a spinner. Do not narrate through it. Options, best first:

1. Record continuously, then **cut the dead time in post** — drop from the moment the file lands to the moment the finding appears. Honest, and it's what every product demo does.
2. **Speed-ramp** the wait to 2–3 seconds with the processing state visible, so viewers see it's real work rather than a cut.
3. If you must keep it real-time, fill it with the line about entity resolution — but that costs you the liquidity beat.

**Say "two-million-dollar", not "two million dollars"** when reading `$2,000,000` aloud — it scans faster and sounds deliberate.

**The word to hit is "same".** "Written by the *same fund* that holds the equity" is the entire pitch. Everything before it is setup; everything after is evidence. If you land one word in sixty seconds, land that one.

**Don't say "AI" or "LLM".** The extraction is table stakes. The finding is the product. Naming the model invites questions about accuracy that you don't need in a 60-second video.

---

## If you need a shorter cut

Drop the liquidity beat (0:42–0:52) and give the extra time to the upload. That takes you to ~130 words and roughly 52 seconds, which is safer if you tend to speed up on camera. The cost is losing the Cambridge 3× benchmark, which is your strongest external validation — so only trim it if timing is genuinely tight.

## If the state is wrong

If Calder already shows two edge types, someone uploaded that file. Use `demo_pack/01_ridgeline_capital_VI_capital_statement.pdf` instead and change the 0:32 line to:

> "A new fund lands, and it's holding two companies we already own elsewhere — the concentration deepens the moment the document arrives."

Or reset to the seeded five-document state first — ask before doing that, since it rewrites the live database.

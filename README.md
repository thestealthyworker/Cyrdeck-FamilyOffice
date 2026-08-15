# Cyrdeck-FamilyOffice

**Cross-asset-class exposure: the risk that lives between the silos.**

Built for the CybrDeck Hackathon — Track 3: Single Family Office.

## The problem

A family office's risk isn't unknown — it's **unaggregated**. Everything needed to understand it is already written down, just spread across twenty documents, twelve formats, and nine counterparties that nobody reads together. Most family offices still run private-market administration on spreadsheets across dozens of funds, while alternatives have grown to ~45% of the average portfolio. NAVs lag 45–75 days behind, so every number on file is stale and from a different date.

Full problem framing, sourcing, and the failure mode this produces: [`PLAN.md`](./PLAN.md).

## What this builds

You forward the statements you already receive, and the system maintains one live answer to *"what am I actually exposed to?"* Documents arrive → get extracted → get cross-checked against an **entity graph** → the risk number changes.

The headline claim: **look-through that crosses asset classes, not just fund layers.** Conventional look-through handles fund-of-funds and feeder structures — equity wrappers inside equity wrappers. It can't represent a direct loan and a fund holding as two edges to the *same entity*, because asset-class silos are load-bearing in those data models. That's the gap this fills — see the Aurex Data Centers finding in [`PLAN.md`](./PLAN.md#2-what-we-build-and-the-seam-we-own) for the concrete example (equity + unsecured loan + guarantee, all tracing back to one counterparty).

Competitive positioning against existing players (Aleta, Masttro) is in [`COMPETITIVE_LANDSCAPE.md`](./COMPETITIVE_LANDSCAPE.md).

## Architecture

```
Forward/upload → Extract → RESOLVE ENTITIES → Graph → Traverse → Findings
                                 ↑
                     this is the whole product
```

Next.js + TypeScript on Vercel · Supabase Postgres + Storage · LLM structured extraction.

Schema, the three load-bearing modeling decisions (typed edges, guarantees as first-class edges, mandatory `as_of_date` + `confidence`), and the entity-resolution approach are documented in [`PLAN.md`](./PLAN.md#3-architecture).

## Repo contents

| Path | What it is |
|---|---|
| [`PLAN.md`](./PLAN.md) | Full build plan: problem, architecture, schema, build timeline, demo script, risks |
| [`COMPETITIVE_LANDSCAPE.md`](./COMPETITIVE_LANDSCAPE.md) | Positioning against existing family-office tooling |
| [`WORKFLOW.md`](./WORKFLOW.md) / [`workflow.html`](./workflow.html) | Working process notes |
| [`sample_data/`](./sample_data) | Five synthetic fixture documents (five formats, five as-of dates) engineered to carry the demo findings, plus `DATA_DICTIONARY.md` (gold-truth values) and `check_math.py` (verification script) |
| [`exposure_graph_pitch.pptx`](./exposure_graph_pitch.pptx) | Pitch deck |
| [`images/`](./images) | Reference photos from the event |

## Status

Planning complete, build in progress. Declared simplifications for the hackathon scope (no auth, no multi-tenancy, single hardcoded family office, five fixture archetypes) are listed in [`PLAN.md`](./PLAN.md#4-build-plan--1029-am--500-pm-65h).

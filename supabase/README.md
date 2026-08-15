# Database

Postgres on Supabase. Migrations in `migrations/` are the source of truth for the schema and are applied in filename order.

| Migration | What it does |
|---|---|
| `0001_exposure_graph_core_schema.sql` | The five tables and the three load-bearing rules |
| `0002_documents_storage_bucket.sql` | Private bucket for uploaded source documents |
| `0003_alias_uniqueness_per_source_document.sql` | Fixes alias uniqueness to retain document provenance |
| `0004_rls_public_read_only.sql` | RLS: public read, writes require the service role |

## The three rules, and why they are enforced in the schema

1. **One typed `edges` table**, not one table per asset class. Equity holdings, debt positions, and guarantees are all edges between the same nodes. This is the architectural bet: it is what lets a single company surface across three asset classes at once, and it is what asset-class-siloed data models cannot retrofit cheaply.
2. **`guarantees` is a first-class `edge_type`**, not a text note on a loan record. The headline finding is only computable because a guarantee is an edge in the same graph as the holdings.
3. **`as_of_date` and `confidence` are `NOT NULL` on every value-bearing row.** A number without a date is a lie — the fixtures span 2026-03-31 to 2026-07-31, so a naive total describes a portfolio that never existed at any single moment. An LLM extraction without a confidence score is an unaudited claim.

## Seed data

The fixture graph is **not** checked in as a migration. It is applied separately, and its gold-truth values are documented in [`../sample_data/DATA_DICTIONARY.md`](../sample_data/DATA_DICTIONARY.md), which is the source of truth for every seeded number.

This is a declared limitation: cloning the repo and running the migrations gives you the schema, not the populated demo. Seeding it means replaying the values from `DATA_DICTIONARY.md`, or running the five fixture documents through the extraction pipeline, which is what the live demo does.

## Row-level security

RLS is enabled on all five tables with a public `select` policy and no insert, update, or delete policies. `PLAN.md` declares "no auth, no multi-tenancy, no RLS" as a hackathon simplification, and that remains true in the sense that there is no tenant model and no user accounts — but leaving writes open was never part of that trade. The publishable key ships in the client bundle of a public repository, so an anonymous visitor could otherwise have deleted the demo data. Writes go through the service role, which only exists as a server-side environment variable.

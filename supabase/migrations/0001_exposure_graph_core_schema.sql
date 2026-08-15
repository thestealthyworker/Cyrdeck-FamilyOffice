-- Cyrdeck Exposure Graph — core schema.
-- Three load-bearing rules, enforced here rather than by convention:
--   1. ONE typed edges table. Equity, debt, and guarantees are edges between the same
--      nodes, not separate per-asset-class tables. This is what makes cross-asset-class
--      look-through computable.
--   2. `guarantees` is a first-class edge type, never a text note on a loan.
--   3. Every extracted value carries as_of_date and confidence. NOT NULL, no exceptions:
--      a number without a date is a lie, and an unscored extraction is an unaudited claim.

create extension if not exists "pgcrypto";

create type doc_type as enum (
  'pe_capital_statement',
  'lp_investor_report',
  're_appraisal',
  'loan_schedule',
  'custody_statement',
  'other'
);

create type extraction_status as enum ('pending', 'processing', 'extracted', 'failed');

create type entity_type as enum (
  'fund', 'company', 'property', 'borrower', 'lender', 'account', 'family_office'
);

create type edge_type as enum (
  'holds_equity', 'holds_debt', 'guarantees', 'owns_property', 'manages'
);

create table documents (
  id                uuid primary key default gen_random_uuid(),
  storage_path      text not null,
  filename          text not null,
  doc_type          doc_type not null default 'other',
  as_of_date        date,
  counterparty      text,
  extraction_status extraction_status not null default 'pending',
  extraction_error  text,
  created_at        timestamptz not null default now()
);

-- Graph NODES.
create table entities (
  id             uuid primary key default gen_random_uuid(),
  canonical_name text not null,
  entity_type    entity_type not null,
  sector         text,
  geography      text,
  is_root        boolean not null default false,
  created_at     timestamptz not null default now()
);

-- Exactly one root: the family office itself. Exposure is summed over paths from here.
create unique index entities_single_root on entities (is_root) where is_root;
create index entities_canonical_name_idx on entities (lower(canonical_name));

-- The compounding asset: every raw spelling ever seen, mapped to its resolved entity.
-- "Vertexa Software, Inc." and "Vertexa Software Inc" must land on the same entity_id.
create table aliases (
  id                 uuid primary key default gen_random_uuid(),
  entity_id          uuid not null references entities (id) on delete cascade,
  raw_name           text not null,
  source_document_id uuid references documents (id) on delete set null,
  is_manual_override boolean not null default false,
  created_at         timestamptz not null default now()
);

create index aliases_raw_name_idx on aliases (lower(raw_name));

-- Graph EDGES. One table, typed — see rule 1.
create table edges (
  id                 uuid primary key default gen_random_uuid(),
  from_entity_id     uuid not null references entities (id) on delete cascade,
  to_entity_id       uuid not null references entities (id) on delete cascade,
  edge_type          edge_type not null,
  weight_pct         numeric(9, 6) check (weight_pct is null or (weight_pct >= 0 and weight_pct <= 1)),
  value              numeric(20, 2),
  currency           text not null default 'USD',
  as_of_date         date not null,
  confidence         numeric(4, 3) not null check (confidence >= 0 and confidence <= 1),
  source_document_id uuid references documents (id) on delete set null,
  source_note        text,
  created_at         timestamptz not null default now(),
  constraint edges_no_self_loop check (from_entity_id <> to_entity_id)
);

create index edges_from_idx on edges (from_entity_id);
create index edges_to_idx on edges (to_entity_id);
create index edges_type_idx on edges (edge_type);

-- Undrawn capital is the liquidity risk; it is not an edge, it is an obligation.
create table commitments (
  id                 uuid primary key default gen_random_uuid(),
  entity_id          uuid not null references entities (id) on delete cascade,
  total              numeric(20, 2) not null,
  drawn              numeric(20, 2) not null default 0,
  undrawn            numeric(20, 2) not null,
  distributions      numeric(20, 2) not null default 0,
  call_notice_days   integer,
  as_of_date         date not null,
  confidence         numeric(4, 3) not null check (confidence >= 0 and confidence <= 1),
  source_document_id uuid references documents (id) on delete set null,
  created_at         timestamptz not null default now()
);

create index commitments_entity_idx on commitments (entity_id);

comment on table edges is 'Typed graph edges. holds_equity/holds_debt/guarantees all live here so a single company can be reached across asset classes.';
comment on table aliases is 'Entity-resolution output. If this table is wrong, every downstream finding evaporates.';

-- The same spelling legitimately arrives from more than one counterparty
-- ("Aurex Data Centers, Inc." appears in both the Kestrel LP report and the Blackfin
-- schedule). Keying uniqueness on (entity_id, raw_name) alone threw that provenance away.
-- Drill-down needs to know which documents used which spelling, so the source document
-- is part of the key. NULLS NOT DISTINCT keeps manual overrides (no source doc) deduped.
alter table aliases drop constraint aliases_entity_id_raw_name_key;

alter table aliases
  add constraint aliases_entity_raw_name_source_key
  unique nulls not distinct (entity_id, raw_name, source_document_id);

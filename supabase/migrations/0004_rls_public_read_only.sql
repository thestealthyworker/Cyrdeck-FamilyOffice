-- PLAN.md declares "no auth, no multi-tenancy, no RLS" as a hackathon simplification.
-- That decision was about not building auth — it was not a decision to leave the demo
-- database writable by anyone. The publishable key ships in the client bundle of a public
-- repo, so without this an anonymous visitor could delete the seeded graph minutes before
-- judging. Reads stay open (the dashboard is meant to be public); writes require the
-- service role, which only ever exists as a server-side env var.

alter table documents   enable row level security;
alter table entities    enable row level security;
alter table aliases     enable row level security;
alter table edges       enable row level security;
alter table commitments enable row level security;

create policy "public read" on documents   for select using (true);
create policy "public read" on entities    for select using (true);
create policy "public read" on aliases     for select using (true);
create policy "public read" on edges       for select using (true);
create policy "public read" on commitments for select using (true);

-- No insert/update/delete policies: anon and authenticated cannot write.
-- service_role bypasses RLS entirely, so the extraction pipeline still writes normally.

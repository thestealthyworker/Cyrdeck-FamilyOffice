-- Private bucket for uploaded source documents. Every edge points back to a row in
-- `documents`, whose storage_path resolves here — that is the drill-down-to-source path
-- the dashboard needs so a finding can always be traced to the page it came from.
insert into storage.buckets (id, name, public, file_size_limit)
values ('documents', 'documents', false, 26214400)
on conflict (id) do nothing;

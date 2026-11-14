-- Web2App Studio — RLS hardening for the migration bookkeeping table.
-- The migration runner creates public.schema_migrations; keep it out of the
-- PostgREST-exposed surface by enabling RLS and revoking all browser access.

alter table if exists public.schema_migrations enable row level security;
revoke all on public.schema_migrations from anon, authenticated;
revoke all on public.schema_migrations from public;

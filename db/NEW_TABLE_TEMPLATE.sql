-- TEMPLATE — copy into every new public-table migration AFTER 2026-06-03.
--
-- Since 2026-06-03_data-api-opt-in.sql, new public tables are NOT exposed to
-- the Data API by default for ANY role (anon, authenticated, service_role).
-- A new table is invisible to PostgREST / supabase-js until you grant it here.
-- Forgetting the grant => PostgREST 42501 ("permission denied") at runtime.
--
-- This app's pattern: user data is reached server-side via service_role
-- (lib/supabase/admin.ts) behind cookie-validated API routes, and is locked
-- down with RLS (no anon/authenticated policy). Only public reference data
-- (like foods) is read client-side by anon.
--
-- Pick ONE of the two grant blocks below for your new table.

begin;

create table if not exists public.your_table (
  id          bigserial primary key,
  user_id     uuid not null references public.codes(id) on delete cascade,
  -- ... columns ...
  created_at  timestamptz not null default now()
);

-- --------------------------------------------------------------------
-- (A) USER DATA — server-only via service_role, locked down (DEFAULT choice).
-- --------------------------------------------------------------------
grant select, insert, update, delete on public.your_table to service_role;
grant usage, select on sequence public.your_table_id_seq to service_role;

alter table public.your_table enable row level security;
-- No anon/authenticated policy => RLS blocks them. All access via the API
-- routes using getSupabaseAdmin() (service_role bypasses RLS).

-- --------------------------------------------------------------------
-- (B) PUBLIC REFERENCE DATA read by the anon client (like foods). Use INSTEAD
--     of (A) only if the browser must read this table directly.
-- --------------------------------------------------------------------
-- grant select on public.your_table to anon, authenticated;
-- grant select, insert, update, delete on public.your_table to service_role;
-- grant usage, select on sequence public.your_table_id_seq to service_role;
--
-- alter table public.your_table enable row level security;
-- create policy your_table_select_anon on public.your_table
--   for select to anon, authenticated using (true);
-- -- writes: no anon/authenticated policy => service_role only.

commit;

-- Rollback:
-- begin;
-- drop table if exists public.your_table;
-- commit;

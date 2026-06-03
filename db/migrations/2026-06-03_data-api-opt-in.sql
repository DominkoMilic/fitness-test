-- Opt in NOW to the new Supabase Data API default (ahead of the 2026-10-30
-- enforcement onto existing projects). After this runs, NEW tables created by
-- the postgres role in the public schema are NOT exposed to the Data API
-- (PostgREST / GraphQL / supabase-js) until you add an explicit grant.
--
-- This makes behavior consistent TODAY instead of changing under you on
-- 2026-10-30. See:
--   https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically
--
-- IMPORTANT: the revoke covers all three roles — anon, authenticated AND
-- service_role. So after this, every new public table needs its own grant for
-- service_role too, or the server admin client (lib/supabase/admin.ts) will
-- get a PostgREST 42501 error on that table. Use db/NEW_TABLE_TEMPLATE.sql for
-- every new-table migration from now on.
--
-- Existing tables are UNAFFECTED (their grants are pinned by
-- 2026-06-03_explicit-grants.sql), so the running app does not change.
--
-- Idempotent: safe to re-run.
--
-- Run order: AFTER 2026-06-03_explicit-grants.sql.

begin;

alter default privileges for role postgres in schema public
  revoke select, insert, update, delete on tables from anon, authenticated, service_role;

alter default privileges for role postgres in schema public
  revoke usage, select on sequences from anon, authenticated, service_role;

commit;

-- ====================================================================
-- Rollback (restore old auto-expose behavior for new tables):
-- ====================================================================
-- begin;
-- alter default privileges for role postgres in schema public
--   grant select, insert, update, delete on tables to anon, authenticated, service_role;
-- alter default privileges for role postgres in schema public
--   grant usage, select on sequences to anon, authenticated, service_role;
-- commit;

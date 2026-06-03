-- Make Data API grants on EXISTING public tables explicit, ahead of the
-- Supabase "tables not auto-exposed" change (rolls onto existing projects
-- 2026-10-30). See:
--   https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically
--
-- WHY THIS IS SAFE / WHY IT CHANGES NOTHING:
--   The 2026-10-30 change only alters DEFAULT privileges for NEW tables.
--   Every table that already exists keeps the grants it has. This migration
--   simply RE-ASSERTS the original Supabase default grant set on the tables
--   that exist today, so the grants are pinned in version control instead of
--   relying on an implicit platform default. It is a no-op against the live
--   database (grants already present), purely defensive.
--
-- SECURITY IS UNCHANGED: real access control here is RLS, not grants. After
--   2026-05-12_full-lockdown-rls.sql, anon/authenticated have NO policy on the
--   user tables, so RLS blocks every row even though the table-level grant
--   exists. service_role bypasses RLS and reaches everything via the server
--   admin client (lib/supabase/admin.ts). anon's only real read path is foods
--   (foods_select_anon policy + lib/api/foods.ts).
--
-- Idempotent: GRANT is repeatable; safe to re-run.
--
-- Run order: this BEFORE 2026-06-03_data-api-opt-in.sql.

begin;

-- ====================================================================
-- Tables + views: pin the original anon/authenticated/service_role grants.
-- ALL TABLES covers all 7 tables + user_activity_view at once, so no new
-- table is ever missed. (INSERT/UPDATE/DELETE on the read-only view is a
-- harmless no-op grant.)
-- ====================================================================
grant select, insert, update, delete
  on all tables in schema public
  to anon, authenticated, service_role;

-- ====================================================================
-- Sequences: identity/bigserial PKs (foods, favorites, recipes,
-- daily_metrics). Needed by roles that INSERT. service_role does all
-- inserts server-side; anon/authenticated kept for parity with the old
-- default (RLS still blocks their writes).
-- ====================================================================
grant usage, select
  on all sequences in schema public
  to anon, authenticated, service_role;

commit;

-- ====================================================================
-- OPTIONAL hardening (NOT run here — would change behavior). If you want
-- table grants to mirror real usage instead of the legacy default, you could
-- revoke anon/authenticated writes and keep only what the app uses:
--   revoke insert, update, delete on public.food_logs, public.favorites,
--     public.recipes, public.search_history, public.daily_metrics,
--     public.codes from anon, authenticated;
--   revoke select on public.food_logs, public.favorites, public.recipes,
--     public.search_history, public.daily_metrics, public.codes
--     from anon, authenticated;
-- foods keeps anon/authenticated SELECT (public nutrition data). RLS already
-- enforces this, so the revokes are belt-and-suspenders, not required.
-- ====================================================================

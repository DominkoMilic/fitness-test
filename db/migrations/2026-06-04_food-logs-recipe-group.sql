-- Group recipe-derived food_logs rows so the dashboard can collapse the N
-- namirnice of one added recipe-portion into a single "1 sarma" card that
-- drills into a modal listing each food.
--
-- food_logs stays flat (one row per namirnica) so sumLogs / streaks / admin
-- views are unchanged. These nullable columns only mark which rows belong to
-- the same added recipe-portion. Non-recipe logs leave them NULL.
--
-- DATA API / GRANTS — why nothing extra is needed here:
--   The 2026-06-03 Data API opt-in only revokes DEFAULT privileges for NEW
--   tables (CREATE TABLE by postgres). This migration is ALTER TABLE ADD
--   COLUMN on an EXISTING table. In Postgres, table-level grants cover all
--   columns, including ones added later. public.food_logs already has the
--   service_role grant pinned by 2026-06-03_explicit-grants.sql, so the new
--   columns inherit it. NEW_TABLE_TEMPLATE's grant block is for new TABLES,
--   not new columns — not applicable here. All access stays server-side via
--   the cookie-guarded API routes (getSupabaseAdmin / service_role bypasses
--   RLS); RLS on food_logs is unchanged.

begin;

alter table public.food_logs
  add column if not exists group_id       uuid,
  add column if not exists group_name     text,
  add column if not exists group_portions numeric;

-- Fast lookup/aggregation of a single recipe group within a user's day.
create index if not exists idx_food_logs_group
  on public.food_logs using btree (user_id, group_id);

commit;

-- Force PostgREST to refresh its schema cache so the new columns are visible
-- through supabase-js immediately. Supabase's DDL event trigger normally does
-- this on its own; this NOTIFY is a harmless belt-and-suspenders in case the
-- cache is stale (otherwise reads/writes would 400 with "column not found").
notify pgrst, 'reload schema';

-- Rollback:
-- begin;
-- drop index if exists public.idx_food_logs_group;
-- alter table public.food_logs
--   drop column if exists group_id,
--   drop column if exists group_name,
--   drop column if exists group_portions;
-- commit;

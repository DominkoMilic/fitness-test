-- Full anon-write lockdown. After this migration runs, the anon Supabase
-- key can only read public food data; every user mutation must go through
-- the cookie-validated API routes (/api/me/*, /api/admin/*) which use the
-- service role server-side.
--
-- IMPORTANT: deploy the C2 code FIRST. Applying this migration before the
-- API routes exist will break the live app.
--
-- Reversible: rollback policies at the bottom in case of emergency.

begin;

-- ====================================================================
-- codes: deny anon SELECT + UPDATE (login + profile mutations via API)
-- ====================================================================
alter table public.codes enable row level security;

drop policy if exists codes_select_anon on public.codes;
drop policy if exists codes_select_all  on public.codes;
drop policy if exists codes_update_anon on public.codes;
drop policy if exists codes_update_all  on public.codes;
drop policy if exists codes_insert_anon on public.codes;
drop policy if exists codes_insert_all  on public.codes;
drop policy if exists codes_delete_anon on public.codes;
drop policy if exists codes_delete_all  on public.codes;
-- No anon policies → only service_role can touch the table.

-- ====================================================================
-- food_logs: deny anon all
-- ====================================================================
alter table public.food_logs enable row level security;

drop policy if exists food_logs_select_all on public.food_logs;
drop policy if exists food_logs_insert_all on public.food_logs;
drop policy if exists food_logs_update_all on public.food_logs;
drop policy if exists food_logs_delete_all on public.food_logs;
drop policy if exists food_logs_select_anon on public.food_logs;
drop policy if exists food_logs_insert_anon on public.food_logs;
drop policy if exists food_logs_update_anon on public.food_logs;
drop policy if exists food_logs_delete_anon on public.food_logs;

-- ====================================================================
-- favorites: deny anon all
-- ====================================================================
alter table public.favorites enable row level security;

drop policy if exists favorites_select_all on public.favorites;
drop policy if exists favorites_insert_all on public.favorites;
drop policy if exists favorites_update_all on public.favorites;
drop policy if exists favorites_delete_all on public.favorites;
drop policy if exists favorites_select_anon on public.favorites;
drop policy if exists favorites_insert_anon on public.favorites;
drop policy if exists favorites_update_anon on public.favorites;
drop policy if exists favorites_delete_anon on public.favorites;

-- ====================================================================
-- search_history: deny anon all
-- ====================================================================
alter table public.search_history enable row level security;

drop policy if exists search_history_select_all on public.search_history;
drop policy if exists search_history_insert_all on public.search_history;
drop policy if exists search_history_update_all on public.search_history;
drop policy if exists search_history_delete_all on public.search_history;
drop policy if exists search_history_select_anon on public.search_history;
drop policy if exists search_history_insert_anon on public.search_history;
drop policy if exists search_history_update_anon on public.search_history;
drop policy if exists search_history_delete_anon on public.search_history;

-- ====================================================================
-- foods: keep anon SELECT (public nutrition data), deny writes
-- ====================================================================
alter table public.foods enable row level security;

drop policy if exists foods_select_all on public.foods;
drop policy if exists foods_select_anon on public.foods;
drop policy if exists foods_insert_all on public.foods;
drop policy if exists foods_insert_anon on public.foods;
drop policy if exists foods_update_all on public.foods;
drop policy if exists foods_update_anon on public.foods;
drop policy if exists foods_delete_all on public.foods;
drop policy if exists foods_delete_anon on public.foods;

create policy foods_select_anon on public.foods
  for select
  to anon, authenticated
  using (true);

-- INSERT/UPDATE/DELETE: no anon policies → only service_role.

-- ====================================================================
-- bump_streak RPC: revoke from anon (now invoked via /api/me/streak +
-- /api/me/logs)
-- ====================================================================
revoke execute on function public.bump_streak(uuid) from anon;
revoke execute on function public.bump_streak(uuid) from authenticated;
grant execute on function public.bump_streak(uuid) to service_role;

commit;

-- ====================================================================
-- Emergency rollback (do NOT run unless reverting C2):
-- ====================================================================
-- begin;
-- create policy codes_select_all     on public.codes     for select to anon, authenticated using (true);
-- create policy codes_update_all     on public.codes     for update to anon, authenticated using (true) with check (true);
-- create policy food_logs_select_all on public.food_logs for select to anon, authenticated using (true);
-- create policy food_logs_insert_all on public.food_logs for insert to anon, authenticated with check (true);
-- create policy food_logs_update_all on public.food_logs for update to anon, authenticated using (true) with check (true);
-- create policy food_logs_delete_all on public.food_logs for delete to anon, authenticated using (true);
-- create policy favorites_select_all on public.favorites for select to anon, authenticated using (true);
-- create policy favorites_insert_all on public.favorites for insert to anon, authenticated with check (true);
-- create policy favorites_update_all on public.favorites for update to anon, authenticated using (true) with check (true);
-- create policy favorites_delete_all on public.favorites for delete to anon, authenticated using (true);
-- create policy search_history_select_all on public.search_history for select to anon, authenticated using (true);
-- create policy search_history_insert_all on public.search_history for insert to anon, authenticated with check (true);
-- create policy search_history_update_all on public.search_history for update to anon, authenticated using (true) with check (true);
-- create policy search_history_delete_all on public.search_history for delete to anon, authenticated using (true);
-- grant execute on function public.bump_streak(uuid) to anon;
-- commit;

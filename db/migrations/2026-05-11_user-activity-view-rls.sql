-- Lock down `user_activity_view`.
--
-- A bare CREATE VIEW in Postgres runs with the *owner's* privileges
-- (effectively SECURITY DEFINER). Supabase flags that as unrestricted
-- because the view bypasses RLS on the underlying `codes` table.
--
-- Fix:
--   1. Switch the view to `security_invoker = on` so it respects RLS of
--      the calling role (anon / authenticated).
--   2. Make sure RLS is enabled on `codes` with explicit policies so the
--      view's reads are governed by them.
--
-- Run after 2026-05-11_streak-tracking.sql.

begin;

-- 1) View respects caller's RLS, not the view owner's.
alter view public.user_activity_view set (security_invoker = on);

-- 2) Enforce RLS on the underlying table.
alter table public.codes enable row level security;

-- Idempotent: drop + recreate the four policies so the migration is
-- safe to re-run after edits.

drop policy if exists codes_select_all on public.codes;
drop policy if exists codes_insert_all on public.codes;
drop policy if exists codes_update_all on public.codes;
drop policy if exists codes_delete_all on public.codes;

-- App auth model is a shared client-side admin password gating writes
-- (Supabase anon key only) — see lib/utils/adminAuth.ts. There is no
-- per-user JWT, so policies cannot use auth.uid(). We keep them
-- permissive to match the existing app behaviour, but the policies
-- themselves are explicit so Supabase no longer flags the view.
--
-- If/when proper Supabase auth is introduced, tighten these to:
--   using (auth.uid() = id)
--   with check (auth.uid() = id)

create policy codes_select_all on public.codes
  for select
  to anon, authenticated
  using (true);

create policy codes_insert_all on public.codes
  for insert
  to anon, authenticated
  with check (true);

create policy codes_update_all on public.codes
  for update
  to anon, authenticated
  using (true)
  with check (true);

create policy codes_delete_all on public.codes
  for delete
  to anon, authenticated
  using (true);

commit;

-- Tighten RLS on `codes` so the anon key can no longer INSERT or DELETE.
-- Admin INSERT/DELETE go through API routes that use the service role and
-- validate an HMAC-signed admin session cookie.
--
-- SELECT and UPDATE remain open to anon because:
--   * SELECT — the public login flow reads `codes` by access code value to
--     resolve the AccessCodeRow.
--   * UPDATE — users update their own `goal` and `cookies_accepted_at`
--     directly via the anon client. Without per-user Supabase Auth there is
--     no auth.uid() to gate on. This is acceptable risk for now; full
--     hardening requires moving user mutations to API routes (scope C).
--
-- Run after 2026-05-11_user-activity-view-rls.sql.

begin;

alter table public.codes enable row level security;

drop policy if exists codes_select_all on public.codes;
drop policy if exists codes_insert_all on public.codes;
drop policy if exists codes_update_all on public.codes;
drop policy if exists codes_delete_all on public.codes;

-- SELECT: anon may read (login lookup). Admin uses service_role from API.
create policy codes_select_anon on public.codes
  for select
  to anon, authenticated
  using (true);

-- UPDATE: anon may update (user goal / cookie ack). Admin updates go via
-- service_role from API routes (PATCH /api/admin/codes/[code]).
create policy codes_update_anon on public.codes
  for update
  to anon, authenticated
  using (true)
  with check (true);

-- INSERT / DELETE: no anon policy. Only service_role (server-side, in
-- API routes) can insert or delete.
--
-- Postgres RLS denies by default when no policy matches the role/cmd, so
-- omitting INSERT/DELETE policies for anon is sufficient.

commit;

-- User Activity & Streak Tracking
-- ----------------------------------------------------------------
-- Adds upload streak columns to `codes` (acts as the user/profile table),
-- a SQL RPC that incrementally updates the streak on each upload, and a
-- read-only view exposing computed inactivity / activity status for admin UI.
--
-- Timezone: streak rollover is anchored to Europe/Zagreb so that the
-- "calendar day" matches the user's local day. Adjust the literal if the
-- application is later deployed to a different market.
--
-- Run after previous migrations (depends on `public.codes`).
-- ----------------------------------------------------------------

begin;

-- 1) Streak state columns on the user/profile table.
alter table public.codes
  add column if not exists current_streak    integer      not null default 0,
  add column if not exists last_upload_at    timestamptz  null,
  add column if not exists last_upload_date  date         null;

-- Useful for admin queries ordering by last activity.
create index if not exists idx_codes_last_upload_date
  on public.codes (last_upload_date);

-- 2) Incremental streak bump RPC.
--
-- Contract:
--   - Same calendar day (Europe/Zagreb)  → no-op, returns current streak.
--   - Yesterday's calendar day           → streak + 1.
--   - Older / never                      → streak resets to 1.
--
-- Always updates last_upload_at to NOW() so admins see the most recent
-- activity timestamp even on same-day uploads.
create or replace function public.bump_streak(p_user_id uuid)
returns table (current_streak integer, last_upload_date date)
language plpgsql
as $$
declare
  v_today  date := (now() at time zone 'Europe/Zagreb')::date;
  v_last   date;
  v_streak integer;
begin
  select c.last_upload_date, c.current_streak
    into v_last, v_streak
  from public.codes c
  where c.id = p_user_id
  for update;

  if not found then
    -- Unknown user: nothing to bump. Surface NULLs to caller.
    return query select null::integer, null::date;
    return;
  end if;

  if v_last = v_today then
    -- Already counted today, just refresh last_upload_at.
    update public.codes
      set last_upload_at = now()
      where id = p_user_id;
    return query select v_streak, v_last;
    return;
  elsif v_last = v_today - 1 then
    v_streak := coalesce(v_streak, 0) + 1;
  else
    v_streak := 1;
  end if;

  update public.codes
    set current_streak   = v_streak,
        last_upload_at   = now(),
        last_upload_date = v_today
    where id = p_user_id;

  return query select v_streak, v_today;
end;
$$;

-- Allow the anon/authenticated roles used by the app to invoke the RPC.
grant execute on function public.bump_streak(uuid) to anon, authenticated;

-- 3) Read-only admin view: computed inactivity + status.
create or replace view public.user_activity_view as
select
  c.id,
  c.code,
  c.name,
  c.exp,
  c.goal,
  c.current_streak,
  c.last_upload_at,
  c.last_upload_date,
  case
    when c.last_upload_date is null then null
    else greatest(
      0,
      ((now() at time zone 'Europe/Zagreb')::date - c.last_upload_date)
    )
  end                                          as inactivity_days,
  case
    when c.last_upload_date is null                                                                 then 'red'
    when ((now() at time zone 'Europe/Zagreb')::date - c.last_upload_date) >= 5                     then 'red'
    when ((now() at time zone 'Europe/Zagreb')::date - c.last_upload_date) >= 2                     then 'yellow'
    else 'active'
  end                                          as activity_status
from public.codes c;

grant select on public.user_activity_view to anon, authenticated;

commit;

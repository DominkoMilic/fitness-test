-- Expose `created_at` on user_activity_view.
--
-- Admin dashboard switched from activity-based sort to creation-time sort
-- (newest users first, oldest last). The view previously projected only
-- streak/activity fields, so created_at had to be added.
--
-- Run after 2026-05-13_strict-streak-view.sql.

begin;

create or replace view public.user_activity_view as
select
  c.id,
  c.code,
  c.name,
  c.exp,
  c.goal,
  case
    when c.last_upload_date = (now() at time zone 'Europe/Zagreb')::date
      then coalesce(c.current_streak, 0)
    else 0
  end                                          as current_streak,
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
    when c.last_upload_date is null                                              then 'red'
    when ((now() at time zone 'Europe/Zagreb')::date - c.last_upload_date) >= 5  then 'red'
    when ((now() at time zone 'Europe/Zagreb')::date - c.last_upload_date) >= 2  then 'yellow'
    else 'active'
  end                                          as activity_status,
  c.created_at                                 as created_at
from public.codes c;

alter view public.user_activity_view set (security_invoker = on);
grant select on public.user_activity_view to anon, authenticated;

commit;

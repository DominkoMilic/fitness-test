-- Tighten upload-streak display logic.
--
-- Previous behaviour: `codes.current_streak` is set by `bump_streak` and
-- left untouched between uploads. Admin view exposed it raw, so a user who
-- last uploaded on Thursday with streak=4 kept displaying "4" all the way
-- through Friday/Saturday until they uploaded again (when bump_streak
-- would correctly reset to 1 because the gap was >1 day).
--
-- New behaviour requested by the trainer:
--   * Streak alive only on the day the user uploaded.
--   * Missing today's upload (diff >= 1) → streak shows 0 in admin view.
--   * Reset to 1 happens automatically on the next upload via existing
--     `bump_streak` RPC, which already handles the gap correctly.
--
-- Net effect: the view computes the effective streak; the underlying
-- column keeps the "intent" value but is no longer surfaced directly.
-- Yellow/red inactivity thresholds unchanged.
--
-- Run after 2026-05-11_streak-tracking.sql and
-- 2026-05-11_user-activity-view-rls.sql.

begin;

create or replace view public.user_activity_view as
select
  c.id,
  c.code,
  c.name,
  c.exp,
  c.goal,
  -- Effective streak: drop to 0 the moment "today" passes without an upload.
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
  end                                          as activity_status
from public.codes c;

-- Re-apply security posture from 2026-05-11_user-activity-view-rls.sql
-- (create or replace doesn't preserve view options).
alter view public.user_activity_view set (security_invoker = on);
grant select on public.user_activity_view to anon, authenticated;

commit;

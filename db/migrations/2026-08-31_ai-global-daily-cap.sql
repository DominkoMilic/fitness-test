-- Global (all-users) daily ceiling on Gemini analyses.
--
-- Why, when ai_usage already caps 25/user/day: that cap bounds ONE user. With
-- several access codes — or one leaked code — the project-wide bill is still
-- unbounded, and Gemini spend is the only cost in this app that scales with
-- traffic. This is the circuit breaker: one number that cannot be exceeded in
-- a day no matter how many users or retries are involved.
--
-- Deliberately NOT refundable. A refundable global cap bounds successes rather
-- than spend, which is the exact hole this audit found in the per-user cap.
-- Every attempt that reaches Gemini counts here, forever.
--
-- Run in Supabase SQL editor. Safe to deploy before or after the route change:
-- the route treats a missing function as "no global cap" and keeps working.

begin;

create table if not exists public.ai_usage_global (
  date date primary key,
  count integer not null default 0
);

alter table public.ai_usage_global enable row level security;
-- No anon policies → service_role only, matching 2026-05-12_full-lockdown-rls.
grant all privileges on table public.ai_usage_global to service_role;

-- Atomic increment + read-back, same shape as bump_ai_usage.
create or replace function public.bump_global_ai_usage(p_date date)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  new_count integer;
begin
  insert into public.ai_usage_global (date, count)
  values (p_date, 1)
  on conflict (date)
  do update set count = public.ai_usage_global.count + 1
  returning count into new_count;
  return new_count;
end;
$$;

revoke execute on function public.bump_global_ai_usage(date) from anon;
revoke execute on function public.bump_global_ai_usage(date) from authenticated;
grant execute on function public.bump_global_ai_usage(date) to service_role;

commit;

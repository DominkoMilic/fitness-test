-- AI meal analyses (Gemini Vision) — saved results for later review, plus a
-- per-user daily usage counter for rate limiting the (paid) analyze endpoint.
-- Run in Supabase SQL editor. Deploy AFTER the API routes that use them.
--
-- RLS: full lockdown, matching 2026-05-12_full-lockdown-rls.sql — the anon
-- key gets NO policies, so only the service_role (used server-side by the
-- cookie-guarded /api/me/ai/* routes) can read or write these tables.

begin;

-- ====================================================================
-- ai_meal_analyses: one row per saved analysis
-- ====================================================================
create table if not exists public.ai_meal_analyses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.codes(id) on delete cascade,
  date date not null,
  meal text null,                 -- 'dorucak' | 'rucak' | 'vecera' | 'uzina'
  title text not null,
  items jsonb not null,           -- AiAnalysisItem[] (see types/app.ts)
  total_kcal numeric not null default 0,
  total_p numeric not null default 0,
  total_u numeric not null default 0,
  total_m numeric not null default 0,
  kcal_min integer null,          -- display range low  (e.g. 500)
  kcal_max integer null,          -- display range high (e.g. 700)
  confidence text not null default 'medium', -- 'low' | 'medium' | 'high'
  model text not null,            -- e.g. 'gemini-2.5-flash'
  created_at timestamptz not null default now()
);

create index if not exists idx_ai_meal_analyses_user_time
  on public.ai_meal_analyses (user_id, created_at desc);

alter table public.ai_meal_analyses enable row level security;

drop policy if exists ai_meal_analyses_select_anon on public.ai_meal_analyses;
drop policy if exists ai_meal_analyses_insert_anon on public.ai_meal_analyses;
drop policy if exists ai_meal_analyses_update_anon on public.ai_meal_analyses;
drop policy if exists ai_meal_analyses_delete_anon on public.ai_meal_analyses;
-- No anon policies → only service_role can touch the table.

-- Explicit table grants for service_role (used server-side by /api/me/ai/*).
-- Supabase usually auto-grants new public tables, but don't rely on it.
grant all privileges on table public.ai_meal_analyses to service_role;

-- ====================================================================
-- ai_usage: per-user, per-day analyze counter (rate limit)
-- ====================================================================
create table if not exists public.ai_usage (
  user_id uuid not null references public.codes(id) on delete cascade,
  date date not null,
  count integer not null default 0,
  primary key (user_id, date)
);

alter table public.ai_usage enable row level security;

drop policy if exists ai_usage_select_anon on public.ai_usage;
drop policy if exists ai_usage_insert_anon on public.ai_usage;
drop policy if exists ai_usage_update_anon on public.ai_usage;
drop policy if exists ai_usage_delete_anon on public.ai_usage;
-- No anon policies → only service_role.

grant all privileges on table public.ai_usage to service_role;

-- Atomic increment + read-back for the daily cap. Runs as service_role from
-- the API route; returns the NEW count after incrementing so the caller can
-- reject when it exceeds the limit.
create or replace function public.bump_ai_usage(p_user_id uuid, p_date date)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  new_count integer;
begin
  insert into public.ai_usage (user_id, date, count)
  values (p_user_id, p_date, 1)
  on conflict (user_id, date)
  do update set count = public.ai_usage.count + 1
  returning count into new_count;
  return new_count;
end;
$$;

revoke execute on function public.bump_ai_usage(uuid, date) from anon;
revoke execute on function public.bump_ai_usage(uuid, date) from authenticated;
grant execute on function public.bump_ai_usage(uuid, date) to service_role;

commit;

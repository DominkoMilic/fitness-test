-- Per-user daily activity metrics: weight + steps. Calories eaten are computed
-- on read from food_logs (no duplication). One row per (user_id, date).
--
-- RLS: same lockdown as favorites/recipes — no anon/authenticated policies,
-- mutations go through /api/me/daily-metrics (service role).

begin;

create table if not exists public.daily_metrics (
  id          bigserial primary key,
  user_id     uuid not null references public.codes(id) on delete cascade,
  date        date not null,
  weight_kg   numeric,
  steps       integer,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, date)
);

create index if not exists idx_daily_metrics_user_date
  on public.daily_metrics using btree (user_id, date desc);

alter table public.daily_metrics enable row level security;

drop policy if exists daily_metrics_select_all on public.daily_metrics;
drop policy if exists daily_metrics_insert_all on public.daily_metrics;
drop policy if exists daily_metrics_update_all on public.daily_metrics;
drop policy if exists daily_metrics_delete_all on public.daily_metrics;

commit;

-- Emergency rollback:
-- begin;
-- drop table if exists public.daily_metrics;
-- commit;

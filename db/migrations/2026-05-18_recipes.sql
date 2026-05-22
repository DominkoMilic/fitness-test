-- recipes table — like favorites but with people count (totals divided per person).
-- Mirrors favorites RLS lockdown: anon has no policies, all writes via API
-- routes using service role.

begin;

create table if not exists public.recipes (
  id          bigserial primary key,
  user_id     uuid not null references public.codes(id) on delete cascade,
  name        text not null,
  meal        text not null check (meal in ('dorucak','rucak','vecera','uzina')),
  people      integer not null default 1 check (people >= 1),
  items       jsonb not null default '[]'::jsonb,
  total_kcal  numeric not null default 0,
  total_p     numeric not null default 0,
  total_u     numeric not null default 0,
  total_m     numeric not null default 0,
  created_at  timestamptz not null default now()
);

create index if not exists idx_recipes_user_id      on public.recipes using btree (user_id);
create index if not exists idx_recipes_user_created on public.recipes using btree (user_id, created_at desc);

alter table public.recipes enable row level security;

-- No anon/authenticated policies — only service_role bypasses RLS.
drop policy if exists recipes_select_all on public.recipes;
drop policy if exists recipes_insert_all on public.recipes;
drop policy if exists recipes_update_all on public.recipes;
drop policy if exists recipes_delete_all on public.recipes;

commit;

-- Emergency rollback:
-- begin;
-- drop table if exists public.recipes;
-- commit;

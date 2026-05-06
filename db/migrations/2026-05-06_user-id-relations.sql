-- Migrate relation keys from code -> user_id for food_logs and favorites
-- Run in Supabase SQL editor (preferably on staging first).

begin;

-- 1) Add new relation columns
alter table public.food_logs add column if not exists user_id uuid;
alter table public.favorites add column if not exists user_id uuid;

-- 2) Backfill user_id from existing code text
-- 2a) Ensure referenced codes exist (handles historical/orphan logs/favorites)
insert into public.codes (code, name, exp, goal)
select missing.code, missing.code, (current_date + interval '10 years')::date, 1500
from (
  select distinct upper(trim(code)) as code
  from public.food_logs
  where code is not null and trim(code) <> ''
  union
  select distinct upper(trim(code)) as code
  from public.favorites
  where code is not null and trim(code) <> ''
) as missing
where not exists (
  select 1
  from public.codes c
  where upper(trim(c.code)) = missing.code
);

-- 2b) Backfill user_id from existing code text
update public.food_logs fl
set user_id = c.id
from public.codes c
where fl.user_id is null
  and upper(trim(fl.code)) = upper(trim(c.code));

update public.favorites f
set user_id = c.id
from public.codes c
where f.user_id is null
  and upper(trim(f.code)) = upper(trim(c.code));

-- 3) Ensure no orphaned rows remain before constraints
-- (optional strict guard; comment out if you prefer to inspect manually)
do $$
begin
  if exists (select 1 from public.food_logs where user_id is null) then
    raise exception 'food_logs has rows that could not be mapped to codes.id';
  end if;
  if exists (select 1 from public.favorites where user_id is null) then
    raise exception 'favorites has rows that could not be mapped to codes.id';
  end if;
end$$;

-- 4) Add foreign keys and indexes
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'food_logs_user_id_fkey'
      and conrelid = 'public.food_logs'::regclass
  ) then
    alter table public.food_logs
      add constraint food_logs_user_id_fkey
      foreign key (user_id) references public.codes(id)
      on delete cascade;
  end if;
end$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'favorites_user_id_fkey'
      and conrelid = 'public.favorites'::regclass
  ) then
    alter table public.favorites
      add constraint favorites_user_id_fkey
      foreign key (user_id) references public.codes(id)
      on delete cascade;
  end if;
end$$;

create index if not exists idx_food_logs_user_id on public.food_logs using btree (user_id);
create index if not exists idx_food_logs_user_date on public.food_logs using btree (user_id, date);
create index if not exists idx_favorites_user_id on public.favorites using btree (user_id);

-- 5) Set NOT NULL after successful backfill
alter table public.food_logs alter column user_id set not null;
alter table public.favorites alter column user_id set not null;

-- 6) Drop old code-based relation columns and indexes
drop index if exists public.idx_favorites_code;
alter table public.food_logs drop column if exists code;
alter table public.favorites drop column if exists code;

commit;

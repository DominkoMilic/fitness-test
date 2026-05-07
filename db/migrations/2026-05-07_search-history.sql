-- Per-user food search history (max 15 most recent).
-- Run in Supabase SQL editor.

begin;

create table if not exists public.search_history (
  user_id uuid not null references public.codes(id) on delete cascade,
  food_id bigint not null references public.foods(id) on delete cascade,
  last_searched_at timestamptz not null default now(),
  primary key (user_id, food_id)
);

create index if not exists idx_search_history_user_time
  on public.search_history (user_id, last_searched_at desc);

alter table public.search_history enable row level security;

drop policy if exists search_history_select_all on public.search_history;
drop policy if exists search_history_insert_all on public.search_history;
drop policy if exists search_history_update_all on public.search_history;
drop policy if exists search_history_delete_all on public.search_history;

create policy search_history_select_all on public.search_history
  for select to anon, authenticated using (true);
create policy search_history_insert_all on public.search_history
  for insert to anon, authenticated with check (true);
create policy search_history_update_all on public.search_history
  for update to anon, authenticated using (true) with check (true);
create policy search_history_delete_all on public.search_history
  for delete to anon, authenticated using (true);

-- Cap at 15 most recent per user. Runs after upsert; deletes overflow.
create or replace function public.trim_search_history()
returns trigger
language plpgsql
as $$
begin
  delete from public.search_history sh
  where sh.user_id = new.user_id
    and sh.food_id not in (
      select food_id
      from public.search_history
      where user_id = new.user_id
      order by last_searched_at desc
      limit 15
    );
  return null;
end;
$$;

drop trigger if exists trim_search_history_trg on public.search_history;
create trigger trim_search_history_trg
  after insert or update on public.search_history
  for each row execute function public.trim_search_history();

commit;

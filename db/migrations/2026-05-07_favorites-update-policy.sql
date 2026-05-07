-- Add UPDATE policy for favorites (was missing — silent 0-row updates).
-- Run in Supabase SQL editor.

begin;

alter table public.favorites enable row level security;

drop policy if exists favorites_update_all on public.favorites;

create policy favorites_update_all
  on public.favorites
  for update
  to anon, authenticated
  using (true)
  with check (true);

-- Safety net: ensure SELECT/INSERT/DELETE policies exist too,
-- consistent with anon-key + code-login model already in use.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'favorites' and cmd = 'SELECT'
  ) then
    create policy favorites_select_all
      on public.favorites for select
      to anon, authenticated
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'favorites' and cmd = 'INSERT'
  ) then
    create policy favorites_insert_all
      on public.favorites for insert
      to anon, authenticated
      with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'favorites' and cmd = 'DELETE'
  ) then
    create policy favorites_delete_all
      on public.favorites for delete
      to anon, authenticated
      using (true);
  end if;
end$$;

commit;

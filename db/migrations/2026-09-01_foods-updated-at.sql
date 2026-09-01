-- Make foods.updated_at actually mean "when this row last changed".
--
-- Today the column is `default now()` and NOTHING ever assigns it: there is no
-- trigger for it, and neither the sheet-sync apply route nor any other write
-- path sets it. So it advances on INSERT only, and every UPDATE (a nutrition
-- correction, a rename) leaves it untouched — which is why every sampled row
-- has updated_at exactly equal to created_at.
--
-- lib/api/foods.ts uses (max(updated_at), row count) as a version stamp to
-- decide whether a client's cached food list is still current. Without this
-- trigger an edited row moves neither half of that stamp, so clients would
-- keep serving pre-edit nutrition forever — strictly worse than the 2h TTL it
-- replaces. This migration is what makes the stamp correct.
--
-- Idempotent: safe to re-run.
--
-- Run order: BEFORE or WITH the deploy that ships the stamp check. Shipping
-- the client first is harmless — it just misses edits, exactly as today.

begin;

create or replace function public.foods_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end
$$;

drop trigger if exists trg_foods_touch_updated_at on public.foods;

-- BEFORE UPDATE on the whole row, deliberately NOT `update of <columns>`:
-- any change at all has to move the stamp, or clients keep a stale copy of
-- whichever column was left out of the list.
--
-- Fires alongside the existing trg_foods_clean_barcode and
-- trg_foods_set_normalized_name. Postgres runs BEFORE ROW triggers in name
-- order and these three touch disjoint columns, so ordering is irrelevant.
create trigger trg_foods_touch_updated_at
  before update on public.foods
  for each row
  execute function public.foods_touch_updated_at();

-- The stamp query is `where status = 'imported' order by updated_at desc
-- limit 1`. This turns it into a one-row index scan instead of a sort over
-- the whole table — worth it on a query that now runs whenever the app is
-- opened or resumed.
create index if not exists idx_foods_status_updated_at
  on public.foods (status, updated_at desc);

commit;

-- ====================================================================
-- Rollback:
-- ====================================================================
-- begin;
-- drop trigger if exists trg_foods_touch_updated_at on public.foods;
-- drop function if exists public.foods_touch_updated_at();
-- drop index if exists idx_foods_status_updated_at;
-- commit;

-- Replace single `has_extra_units` flag with two columns:
--   has_cup     — Sheet column "Šalica"  → Da exposes 1 šalica (200 g)
--   has_spoons  — Sheet column "Žlice"   → Da exposes 1 jušna žlica (16 g)
--                                                     and 1 čajna žlica  (6 g)
--
-- Granularity matters: not every food where cup makes sense also makes
-- sense in spoons, so the admin can toggle them independently from the
-- sheet.
--
-- Idempotent + reversible. Drops the old column at the end after the new
-- ones exist.

begin;

alter table public.foods
  add column if not exists has_cup boolean not null default false;

alter table public.foods
  add column if not exists has_spoons boolean not null default false;

-- Backfill from the (about to be dropped) `has_extra_units` so any food
-- previously marked as supporting cups+spoons keeps both. Skip silently if
-- the legacy column was never added.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'foods'
      and column_name = 'has_extra_units'
  ) then
    update public.foods
       set has_cup    = coalesce(has_extra_units, false),
           has_spoons = coalesce(has_extra_units, false)
     where has_extra_units = true;
    alter table public.foods drop column has_extra_units;
  end if;
end$$;

commit;

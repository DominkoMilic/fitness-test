-- Adds `barcode` to public.foods so admin-curated foods can be matched
-- by EAN/UPC scans before falling back to Open Food Facts.
--
-- Storage rule: digits-only string (EAN-8, UPC-A → EAN-13 promoted by the
-- TS normalizer in lib/barcode/normalize.ts, EAN-13, ITF-14). NULL means
-- "no barcode for this food". Empty string is normalized to NULL so the
-- unique index never sees blanks.
--
-- Index: partial unique to prevent two foods claiming the same scan code,
-- while still allowing many rows with NULL barcode.
--
-- Idempotent.

begin;

alter table public.foods
  add column if not exists barcode text;

-- DB-side guard: keep barcode digit-only and coerce blanks → NULL even
-- when written outside the app (Studio, psql, direct sheet sync error).
create or replace function public.foods_clean_barcode()
returns trigger
language plpgsql
as $$
declare
  cleaned text;
begin
  if new.barcode is null then
    return new;
  end if;
  cleaned := regexp_replace(new.barcode, '[^0-9]', '', 'g');
  -- Promote 12-digit UPC-A → 13-digit EAN-13 to match TS normalizer.
  if char_length(cleaned) = 12 then
    cleaned := '0' || cleaned;
  end if;
  if cleaned = '' then
    new.barcode := null;
  else
    new.barcode := cleaned;
  end if;
  return new;
end
$$;

drop trigger if exists trg_foods_clean_barcode on public.foods;

create trigger trg_foods_clean_barcode
before insert or update of barcode on public.foods
for each row
execute function public.foods_clean_barcode();

-- Clean any pre-existing free-text barcodes.
update public.foods
   set barcode = barcode
 where barcode is not null;

create unique index if not exists ux_foods_barcode
  on public.foods (barcode)
  where barcode is not null;

commit;

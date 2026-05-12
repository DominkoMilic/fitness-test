-- Add `has_extra_units` flag to foods. When true, the AddFoodModal exposes
-- universal volume units in addition to grams and (optional) pieces:
--   Šalica         = 200 g
--   Jušna žlica    =  16 g
--   Čajna žlica    =   6 g
--
-- Sheet column header: `Dodatne količine` (also matches non-diacritic
-- variants). Accepted values: case-insensitive `Da` → true; anything else
-- (`Ne`, empty, etc.) → false.

begin;

alter table public.foods
  add column if not exists has_extra_units boolean not null default false;

commit;

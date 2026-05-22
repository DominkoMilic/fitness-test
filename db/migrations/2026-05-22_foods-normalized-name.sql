-- Adds `normalized_name` to public.foods for diacritic-insensitive fuzzy
-- search (lowercase, NFD-stripped, đ→d, trimmed, single-spaced).
--
-- Source of truth lives in TS (lib/utils/normalize.ts). DB trigger here
-- keeps the column in sync defensively for direct SQL writes / Supabase
-- studio edits. Application code also sets it explicitly (belt + braces).
--
-- Index: GIN trigram for partial-substring filtering BEFORE Fuse ranks.
-- Falls back to plain btree if pg_trgm is unavailable.
--
-- Idempotent.

begin;

create extension if not exists pg_trgm;
create extension if not exists unaccent;

alter table public.foods
  add column if not exists normalized_name text;

-- Plain-SQL normalizer matching lib/utils/normalize.ts. Marked IMMUTABLE
-- so it can be used in functional indexes and triggers cheaply.
create or replace function public.kf_normalize_name(input text)
returns text
language sql
immutable
as $$
  select case
    when input is null then ''
    else regexp_replace(
      btrim(
        lower(
          translate(
            unaccent(input),
            'đĐ',
            'dd'
          )
        )
      ),
      '\s+',
      ' ',
      'g'
    )
  end
$$;

-- Backfill any pre-existing rows. Cheap on ~1k–10k rows; for larger sets
-- run scripts/backfill-normalized-names.ts instead (batched + logged).
update public.foods
   set normalized_name = public.kf_normalize_name(name)
 where normalized_name is null
    or normalized_name <> public.kf_normalize_name(name);

alter table public.foods
  alter column normalized_name set not null;

alter table public.foods
  alter column normalized_name set default '';

-- Auto-maintain on INSERT/UPDATE so direct DB writes (Studio, psql, future
-- services) cannot drift from `name`.
create or replace function public.foods_set_normalized_name()
returns trigger
language plpgsql
as $$
begin
  new.normalized_name := public.kf_normalize_name(new.name);
  return new;
end
$$;

drop trigger if exists trg_foods_set_normalized_name on public.foods;

create trigger trg_foods_set_normalized_name
before insert or update of name on public.foods
for each row
execute function public.foods_set_normalized_name();

-- Trigram GIN for fast LIKE/ILIKE prefilter at scale (>10k rows). Fuse
-- still does final ranking client-side.
create index if not exists idx_foods_normalized_name_trgm
  on public.foods using gin (normalized_name gin_trgm_ops);

commit;

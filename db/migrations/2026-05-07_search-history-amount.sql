-- Store last grams/pieces per (user, food) so + button on history can re-add
-- with the same amount used previously.
-- Run after 2026-05-07_search-history.sql.

begin;

alter table public.search_history
  add column if not exists grams numeric not null default 100,
  add column if not exists pieces numeric null;

commit;

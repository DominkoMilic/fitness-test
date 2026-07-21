-- Mark AI-assisted entries in the food diary.
-- Run AFTER 2026-07-21_ai-meal-analyses.sql (references ai_meal_analyses).
--
-- food_logs RLS is already locked down (2026-05-12_full-lockdown-rls.sql):
-- only service_role writes, via the cookie-guarded /api/me/logs routes. No
-- new policies needed here.

begin;

-- 'manual' (default, existing rows) | 'ai'
alter table public.food_logs
  add column if not exists source text not null default 'manual';

-- Optional back-link to the saved analysis this row came from. NULL for
-- ordinary manual/barcode/recipe entries. ON DELETE SET NULL so deleting an
-- analysis never removes the user's diary entry.
alter table public.food_logs
  add column if not exists ai_analysis_id uuid null
    references public.ai_meal_analyses(id) on delete set null;

commit;

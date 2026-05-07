-- Track timestamp at which the user acknowledged the cookie banner.
-- App uses essential-only cookies, so consent is informational, not strictly
-- required under GDPR; this column lets us prove the user saw the banner.
-- Run in Supabase SQL editor.

begin;

alter table public.codes
  add column if not exists cookies_accepted_at timestamptz null;

commit;

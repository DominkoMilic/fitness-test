-- Refund a daily AI-analysis credit.
--
-- The analyze route RESERVES a credit up front (bump_ai_usage) so concurrent
-- requests can't race past the cap, then refunds it when Gemini never actually
-- answered — upstream outage, timeout, or a failure on our side. Charging a
-- user for our own failure burns their daily allowance for nothing.
--
-- Deliberately NOT refunded: off-topic / non-food results. Gemini answered and
-- the call was paid for; the user got a real (if unwelcome) answer.
--
-- Run in Supabase SQL editor. Deploy BEFORE the route change that calls it.

begin;

create or replace function public.refund_ai_usage(p_user_id uuid, p_date date)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  new_count integer;
begin
  -- greatest(...,0) keeps a double-refund (retry, duplicate error path) from
  -- driving the counter negative and handing out free credits.
  update public.ai_usage
     set count = greatest(public.ai_usage.count - 1, 0)
   where user_id = p_user_id
     and date = p_date
  returning count into new_count;

  return coalesce(new_count, 0);
end;
$$;

revoke execute on function public.refund_ai_usage(uuid, date) from anon;
revoke execute on function public.refund_ai_usage(uuid, date) from authenticated;
grant execute on function public.refund_ai_usage(uuid, date) to service_role;

commit;

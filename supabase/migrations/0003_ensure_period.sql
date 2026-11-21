-- Period renewal, atomically.
--
-- renew_period(start, end) creates the signed-in user's budget period for
-- [start, end] by copying income, savings and allocations from their latest
-- period that starts before it, and opens a 'waiting' savings prompt when the
-- period saves anything. The dates are worked out by the caller
-- (src/lib/data/ensurePeriod.ts, from src/lib/calc), not here.
--
-- One transaction, so a period never exists without its allocations. Two
-- concurrent calls for the same start: the second insert waits on the
-- (user_id, start_date) unique index until the first commits, then does
-- nothing and returns the committed row.
--
-- Returns null when the user has no earlier period (never onboarded).
--
-- security invoker: runs as the caller, so RLS on every table applies.

create function public.renew_period(p_start date, p_end date)
returns public.budget_periods
language plpgsql
security invoker
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  source public.budget_periods;
  created public.budget_periods;
begin
  if uid is null then
    raise exception 'renew_period: not signed in' using errcode = '42501';
  end if;

  select * into source
  from public.budget_periods
  where user_id = uid and start_date < p_start
  order by start_date desc
  limit 1;

  if not found then
    return null;
  end if;

  if p_start <= source.end_date or p_end < p_start then
    raise exception 'renew_period: % to % overlaps the period ending %', p_start, p_end, source.end_date
      using errcode = '22023';
  end if;

  insert into public.budget_periods (user_id, start_date, end_date, income_pence, savings_pence)
  values (uid, p_start, p_end, source.income_pence, source.savings_pence)
  on conflict (user_id, start_date) do nothing
  returning * into created;

  if created.id is null then
    -- Already renewed (possibly by a concurrent call that has now committed).
    select * into created from public.budget_periods where user_id = uid and start_date = p_start;
    return created;
  end if;

  insert into public.allocations (user_id, period_id, category_id, amount_pence)
  select uid, created.id, a.category_id, a.amount_pence
  from public.allocations a
  where a.user_id = uid and a.period_id = source.id;

  if created.savings_pence > 0 then
    insert into public.savings_prompts (user_id, period_id, status)
    values (uid, created.id, 'waiting');
  end if;

  return created;
end;
$$;

revoke execute on function public.renew_period(date, date) from public, anon;
grant execute on function public.renew_period(date, date) to authenticated;

-- Onboarding, atomically.
--
-- complete_onboarding(...) saves the signed-in user's whole first budget in one
-- transaction: the profile's start day, the first period, its categories and
-- allocations, the savings funds (opening balance = money already saved) and,
-- when the period saves anything, a 'waiting' savings prompt whose split maps
-- each fund's id to its amount in pence. The period's dates are worked out by
-- the caller (src/lib/data/onboarding.ts, from src/lib/calc), not here, and
-- the caller validates the input first; this re-checks what keeps the data
-- consistent when the function is called directly (array shapes and sizes,
-- amounts, period dates matching the start day, the savings split). Name
-- lengths and money bounds are table check constraints (0001).
--
-- Refuses (SQLSTATE PT409, HTTP 409) when the user already has a budget
-- period, so a repeated or concurrent submit creates nothing more: the profile
-- row is locked first, so a concurrent call waits, then sees the period.
--
-- security invoker: runs as the caller, so RLS on every table applies.
--
-- p_categories: [{"name": text, "kind": "need" | "want", "amount_pence": int}]
-- p_funds:      [{"name": text, "amount_pence": int, "already_saved_pence": int}]

create function public.complete_onboarding(
  p_start_day int,
  p_start date,
  p_end date,
  p_income_pence bigint,
  p_savings_pence bigint,
  p_categories jsonb,
  p_funds jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  v_period_id uuid;
  v_split jsonb;
begin
  if uid is null then
    raise exception 'complete_onboarding: not signed in' using errcode = '42501';
  end if;

  -- Serialise this user's onboarding calls.
  perform 1 from public.profiles where user_id = uid for update;
  if not found then
    raise exception 'complete_onboarding: no profile' using errcode = '42501';
  end if;

  if exists (select 1 from public.budget_periods where user_id = uid) then
    raise exception 'complete_onboarding: already has a budget' using errcode = 'PT409';
  end if;

  if coalesce(jsonb_typeof(p_categories), '') <> 'array' or coalesce(jsonb_typeof(p_funds), '') <> 'array'
     or jsonb_array_length(p_categories) not between 1 and 50 or jsonb_array_length(p_funds) > 20 then
    raise exception 'complete_onboarding: 1 to 50 categories and at most 20 funds, as arrays'
      using errcode = '22023';
  end if;

  if exists (select 1 from jsonb_to_recordset(p_categories) as c (amount_pence bigint)
             where c.amount_pence is null or c.amount_pence <= 0)
     or exists (select 1 from jsonb_to_recordset(p_funds) as f (amount_pence bigint, already_saved_pence bigint)
                where f.amount_pence is null or f.amount_pence < 0
                   or f.already_saved_pence is null or f.already_saved_pence < 0) then
    raise exception 'complete_onboarding: category amounts must be positive, fund amounts zero or more'
      using errcode = '22023';
  end if;

  -- The period must be the one the start day gives: it starts on that day
  -- (or the month's last day, for 29-31 in a shorter month).
  if p_start is null or p_end is null or p_end < p_start
     or extract(day from p_start) <> least(
          p_start_day,
          extract(day from (date_trunc('month', p_start) + interval '1 month - 1 day'))::int) then
    raise exception 'complete_onboarding: % to % is not a period for start day %', p_start, p_end, p_start_day
      using errcode = '22023';
  end if;

  if p_savings_pence is distinct from coalesce(
       (select sum(f.amount_pence) from jsonb_to_recordset(p_funds) as f (amount_pence bigint)), 0) then
    raise exception 'complete_onboarding: fund amounts must add up to the savings' using errcode = '22023';
  end if;

  -- Funds have no unique name in the schema; the split below matches them by name.
  if (select count(*) <> count(distinct lower(btrim(f.name)))
      from jsonb_to_recordset(p_funds) as f (name text)) then
    raise exception 'complete_onboarding: fund names must be unique' using errcode = '22023';
  end if;

  update public.profiles set budget_start_day = p_start_day where user_id = uid;

  insert into public.budget_periods (user_id, start_date, end_date, income_pence, savings_pence)
  values (uid, p_start, p_end, p_income_pence, p_savings_pence)
  returning id into v_period_id;

  with input as (
    select c.name, c.kind, c.amount_pence
    from jsonb_to_recordset(p_categories) as c (name text, kind text, amount_pence bigint)
  ),
  created as (
    insert into public.categories (user_id, name, kind)
    select uid, name, kind from input
    returning id, name
  )
  insert into public.allocations (user_id, period_id, category_id, amount_pence)
  select uid, v_period_id, created.id, input.amount_pence
  from created join input using (name);

  with input as (
    select f.name, f.amount_pence, f.already_saved_pence
    from jsonb_to_recordset(p_funds) as f (name text, amount_pence bigint, already_saved_pence bigint)
  ),
  created as (
    insert into public.funds (user_id, name, opening_pence)
    select uid, name, already_saved_pence from input
    returning id, name
  )
  select coalesce(jsonb_object_agg(created.id, input.amount_pence) filter (where input.amount_pence > 0), '{}')
  into v_split
  from created join input using (name);

  if p_savings_pence > 0 then
    insert into public.savings_prompts (user_id, period_id, status, split)
    values (uid, v_period_id, 'waiting', v_split);
  end if;

  return v_period_id;
end;
$$;

revoke execute on function public.complete_onboarding(int, date, date, bigint, bigint, jsonb, jsonb) from public, anon;
grant execute on function public.complete_onboarding(int, date, date, bigint, bigint, jsonb, jsonb) to authenticated;

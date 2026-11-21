-- Period-end review: what happens to an ended period's leftover, atomically.
--
-- record_leftover(period, today, amount, destination, fund, new fund name)
-- records the review of one ended budget period. The leftover is one whole
-- amount (spec §5.9) worked out by the caller (src/lib/data/review.ts, from
-- src/lib/calc); this function checks it against the stored figures and
-- refuses it when they differ, so a figure from the browser can never be
-- recorded. Destinations:
--   fund          a 'contribution' to the fund (an existing one, or one
--                 created now from p_new_fund_name), dated p_today
--   next_period   added to the unassigned_carry_pence of the period
--   unassigned    containing p_today (the current period); both stay
--                 spendable (§5.5); 'unassigned' also shows a nudge on the
--                 Budget tab until dismissed or the budget is edited
-- Every review, with or without a leftover, sets budget_periods.reviewed_at.
-- With nothing left over (p_amount_pence = 0) no destination is given and no
-- leftover_movements row is written (its amount must be at least 1p).
--
-- It refuses, writing nothing:
--   42501  not signed in
--   22023  a missing or malformed argument, a p_today more than a day from
--          the server's date, a destination with no leftover (or none with
--          one), or a fund / new fund name with a destination that isn't fund
--   P0002  the period (or, for a carry, the current period) isn't the caller's
--   PT425  the period hasn't ended by p_today
--   PT409  the period has already been reviewed
--   PT422  p_amount_pence isn't the period's leftover now
--   PT404  a fund that isn't the caller's
--   23505  the new fund's name is taken (funds are unique ignoring case)
--
-- security invoker (RLS applies to every statement), empty search_path,
-- callable only by signed-in users. Like the 0005/0006 functions it locks the
-- caller's profile row first, so it runs one at a time with save_budget,
-- renewals and savings confirms, then locks the period rows it reads.

alter table public.budget_periods add column reviewed_at timestamptz;

-- Where a carried leftover went (the current period when it was recorded),
-- and when the "Give every pound a job" nudge was dismissed.
alter table public.leftover_movements
  add column carried_to_period_id uuid,
  add column nudge_dismissed_at timestamptz,
  add constraint leftover_movements_carried_to_fkey foreign key (carried_to_period_id, user_id)
    references public.budget_periods (id, user_id) on delete set null (carried_to_period_id);

create index leftover_movements_carried_to_idx on public.leftover_movements (carried_to_period_id, user_id);

-- A recorded leftover is written only by record_leftover; the only change a
-- user makes directly is dismissing the nudge. Leftover rows and
-- budget_periods.reviewed_at are the user's own bookkeeping: record_leftover
-- is security invoker, so it needs the insert/delete/select grants (and the
-- update grant on budget_periods), and a user can write their own rows under
-- RLS. Doing so can only skip their own review; it changes no other user's
-- data and no figure is derived from reviewed_at.
revoke update on public.leftover_movements from authenticated;
grant update (nudge_dismissed_at) on public.leftover_movements to authenticated;

create function public.record_leftover(
  p_period_id uuid,
  p_today date,
  p_amount_pence bigint,
  p_destination text default null,
  p_fund_id uuid default null,
  p_new_fund_name text default null
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  v_period public.budget_periods;
  v_current public.budget_periods;
  v_spent bigint;
  v_leftover bigint;
  v_fund_id uuid;
begin
  if uid is null then
    raise exception 'record_leftover: not signed in' using errcode = '42501';
  end if;

  if p_period_id is null or p_today is null
     or p_today not between current_date - 1 and current_date + 1 then
    raise exception 'record_leftover: a period and today''s date are needed' using errcode = '22023';
  end if;
  if p_amount_pence is null or p_amount_pence not between 0 and 1000000000 then
    raise exception 'record_leftover: an amount of £0 to £10m is needed' using errcode = '22023';
  end if;
  if (p_amount_pence = 0) <> (p_destination is null)
     or (p_destination is not null and p_destination not in ('fund', 'next_period', 'unassigned')) then
    raise exception 'record_leftover: a leftover needs one destination: fund, next_period or unassigned'
      using errcode = '22023';
  end if;
  if (p_destination is not distinct from 'fund') <> (p_fund_id is not null or p_new_fund_name is not null)
     or (p_fund_id is not null and p_new_fund_name is not null)
     or (p_new_fund_name is not null and char_length(btrim(p_new_fund_name)) not between 1 and 50) then
    raise exception 'record_leftover: a fund destination needs one fund or one new name (1-50)' using errcode = '22023';
  end if;

  -- Serialise with save_budget, renewals and savings confirms, then hold the period.
  perform 1 from public.profiles where user_id = uid for update;

  select * into v_period from public.budget_periods where id = p_period_id and user_id = uid for update;
  if not found then
    raise exception 'record_leftover: no such period' using errcode = 'P0002';
  end if;
  if v_period.end_date >= p_today then
    raise exception 'record_leftover: the period ending % has not ended', v_period.end_date using errcode = 'PT425';
  end if;
  if v_period.reviewed_at is not null then
    raise exception 'record_leftover: this period has already been reviewed' using errcode = 'PT409';
  end if;

  -- The check the caller's figure must pass: left to spend (summarise in
  -- src/lib/calc) = income − savings + carry − in-period spending not paid
  -- from a fund, and no leftover when that is below zero.
  select coalesce(sum(t.amount_pence), 0) into v_spent
  from public.transactions t
  where t.user_id = uid and t.fund_id is null and t.date between v_period.start_date and v_period.end_date;
  v_leftover := greatest(0, v_period.income_pence - v_period.savings_pence + v_period.unassigned_carry_pence - v_spent);
  if p_amount_pence <> v_leftover then
    raise exception 'record_leftover: the leftover is now %', v_leftover using errcode = 'PT422';
  end if;

  if p_destination = 'fund' then
    if p_new_fund_name is not null then
      insert into public.funds (user_id, name) values (uid, btrim(p_new_fund_name)) returning id into v_fund_id;
    else
      select id into v_fund_id from public.funds where id = p_fund_id and user_id = uid;
      if not found then
        raise exception 'record_leftover: unknown fund' using errcode = 'PT404';
      end if;
    end if;
    insert into public.fund_movements (user_id, fund_id, date, kind, amount_pence, note)
    values (uid, v_fund_id, p_today, 'contribution', p_amount_pence,
            'Left over from the budget ending ' || to_char(v_period.end_date, 'FMDD FMMonth YYYY'));
    insert into public.leftover_movements (user_id, period_id, destination, fund_id, amount_pence)
    values (uid, v_period.id, 'fund', v_fund_id, p_amount_pence);
  elsif p_destination is not null then
    select * into v_current
    from public.budget_periods
    where user_id = uid and start_date <= p_today and end_date >= p_today
    for update;
    if not found then
      raise exception 'record_leftover: there is no current period to carry into' using errcode = 'P0002';
    end if;
    update public.budget_periods
    set unassigned_carry_pence = unassigned_carry_pence + p_amount_pence
    where id = v_current.id and user_id = uid;
    insert into public.leftover_movements (user_id, period_id, destination, amount_pence, carried_to_period_id)
    values (uid, v_period.id, p_destination, p_amount_pence, v_current.id);
  end if;

  update public.budget_periods set reviewed_at = now() where id = v_period.id and user_id = uid;
end;
$$;

revoke execute on function public.record_leftover(uuid, date, bigint, text, uuid, text) from public, anon;
grant execute on function public.record_leftover(uuid, date, bigint, text, uuid, text) to authenticated;

-- raise_allocation ---------------------------------------------------------------
--
-- raise_allocation(period, next_end, category, amount) applies a review's
-- "raise budget" suggestion: the category's allocation becomes p_amount_pence
-- in the current period (p_period_id, from ensureCurrentPeriod) and, when the
-- next period already exists (a "From next period" edit), in that one too,
-- every other figure of both left as it is. One transaction, after locking the
-- caller's profile (private.edit_targets, scope 'this'), like save_budget.
-- Past periods are never touched. Refuses (writing nothing): 42501 not signed
-- in; 22023 an amount outside 1p-£10m; P0002 a period or category that isn't
-- the caller's.

create function public.raise_allocation(
  p_period_id uuid,
  p_next_end date,
  p_category_id uuid,
  p_amount_pence bigint
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  v_targets uuid[];
begin
  if uid is null then
    raise exception 'raise_allocation: not signed in' using errcode = '42501';
  end if;
  if p_amount_pence is null or p_amount_pence not between 1 and 1000000000 then
    raise exception 'raise_allocation: an amount of 1p to £10m is needed' using errcode = '22023';
  end if;

  v_targets := private.edit_targets(p_period_id, p_next_end, 'this');

  if not exists (select 1 from public.categories where id = p_category_id and user_id = uid) then
    raise exception 'raise_allocation: no such category' using errcode = 'P0002';
  end if;

  insert into public.allocations (user_id, period_id, category_id, amount_pence)
  select uid, t.id, p_category_id, p_amount_pence from unnest(v_targets) as t (id)
  on conflict (user_id, period_id, category_id) do update set amount_pence = excluded.amount_pence;
end;
$$;

revoke execute on function public.raise_allocation(uuid, date, uuid, bigint) from public, anon;
grant execute on function public.raise_allocation(uuid, date, uuid, bigint) to authenticated;

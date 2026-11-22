-- Overspend at month end (David, 2026-11-22), reversing "an overspend is
-- shown, not carried forward" (spec §5.9).
--
-- The review settles an ended period's result as one whole amount either way:
--   leftover  (left to spend > 0)  fund / next budget / keep unassigned, as in 0008;
--   overspend (left to spend < 0)  from next month's spending money (the
--             current period's unassigned carry goes down by it, with an
--             'overspend' carry_adjustments row), or from a savings fund (a
--             withdrawal dated p_today, refused when the fund holds less).
-- Category budgets never carry; only the period's whole figure does.
--
-- leftover_movements gets a `kind` column (leftover | overspend) rather than a
-- signed amount, so amount_pence stays positive and destination keeps its
-- meaning: for an overspend, 'fund' is the fund it came from and
-- 'next_period' the period it was taken from (carried_to_period_id).
--
-- Also (fix-wave re-review): the late-change trigger skips Supabase Auth's
-- account deletion by role name, not by privilege, and no longer drops a
-- change silently when no unreviewed period follows the reviewed one.

-- leftover_movements -------------------------------------------------------------

alter table public.leftover_movements
  add column kind text not null default 'leftover',
  add constraint leftover_movements_kind_check check (kind in ('leftover', 'overspend')),
  add constraint leftover_movements_overspend_destination check (kind <> 'overspend' or destination in ('fund', 'next_period')),
  drop constraint leftover_movements_amount_pence_check,
  add constraint leftover_movements_amount_pence_check check (amount_pence between 1 and 100000000000);

-- carry_adjustments --------------------------------------------------------------

alter table public.carry_adjustments
  drop constraint carry_adjustments_reason_check,
  add constraint carry_adjustments_reason_check check (reason in ('late_change', 'from_fund', 'overspend')),
  add constraint carry_adjustments_overspend_check
    check (reason <> 'overspend' or (source_period_id is not null and fund_id is null and amount_pence < 0));

-- The late-change trigger ----------------------------------------------------------
-- As in 0011, except: it skips only Supabase Auth (current_user =
-- 'supabase_auth_admin', the role that deletes accounts) instead of any role
-- without insert on carry_adjustments; and with no unreviewed period after
-- the reviewed one, the latest later period takes the change (a WARNING is
-- logged when there is no later period at all). The full Δ always moves, so a
-- late change to an over-budget month is consistent with carrying overspends.

create or replace function private.carry_late_changes()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_changes jsonb;
  v_users uuid[];
  r record;
  v_target uuid;
begin
  -- Supabase Auth deleting an account: the expenses go by cascade with
  -- everything else of the user's, so there is nothing to adjust.
  if current_user = 'supabase_auth_admin' then
    return null;
  end if;

  -- Each referenced transition table exists only for its operation; PL/pgSQL
  -- plans a statement when it first runs, so the other branches are never planned.
  if tg_op = 'INSERT' then
    select jsonb_agg(jsonb_build_object('user_id', n.user_id, 'date', n.date, 'delta', n.amount_pence))
    into v_changes from new_rows n where n.fund_id is null;
  elsif tg_op = 'DELETE' then
    select jsonb_agg(jsonb_build_object('user_id', o.user_id, 'date', o.date, 'delta', -o.amount_pence))
    into v_changes from old_rows o where o.fund_id is null;
  else
    select jsonb_agg(jsonb_build_object('user_id', c.user_id, 'date', c.date, 'delta', c.delta))
    into v_changes
    from (
      select x.user_id, x.date, sum(x.delta) as delta
      from (select o.user_id, o.date, -o.amount_pence as delta from old_rows o where o.fund_id is null
            union all
            select n.user_id, n.date, n.amount_pence from new_rows n where n.fund_id is null) as x
      group by x.user_id, x.date
      having sum(x.delta) <> 0
    ) as c;
  end if;

  if v_changes is null then
    return null;
  end if;

  -- Serialise with record_leftover, so a review and a late change never miss each other.
  select array_agg(distinct c.user_id order by c.user_id) into v_users
  from jsonb_to_recordset(v_changes) as c (user_id uuid);
  perform 1 from public.profiles where user_id = any (v_users) order by user_id for update;

  for r in
    select c.user_id, p.id as source_id, p.end_date, sum(c.delta) as delta
    from jsonb_to_recordset(v_changes) as c (user_id uuid, date date, delta bigint)
    join public.budget_periods p
      on p.user_id = c.user_id and c.date between p.start_date and p.end_date
    where p.reviewed_at is not null
    group by c.user_id, p.id, p.end_date
    having sum(c.delta) <> 0
    order by c.user_id, p.end_date
  loop
    select id into v_target
    from public.budget_periods
    where user_id = r.user_id and start_date > r.end_date and reviewed_at is null
    order by start_date
    limit 1;
    if v_target is null then
      -- Every later period is reviewed too (only possible for rows written
      -- around the app): the latest one takes it, so the change isn't lost.
      select id into v_target
      from public.budget_periods
      where user_id = r.user_id and start_date > r.end_date
      order by start_date desc
      limit 1;
    end if;
    if v_target is null then
      -- No later period at all (the source is the user's latest period): its
      -- own figures already show the change; say so in the log.
      raise warning 'carry_late_changes: no period after % to adjust (user %, change %)', r.end_date, r.user_id, r.delta;
      continue;
    end if;

    update public.budget_periods
    set unassigned_carry_pence = unassigned_carry_pence - r.delta
    where id = v_target and user_id = r.user_id;
    insert into public.carry_adjustments (user_id, period_id, source_period_id, amount_pence, reason)
    values (r.user_id, v_target, r.source_id, -r.delta, 'late_change');
  end loop;
  return null;
end;
$$;

-- record_leftover -------------------------------------------------------------------
-- As in 0008, but p_amount_pence is the period's whole result, signed: left
-- to spend (summarise in src/lib/calc), worked out again here WITHOUT the
-- greatest(0, …) floor and refused (PT422) when it differs. Positive: a
-- leftover, destinations as before. Negative: an overspend of −p_amount_pence,
-- destination 'next_period' (taken from the current period's carry) or 'fund'
-- (an existing fund only). Zero: no destination, only marked reviewed.
--
-- Refusals, writing nothing: 42501 not signed in; 22023 a malformed argument,
-- a today more than a day from the server's, a destination that doesn't fit
-- the sign, or a new fund for an overspend; P0002 the period or the current
-- period isn't the caller's; PT425 not ended; PT409 already reviewed; PT422 the
-- amount isn't the period's result now; PT404 a fund that isn't the caller's;
-- PT402 the fund holds less than the overspend; 23505 a new fund's name taken.

create or replace function public.record_leftover(
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
  v_result bigint;
  v_over bigint := greatest(-p_amount_pence, 0);
  v_fund_id uuid;
  v_balance bigint;
begin
  if uid is null then
    raise exception 'record_leftover: not signed in' using errcode = '42501';
  end if;

  if p_period_id is null or p_today is null
     or p_today not between current_date - 1 and current_date + 1 then
    raise exception 'record_leftover: a period and today''s date are needed' using errcode = '22023';
  end if;
  if p_amount_pence is null or p_amount_pence not between -100000000000 and 1000000000 then
    raise exception 'record_leftover: an amount of −£1bn to £10m is needed' using errcode = '22023';
  end if;
  if (p_amount_pence = 0) <> (p_destination is null)
     or (p_destination is not null and p_destination not in ('fund', 'next_period', 'unassigned'))
     or (p_amount_pence < 0 and p_destination not in ('fund', 'next_period')) then
    raise exception 'record_leftover: a leftover goes to a fund, next_period or unassigned; an overspend comes from next_period or a fund'
      using errcode = '22023';
  end if;
  if (p_destination is not distinct from 'fund') <> (p_fund_id is not null or p_new_fund_name is not null)
     or (p_fund_id is not null and p_new_fund_name is not null)
     or (p_new_fund_name is not null and (p_amount_pence < 0 or char_length(btrim(p_new_fund_name)) not between 1 and 50)) then
    raise exception 'record_leftover: a fund destination needs one fund, or for a leftover one new name (1-50)' using errcode = '22023';
  end if;

  -- Serialise with save_budget, renewals, savings confirms and late changes, then hold the period.
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
  -- src/lib/calc/budget.ts) = income − savings + carry − in-period spending
  -- not paid from a fund. Signed: below zero is an overspend.
  select coalesce(sum(t.amount_pence), 0) into v_spent
  from public.transactions t
  where t.user_id = uid and t.fund_id is null and t.date between v_period.start_date and v_period.end_date;
  v_result := v_period.income_pence - v_period.savings_pence + v_period.unassigned_carry_pence - v_spent;
  if p_amount_pence <> v_result then
    raise exception 'record_leftover: the result is now %', v_result using errcode = 'PT422';
  end if;

  if p_amount_pence > 0 and p_destination = 'fund' then
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
  elsif p_amount_pence < 0 and p_destination = 'fund' then
    select id into v_fund_id from public.funds where id = p_fund_id and user_id = uid for update;
    if not found then
      raise exception 'record_leftover: unknown fund' using errcode = 'PT404';
    end if;
    v_balance := private.fund_balance(uid, v_fund_id);
    if v_over > v_balance then
      raise exception 'record_leftover: the fund holds %', greatest(v_balance, 0) using errcode = 'PT402';
    end if;
    insert into public.fund_movements (user_id, fund_id, date, kind, amount_pence, note)
    values (uid, v_fund_id, p_today, 'withdrawal', v_over,
            'Covered ' || to_char(v_period.start_date, 'FMMonth') || ' overspend');
    insert into public.leftover_movements (user_id, period_id, kind, destination, fund_id, amount_pence)
    values (uid, v_period.id, 'overspend', 'fund', v_fund_id, v_over);
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
    if p_amount_pence < 0 then
      insert into public.carry_adjustments (user_id, period_id, source_period_id, amount_pence, reason)
      values (uid, v_current.id, v_period.id, p_amount_pence, 'overspend');
      insert into public.leftover_movements (user_id, period_id, kind, destination, amount_pence, carried_to_period_id)
      values (uid, v_period.id, 'overspend', 'next_period', v_over, v_current.id);
    else
      insert into public.leftover_movements (user_id, period_id, destination, amount_pence, carried_to_period_id)
      values (uid, v_period.id, p_destination, p_amount_pence, v_current.id);
    end if;
  end if;

  update public.budget_periods set reviewed_at = now() where id = v_period.id and user_id = uid;
end;
$$;

revoke execute on function public.record_leftover(uuid, date, bigint, text, uuid, text) from public, anon;
grant execute on function public.record_leftover(uuid, date, bigint, text, uuid, text) to authenticated;

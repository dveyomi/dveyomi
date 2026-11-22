-- Final fixes (David's decisions, 2026-11-22).
--
--   * budget_periods: periods of one user never overlap (exclusion
--     constraint), and the unassigned carry may go below zero, within ±£1bn.
--   * carry_adjustments: every change made to a period's unassigned carry
--     after the fact, so the Budget tab can say why its figure moved:
--       late_change  the non-fund spending of a reviewed period changed by Δ
--                    (an expense added, edited, deleted, imported, undone or
--                    generated late); the next unreviewed period after it,
--                    normally the current one, gets −Δ.
--       from_fund    money withdrawn from a fund into this month's spending.
--   * save_budget: "This month" may not change the current period's savings
--     once its savings prompt is confirmed (PT409); "From next period" may.
--   * withdraw_from_fund / move_between_funds: fund withdrawals with the
--     balance checked in the same transaction; a withdrawal can go into the
--     current period's spending money, and money can move between funds.
--
-- Every function is security invoker (RLS applies to every statement), with
-- an empty search_path, and callable only by signed-in users (the trigger
-- function by nobody directly). Like the 0005-0010 functions, each locks the
-- caller's profile row first, so it runs one at a time with save_budget,
-- renewals, savings confirms and reviews.

-- budget_periods ------------------------------------------------------------------

alter table public.budget_periods
  add constraint budget_periods_carry_bounds
    check (unassigned_carry_pence between -100000000000 and 100000000000),
  add constraint budget_periods_no_overlap exclude using gist (
    user_id extensions.gist_uuid_ops with =,
    daterange(start_date, end_date, '[]') with &&
  );

-- carry_adjustments ---------------------------------------------------------------

create table public.carry_adjustments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- The period whose unassigned carry changed.
  period_id uuid not null,
  -- late_change: the reviewed period whose spending changed.
  source_period_id uuid,
  -- from_fund: the fund the money came from (null once that fund is deleted).
  fund_id uuid,
  -- The change to period_id's carry: −Δ for a late change, + the amount from a fund.
  amount_pence bigint not null check (amount_pence <> 0 and amount_pence between -100000000000 and 100000000000),
  reason text not null check (reason in ('late_change', 'from_fund')),
  created_at timestamptz not null default now(),
  check (reason <> 'late_change' or (source_period_id is not null and fund_id is null)),
  check (reason <> 'from_fund' or (source_period_id is null and amount_pence > 0)),
  unique (id, user_id),
  foreign key (period_id, user_id) references public.budget_periods (id, user_id) on delete cascade,
  foreign key (source_period_id, user_id) references public.budget_periods (id, user_id) on delete cascade,
  foreign key (fund_id, user_id) references public.funds (id, user_id) on delete set null (fund_id)
);

create index carry_adjustments_period_idx on public.carry_adjustments (period_id, user_id);
create index carry_adjustments_source_period_idx on public.carry_adjustments (source_period_id, user_id);
create index carry_adjustments_fund_idx on public.carry_adjustments (fund_id, user_id);

-- Written only by the trigger and withdraw_from_fund below; never changed. Both
-- are security invoker, so authenticated needs select and insert. A user who
-- inserts a row directly only mislabels their own Budget tab: no figure is
-- derived from this table (the carry itself is budget_periods.unassigned_carry_pence).
alter table public.carry_adjustments enable row level security;
revoke all on public.carry_adjustments from anon, authenticated;
grant select, insert on public.carry_adjustments to authenticated;

create policy "carry_adjustments: owner select" on public.carry_adjustments for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "carry_adjustments: owner insert" on public.carry_adjustments for insert to authenticated
  with check ((select auth.uid()) = user_id);

-- Late changes to a reviewed period ---------------------------------------------------
--
-- After any statement that inserts, updates or deletes expenses, the change in
-- each reviewed period's non-fund spending (Δ, more spent is positive) is
-- written to the earliest unreviewed period after it as unassigned carry −Δ,
-- with a carry_adjustments row. That covers every path in one place (the
-- expense form, save_expense, deletes, import_expenses, undo_import, the
-- recurring catch-up and the hourly job, price changes), each in its own
-- transaction. Fund-paid expenses never counted, so they're left out.
--
-- record_leftover (0008) and summarise (src/lib/calc/budget.ts) read the carry
-- as before; nothing in their formula changes.
--
-- It runs as whoever made the change (the user, or the service role for the
-- hourly job), on the changed rows' user_id. A role that can't write
-- carry_adjustments is skipped: that is Supabase Auth deleting an account,
-- whose expenses go by cascade with everything else of the user's.

create function private.carry_late_changes()
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
  if not has_table_privilege('public.carry_adjustments', 'insert') then
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
    -- Every reviewed period has a later one (the review needs it ended), so
    -- this is only empty for rows written by hand around the app.
    continue when v_target is null;

    update public.budget_periods
    set unassigned_carry_pence = unassigned_carry_pence - r.delta
    where id = v_target and user_id = r.user_id;
    insert into public.carry_adjustments (user_id, period_id, source_period_id, amount_pence, reason)
    values (r.user_id, v_target, r.source_id, -r.delta, 'late_change');
  end loop;
  return null;
end;
$$;

revoke execute on function private.carry_late_changes() from public, anon, authenticated;

create trigger transactions_carry_late_inserts
  after insert on public.transactions
  referencing new table as new_rows
  for each statement execute function private.carry_late_changes();

create trigger transactions_carry_late_updates
  after update on public.transactions
  referencing old table as old_rows new table as new_rows
  for each statement execute function private.carry_late_changes();

create trigger transactions_carry_late_deletes
  after delete on public.transactions
  referencing old table as old_rows
  for each statement execute function private.carry_late_changes();

-- save_budget ---------------------------------------------------------------------
-- As in 0005, plus: with scope 'this', a change to the current period's
-- savings_pence is refused (PT409) once its savings prompt is confirmed: that
-- money has already gone into funds. "From next period" is unaffected.
-- raise_allocation (0008) never changes savings, so it needs no such check.

create or replace function public.save_budget(
  p_period_id uuid,
  p_next_end date,
  p_scope text,
  p_income_pence bigint,
  p_savings_pence bigint,
  p_categories jsonb
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  targets uuid[];
  input_ids uuid[];
  kept_rows jsonb;
  row_ record;
  cat_id uuid;
  kept uuid[] := '{}';
  amounts bigint[] := '{}';
begin
  if uid is null then
    raise exception 'save_budget: not signed in' using errcode = '42501';
  end if;

  if coalesce(jsonb_typeof(p_categories), '') <> 'array' or jsonb_array_length(p_categories) > 100 then
    raise exception 'save_budget: categories must be an array of at most 100' using errcode = '22023';
  end if;

  if p_income_pence is null or p_savings_pence is null or p_savings_pence > p_income_pence then
    raise exception 'save_budget: savings must be no more than income' using errcode = '22023';
  end if;

  -- The rows kept in the budget, names trimmed, in input order.
  select coalesce(jsonb_agg(e.value || jsonb_build_object('name', btrim(e.value ->> 'name')) order by e.ord), '[]')
  into kept_rows
  from jsonb_array_elements(p_categories) with ordinality as e (value, ord)
  where not coalesce((e.value ->> 'removed')::boolean, false);

  -- Every id given, kept or removed.
  select array_agg(c.id) filter (where c.id is not null) into input_ids
  from jsonb_to_recordset(p_categories) as c (id uuid);
  input_ids := coalesce(input_ids, '{}');

  if jsonb_array_length(kept_rows) > 50 then
    raise exception 'save_budget: at most 50 categories in the budget' using errcode = '22023';
  end if;

  if exists (select 1 from jsonb_to_recordset(kept_rows) as i (id uuid, name text, kind text, amount_pence bigint)
             where name is null or char_length(name) not between 1 and 50
                or kind is null or kind not in ('need', 'want')
                or amount_pence is null or amount_pence not between 0 and 1000000000) then
    raise exception 'save_budget: names 1-50 characters, kind need or want, amounts £0 to £10m'
      using errcode = '22023';
  end if;

  if cardinality(input_ids) <> (select count(distinct x) from unnest(input_ids) as x)
     or (select count(*) <> count(distinct lower(name))
         from jsonb_to_recordset(kept_rows) as i (id uuid, name text, kind text, amount_pence bigint)) then
    raise exception 'save_budget: a category appears twice' using errcode = '22023';
  end if;

  if (select count(*) from public.categories where user_id = uid and id = any (input_ids)) <> cardinality(input_ids) then
    raise exception 'save_budget: unknown category' using errcode = 'P0002';
  end if;

  -- Locks the profile, so a savings confirm can't land between this check and the update.
  targets := private.edit_targets(p_period_id, p_next_end, p_scope);

  if p_scope = 'this' and exists (
    select 1
    from public.budget_periods p
    join public.savings_prompts s on s.period_id = p.id and s.user_id = p.user_id
    where p.id = p_period_id and p.user_id = uid and s.status = 'confirmed'
      and p.savings_pence <> p_savings_pence
  ) then
    raise exception 'save_budget: this period''s savings are already moved' using errcode = 'PT409';
  end if;

  update public.budget_periods
  set income_pence = p_income_pence, savings_pence = p_savings_pence
  where user_id = uid and id = any (targets);

  if p_savings_pence > 0 then
    insert into public.savings_prompts (user_id, period_id, status)
    select uid, t, 'waiting' from unnest(targets) as t
    on conflict (user_id, period_id) do nothing;
  else
    delete from public.savings_prompts
    where user_id = uid and period_id = any (targets) and status = 'waiting';
  end if;

  -- Existing categories first, so a new row can take a name one gives up.
  -- Only the name changes: a category's kind is set when it is created.
  update public.categories c
  set name = i.name
  from jsonb_to_recordset(kept_rows) as i (id uuid, name text, kind text, amount_pence bigint)
  where c.user_id = uid and c.id = i.id and c.name is distinct from i.name;

  for row_ in select i.*
              from jsonb_array_elements(kept_rows) with ordinality as e (value, ord),
                   jsonb_to_record(e.value) as i (id uuid, name text, kind text, amount_pence bigint)
              order by (i.id is null), e.ord loop
    cat_id := row_.id;
    if cat_id is null then
      select c.id into cat_id
      from public.categories c
      where c.user_id = uid and lower(c.name) = lower(row_.name) and not (c.id = any (input_ids));
      if cat_id is null then
        insert into public.categories (user_id, name, kind) values (uid, row_.name, row_.kind)
        returning id into cat_id;
      else
        -- Brought back under the name typed; it keeps its kind.
        update public.categories set name = row_.name where user_id = uid and id = cat_id;
      end if;
    end if;
    kept := kept || cat_id;
    amounts := amounts || row_.amount_pence;
  end loop;

  delete from public.allocations
  where user_id = uid and period_id = any (targets) and not (category_id = any (kept));

  insert into public.allocations (user_id, period_id, category_id, amount_pence)
  select uid, t, k.category_id, k.amount_pence
  from unnest(targets) as t
  cross join unnest(kept, amounts) as k (category_id, amount_pence)
  on conflict (user_id, period_id, category_id) do update set amount_pence = excluded.amount_pence;
end;
$$;

-- Fund withdrawals and moves ---------------------------------------------------------

-- A fund's balance now: opening + contributions − withdrawals − expenses paid
-- from it (fundBalance in src/lib/calc/funds.ts; keep the two in step).
create function private.fund_balance(p_user_id uuid, p_fund_id uuid)
returns bigint
language sql
stable
security invoker
set search_path = ''
as $$
  select f.opening_pence
       + coalesce((select sum(case when m.kind = 'contribution' then m.amount_pence else -m.amount_pence end)
                   from public.fund_movements m where m.user_id = p_user_id and m.fund_id = f.id), 0)
       - coalesce((select sum(t.amount_pence)
                   from public.transactions t where t.user_id = p_user_id and t.fund_id = f.id), 0)
  from public.funds f
  where f.user_id = p_user_id and f.id = p_fund_id;
$$;

revoke execute on function private.fund_balance(uuid, uuid) from public, anon;
grant execute on function private.fund_balance(uuid, uuid) to authenticated;

-- A movement's note: the app's text, then the user's own after " · ", within 200 characters.
create function private.movement_note(p_prefix text, p_note text)
returns text
language sql
immutable
set search_path = ''
as $$
  select nullif(left(concat_ws(' · ', nullif(btrim(p_prefix), ''), nullif(btrim(p_note), '')), 200), '');
$$;

revoke execute on function private.movement_note(text, text) from public, anon;
grant execute on function private.movement_note(text, text) to authenticated;

-- withdraw_from_fund ---------------------------------------------------------------
-- Takes p_amount_pence out of the fund, dated p_date. With p_to_period_id (the
-- current period, from ensureCurrentPeriod) the money goes into that period's
-- spending money too: its unassigned carry goes up by the amount, with a
-- from_fund carry_adjustments row, and the movement's note says so ("Moved to
-- November spending"). Without it, only the fund changes. All or nothing.
-- Refuses: 42501 not signed in; 22023 a missing date, an amount outside
-- 1p-£10m or a note over 200; PT404 a fund or period that isn't the caller's;
-- PT422 more than the fund holds.
create function public.withdraw_from_fund(
  p_fund_id uuid,
  p_date date,
  p_amount_pence bigint,
  p_note text default null,
  p_to_period_id uuid default null
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  v_balance bigint;
  v_period public.budget_periods;
  v_prefix text;
begin
  if uid is null then
    raise exception 'withdraw_from_fund: not signed in' using errcode = '42501';
  end if;
  if p_date is null or p_amount_pence is null or p_amount_pence not between 1 and 1000000000
     or char_length(p_note) > 200 then
    raise exception 'withdraw_from_fund: a date, an amount of 1p to £10m and a note of up to 200 are needed'
      using errcode = '22023';
  end if;

  perform 1 from public.profiles where user_id = uid for update;
  perform 1 from public.funds where id = p_fund_id and user_id = uid for update;
  if not found then
    raise exception 'withdraw_from_fund: unknown fund' using errcode = 'PT404';
  end if;

  if p_to_period_id is not null then
    select * into v_period from public.budget_periods where id = p_to_period_id and user_id = uid for update;
    if not found then
      raise exception 'withdraw_from_fund: unknown period' using errcode = 'PT404';
    end if;
    v_prefix := 'Moved to ' || to_char(v_period.start_date, 'FMMonth') || ' spending';
  end if;

  v_balance := private.fund_balance(uid, p_fund_id);
  if p_amount_pence > v_balance then
    raise exception 'withdraw_from_fund: the fund holds %', greatest(v_balance, 0) using errcode = 'PT422';
  end if;

  insert into public.fund_movements (user_id, fund_id, date, kind, amount_pence, note)
  values (uid, p_fund_id, p_date, 'withdrawal', p_amount_pence, private.movement_note(v_prefix, p_note));

  if p_to_period_id is not null then
    update public.budget_periods
    set unassigned_carry_pence = unassigned_carry_pence + p_amount_pence
    where id = v_period.id and user_id = uid;
    insert into public.carry_adjustments (user_id, period_id, fund_id, amount_pence, reason)
    values (uid, v_period.id, p_fund_id, p_amount_pence, 'from_fund');
  end if;
end;
$$;

revoke execute on function public.withdraw_from_fund(uuid, date, bigint, text, uuid) from public, anon;
grant execute on function public.withdraw_from_fund(uuid, date, bigint, text, uuid) to authenticated;

-- move_between_funds ---------------------------------------------------------------
-- Moves p_amount_pence from fund p_from_id to fund p_to_id on p_date: a
-- withdrawal on the first ("To Holiday") and a contribution on the second
-- ("From Emergency"), together. The budget is untouched. Refuses: 42501 not
-- signed in; 22023 bad input or the same fund twice; PT404 a fund that isn't
-- the caller's; PT422 more than the first fund holds.
create function public.move_between_funds(
  p_from_id uuid,
  p_to_id uuid,
  p_date date,
  p_amount_pence bigint,
  p_note text default null
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  v_from text;
  v_to text;
  v_balance bigint;
begin
  if uid is null then
    raise exception 'move_between_funds: not signed in' using errcode = '42501';
  end if;
  if p_from_id is null or p_to_id is null or p_date is null
     or p_amount_pence is null or p_amount_pence not between 1 and 1000000000
     or char_length(p_note) > 200 then
    raise exception 'move_between_funds: two funds, a date, an amount of 1p to £10m and a note of up to 200 are needed'
      using errcode = '22023';
  end if;
  if p_from_id = p_to_id then
    raise exception 'move_between_funds: choose a different fund to move to' using errcode = '22023';
  end if;

  perform 1 from public.profiles where user_id = uid for update;
  -- Both funds, locked in id order.
  perform 1 from public.funds where user_id = uid and id in (p_from_id, p_to_id) order by id for update;
  select name into v_from from public.funds where user_id = uid and id = p_from_id;
  select name into v_to from public.funds where user_id = uid and id = p_to_id;
  if v_from is null or v_to is null then
    raise exception 'move_between_funds: unknown fund' using errcode = 'PT404';
  end if;

  v_balance := private.fund_balance(uid, p_from_id);
  if p_amount_pence > v_balance then
    raise exception 'move_between_funds: the fund holds %', greatest(v_balance, 0) using errcode = 'PT422';
  end if;

  insert into public.fund_movements (user_id, fund_id, date, kind, amount_pence, note)
  values (uid, p_from_id, p_date, 'withdrawal', p_amount_pence, private.movement_note('To ' || v_to, p_note)),
         (uid, p_to_id, p_date, 'contribution', p_amount_pence, private.movement_note('From ' || v_from, p_note));
end;
$$;

revoke execute on function public.move_between_funds(uuid, uuid, date, bigint, text) from public, anon;
grant execute on function public.move_between_funds(uuid, uuid, date, bigint, text) to authenticated;

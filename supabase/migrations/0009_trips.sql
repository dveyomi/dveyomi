-- Trips (§5.12): a trip is a label on expenses, never a budget.
--
-- An expense belongs to trip T when
--   (a) trip_override is false and its date is within T's dates (automatic), or
--   (b) trip_override is true and trip_id = T (added by hand).
-- trip_override true with trip_id null means "not in any trip" (removed).
-- src/lib/data/trips.ts reads membership this way; nothing here changes any
-- budget figure.
--
-- This migration:
--   * keeps a user's trips from overlapping (an exclusion constraint, btree_gist),
--     so an expense's date falls in at most one trip;
--   * only lets trip_id be set with trip_override (check constraint);
--   * before a trip is deleted, makes the expenses added to it by hand
--     automatic again (trigger), in the same statement;
--   * lets save_expense record the Trip choice (p_trip) with the rest of the
--     expense, all or nothing.
-- A trip's place is typed text; no column stores a location.

create extension if not exists btree_gist with schema extensions;

alter table public.trips
  add constraint trips_name_not_blank check (char_length(btrim(name)) >= 1),
  add constraint trips_no_overlap exclude using gist (
    user_id extensions.gist_uuid_ops with =,
    daterange(start_date, end_date, '[]') with &&
  );

alter table public.transactions
  add constraint transactions_trip_needs_override check (trip_override or trip_id is null);

-- Membership reads use the existing (user_id, date) and (trip_id, user_id) indexes.

-- clear_trip_overrides ---------------------------------------------------------
-- Runs as the caller (RLS applies), so it only ever touches the deleting
-- user's expenses; trip_id carries the composite key with user_id anyway.
create function private.clear_trip_overrides()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.transactions
  set trip_override = false, trip_id = null
  where trip_id = old.id and user_id = old.user_id;
  return old;
end;
$$;

revoke execute on function private.clear_trip_overrides() from public, anon, authenticated;

create trigger trips_clear_overrides
  before delete on public.trips
  for each row execute function private.clear_trip_overrides();

-- save_expense -----------------------------------------------------------------
-- As in 0007, plus p_trip: null leaves the Trip choice as it is (an edit) or
-- automatic (a new expense); 'auto' makes it automatic; 'none' takes it out of
-- every trip; a trip id adds it to that trip (the composite foreign key
-- refuses another user's trip: 23503).
drop function public.save_expense(text, bigint, date, uuid, uuid, text, text, uuid, text, text, text, text, jsonb);

create function public.save_expense(
  p_name text,
  p_amount_pence bigint,
  p_date date,
  p_id uuid default null,
  p_category_id uuid default null,
  p_new_category_name text default null,
  p_new_category_kind text default null,
  p_fund_id uuid default null,
  p_account_label text default null,
  p_notes text default null,
  p_repeat text default null,
  p_amount_scope text default null,
  p_price_updates jsonb default '[]',
  p_trip text default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  v_name text := btrim(p_name);
  v_category_id uuid := p_category_id;
  v_rule_id uuid;
  v_id uuid;
  v_updated int;
  -- p_trip: null keeps (update) or leaves automatic (insert); 'auto'; 'none'; or a trip id.
  v_set_trip boolean := p_trip is not null;
  v_trip_override boolean := p_trip is not null and p_trip <> 'auto';
  v_trip_id uuid;
begin
  if uid is null then
    raise exception 'save_expense: not signed in' using errcode = '42501';
  end if;

  if coalesce(char_length(v_name), 0) not between 1 and 100
     or p_amount_pence is null or p_amount_pence not between 1 and 1000000000
     or p_date is null
     or char_length(p_account_label) > 50
     or char_length(p_notes) > 500 then
    raise exception 'save_expense: a name (1-100), an amount of 1p to £10m and a date are needed' using errcode = '22023';
  end if;
  if (p_category_id is null) = (p_new_category_name is null) then
    raise exception 'save_expense: choose a category or name a new one' using errcode = '22023';
  end if;
  if p_new_category_name is not null and (
       char_length(btrim(p_new_category_name)) not between 1 and 50
       or p_new_category_kind is null or p_new_category_kind not in ('need', 'want')) then
    raise exception 'save_expense: a new category needs a name (1-50) and need or want' using errcode = '22023';
  end if;
  if p_repeat is not null and (
       p_repeat not in ('weekly', 'fortnightly', 'monthly', 'quarterly', 'annually') or p_id is not null) then
    raise exception 'save_expense: repeat is weekly, fortnightly, monthly, quarterly or annually, on a new expense'
      using errcode = '22023';
  end if;
  if (p_amount_scope is not null and (p_amount_scope not in ('this', 'this_and_future') or p_id is null))
     or coalesce(jsonb_typeof(p_price_updates), '') <> 'array' or jsonb_array_length(p_price_updates) > 1000
     or (jsonb_array_length(p_price_updates) > 0 and p_amount_scope is distinct from 'this_and_future')
     or exists (select 1 from jsonb_array_elements(p_price_updates) as e (value)
                where jsonb_typeof(e.value) <> 'object'
                   or jsonb_typeof(e.value -> 'id') <> 'string'
                   or not private.is_whole_pence(e.value -> 'amount_pence', 1)) then
    raise exception 'save_expense: an amount scope of this or this_and_future, on an existing expense' using errcode = '22023';
  end if;

  if p_trip is not null and p_trip not in ('auto', 'none')
     and p_trip !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then
    raise exception 'save_expense: a trip is auto, none or a trip id' using errcode = '22023';
  end if;
  if v_trip_override and p_trip <> 'none' then
    v_trip_id := p_trip::uuid;
  end if;

  if p_amount_scope = 'this_and_future' then
    select recurring_rule_id into v_rule_id from public.transactions where id = p_id and user_id = uid;
    if not found then
      raise exception 'save_expense: no such expense' using errcode = 'P0002';
    end if;
    if v_rule_id is null then
      raise exception 'save_expense: this expense is not a recurring payment' using errcode = 'PT409';
    end if;
    -- Hold the rule while its price and payments change.
    perform 1 from public.recurring_rules where id = v_rule_id and user_id = uid for update;
  end if;

  if p_new_category_name is not null then
    insert into public.categories (user_id, name, kind)
    values (uid, btrim(p_new_category_name), p_new_category_kind)
    returning id into v_category_id;
  end if;

  if p_id is not null then
    update public.transactions
    set name = v_name, amount_pence = p_amount_pence, date = p_date, category_id = v_category_id,
        fund_id = p_fund_id, account_label = p_account_label, notes = p_notes, unchecked = false,
        trip_override = case when v_set_trip then v_trip_override else trip_override end,
        trip_id = case when v_set_trip then v_trip_id else trip_id end
    where id = p_id and user_id = uid
    returning id into v_id;
    if v_id is null then
      raise exception 'save_expense: no such expense' using errcode = 'P0002';
    end if;

    if p_amount_scope = 'this_and_future' then
      insert into public.recurring_prices (user_id, rule_id, effective_from, amount_pence)
      values (uid, v_rule_id, p_date, p_amount_pence)
      on conflict (user_id, rule_id, effective_from) do update set amount_pence = excluded.amount_pence;

      update public.transactions t
      set amount_pence = u.amount_pence
      from jsonb_to_recordset(p_price_updates) as u (id uuid, amount_pence bigint)
      where t.id = u.id and t.user_id = uid and t.recurring_rule_id = v_rule_id
        and t.date > p_date and t.id <> p_id and t.unchecked;
      get diagnostics v_updated = row_count;
      if v_updated <> jsonb_array_length(p_price_updates) then
        raise exception 'save_expense: a later payment changed meanwhile' using errcode = 'PT409';
      end if;
    end if;
    return v_id;
  end if;

  if p_repeat is not null then
    insert into public.recurring_rules (user_id, name, category_id, fund_id, frequency, anchor_date, generated_through)
    values (uid, left(v_name, 50), v_category_id, p_fund_id, p_repeat, p_date, p_date)
    returning id into v_rule_id;
    insert into public.recurring_prices (user_id, rule_id, effective_from, amount_pence)
    values (uid, v_rule_id, p_date, p_amount_pence);
  end if;

  insert into public.transactions
    (user_id, name, amount_pence, date, category_id, fund_id, account_label, notes, recurring_rule_id, unchecked,
     trip_override, trip_id)
  values (uid, v_name, p_amount_pence, p_date, v_category_id, p_fund_id, p_account_label, p_notes, v_rule_id, false,
          v_trip_override, v_trip_id)
  returning id into v_id;
  return v_id;
end;
$$;

revoke execute on function public.save_expense(text, bigint, date, uuid, uuid, text, text, uuid, text, text, text, text, jsonb, text)
  from public, anon;
grant execute on function public.save_expense(text, bigint, date, uuid, uuid, text, text, uuid, text, text, text, text, jsonb, text)
  to authenticated;

-- Editing the budget after onboarding, atomically.
--
-- Allocations are stored per period and copied at renewal, so an edit changes
-- the current period onward and never a past one. The caller
-- (src/lib/data/budgetEdit.ts) passes the period containing the user's today
-- (from ensureCurrentPeriod) and the end of the period after it (from
-- src/lib/calc and the profile's start day); "the next period" is always the
-- one starting the day after the current one ends.
--
-- Scope 'this' changes the current period and the next one if it already
-- exists. Scope 'next' leaves the current period alone and changes only the
-- next period, creating it now (renew_period, which copies the current one)
-- if needed. ensureCurrentPeriod returns that pre-created period once today
-- reaches it, because it picks the latest period starting on or before today.
--
-- Every function is security invoker (RLS applies to every statement), with
-- an empty search_path, and callable only by signed-in users. Each locks the
-- caller's profile row first, so a user's edits and renewals run one at a time.

-- Category names are unique per user ignoring case (the 0001 key is exact).
create unique index categories_user_id_lower_name_key on public.categories (user_id, lower(name));

-- renew_period: also refuse a period that would overlap a later one (one
-- pre-created by a "From next period" edit). Unchanged otherwise.
create or replace function public.renew_period(p_start date, p_end date)
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

  if exists (select 1 from public.budget_periods
             where user_id = uid and start_date > p_start and start_date <= p_end) then
    raise exception 'renew_period: % to % overlaps a later period', p_start, p_end using errcode = '22023';
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

-- Helpers, in a schema the Data API does not expose. --------------------------

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

-- The periods an edit with this scope changes, after locking the caller's
-- profile: the current period and the next if it exists ('this'), or only the
-- next, created now from the current one if needed ('next').
create function private.edit_targets(p_period_id uuid, p_next_end date, p_scope text)
returns uuid[]
language plpgsql
security invoker
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  current public.budget_periods;
  next_id uuid;
begin
  if uid is null then
    raise exception 'budget edit: not signed in' using errcode = '42501';
  end if;
  if p_scope is null or p_scope not in ('this', 'next') then
    raise exception 'budget edit: scope must be this or next' using errcode = '22023';
  end if;

  perform 1 from public.profiles where user_id = uid for update;

  select * into current from public.budget_periods where id = p_period_id and user_id = uid;
  if not found then
    raise exception 'budget edit: no such period' using errcode = 'P0002';
  end if;

  select id into next_id
  from public.budget_periods
  where user_id = uid and start_date = current.end_date + 1;

  if next_id is null and p_scope = 'next' then
    -- A period is at most 31 days long.
    if p_next_end is null or p_next_end < current.end_date + 1 or p_next_end > current.end_date + 31 then
      raise exception 'budget edit: % is not the end of the next period', p_next_end using errcode = '22023';
    end if;
    select r.id into next_id from public.renew_period(current.end_date + 1, p_next_end) as r;
  end if;

  if p_scope = 'next' then
    return array[next_id];
  end if;
  return array_remove(array[current.id, next_id], null);
end;
$$;

revoke execute on function private.edit_targets(uuid, date, text) from public, anon;
grant execute on function private.edit_targets(uuid, date, text) to authenticated;

-- save_budget ------------------------------------------------------------------
--
-- p_categories: [{"id": uuid | null, "name": text, "kind": "need" | "want",
--                 "amount_pence": int, "removed": bool}]
--
-- The list is the whole budget: in each period changed, the allocations become
-- exactly the rows not removed, so a removed row (or one left out) loses its
-- allocation there. A row with an id renames / re-kinds that category; a row
-- without one creates a category, or brings back one outside the budget with
-- the same name (ignoring case). Refuses (23505) a name another category has.

create function public.save_budget(
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

  targets := private.edit_targets(p_period_id, p_next_end, p_scope);

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
  update public.categories c
  set name = i.name, kind = i.kind
  from jsonb_to_recordset(kept_rows) as i (id uuid, name text, kind text, amount_pence bigint)
  where c.user_id = uid and c.id = i.id and (c.name, c.kind) is distinct from (i.name, i.kind);

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
        update public.categories set name = row_.name, kind = row_.kind where user_id = uid and id = cat_id;
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

revoke execute on function public.save_budget(uuid, date, text, bigint, bigint, jsonb) from public, anon;
grant execute on function public.save_budget(uuid, date, text, bigint, bigint, jsonb) to authenticated;

-- remove_from_budget -------------------------------------------------------------
-- Drops one category's allocation from the periods the scope covers. The
-- category, its past allocations and its spending stay.

create function public.remove_from_budget(p_period_id uuid, p_next_end date, p_scope text, p_category_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  targets uuid[];
begin
  if uid is null then
    raise exception 'remove_from_budget: not signed in' using errcode = '42501';
  end if;
  if not exists (select 1 from public.categories where id = p_category_id and user_id = uid) then
    raise exception 'remove_from_budget: unknown category' using errcode = 'P0002';
  end if;

  targets := private.edit_targets(p_period_id, p_next_end, p_scope);

  delete from public.allocations
  where user_id = uid and category_id = p_category_id and period_id = any (targets);
end;
$$;

revoke execute on function public.remove_from_budget(uuid, date, text, uuid) from public, anon;
grant execute on function public.remove_from_budget(uuid, date, text, uuid) to authenticated;

-- delete_category ------------------------------------------------------------------
-- Deletes a category that was never used, with its allocations. Refuses
-- (PT409) one with any expense or recurring payment: remove it from the
-- budget instead, so past spending keeps its category.

create function public.delete_category(p_category_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
begin
  if uid is null then
    raise exception 'delete_category: not signed in' using errcode = '42501';
  end if;

  perform 1 from public.categories where id = p_category_id and user_id = uid for update;
  if not found then
    raise exception 'delete_category: unknown category' using errcode = 'P0002';
  end if;

  if exists (select 1 from public.transactions where user_id = uid and category_id = p_category_id)
     or exists (select 1 from public.recurring_rules where user_id = uid and category_id = p_category_id) then
    raise exception 'delete_category: the category has expenses' using errcode = 'PT409';
  end if;

  delete from public.allocations where user_id = uid and category_id = p_category_id;
  delete from public.categories where user_id = uid and id = p_category_id;
end;
$$;

revoke execute on function public.delete_category(uuid) from public, anon;
grant execute on function public.delete_category(uuid) to authenticated;

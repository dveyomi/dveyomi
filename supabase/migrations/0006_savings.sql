-- Savings: moving a period's savings into funds, atomically.
--
-- confirm_savings_split(period, date, split) confirms the period's waiting
-- savings prompt: it writes one 'contribution' per fund given more than £0,
-- dated p_date (the user's today, worked out by the caller,
-- src/lib/data/funds.ts), creates any new funds the split names first, and
-- marks the prompt 'confirmed' with split = {fund_id: amount_pence} (the
-- shape complete_onboarding writes; funds given £0 are left out).
--
-- It refuses, writing nothing:
--   42501  not signed in
--   P0002  the period has no savings prompt
--   PT409  the prompt is already confirmed (a second confirm creates nothing)
--   PT422  the split's total is not the period's CURRENT savings_pence
--          (save_budget may have changed it since the prompt was made)
--   PT404  a fund that is not the caller's
--   22023  a malformed split: not an array of 1-20 lines, a line with both
--          or neither of fund_id / new_name, a fund listed twice, an amount
--          that is not £0-£10m, a blank or over-long new name, a bad target,
--          a missing date, or a period that has not started by p_date
--   23505  a new fund's name is taken (funds are unique by name, ignoring case)
--
-- Like the 0005 functions it locks the caller's profile row first, so it runs
-- one at a time with save_budget and renewals, then locks the prompt row.
--
-- p_split: [{"fund_id": uuid, "amount_pence": int}
--           | {"new_name": text, "new_target_pence": int | null, "amount_pence": int}]

-- Fund names are unique per user, ignoring case (onboarding already refuses duplicates).
create unique index funds_user_id_lower_name_key on public.funds (user_id, lower(name));

-- A note on a fund movement is short free text.
alter table public.fund_movements
  add constraint fund_movements_note_length check (note is null or char_length(note) between 1 and 200);

-- Whether a JSON value is a whole number of pence from p_min to £10m.
create function private.is_whole_pence(p_value jsonb, p_min bigint)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case
    when jsonb_typeof(p_value) is distinct from 'number' then false
    else (p_value::text)::numeric between p_min and 1000000000
         and (p_value::text)::numeric = trunc((p_value::text)::numeric)
  end;
$$;

revoke execute on function private.is_whole_pence(jsonb, bigint) from public, anon;
grant execute on function private.is_whole_pence(jsonb, bigint) to authenticated;

create function public.confirm_savings_split(p_period_id uuid, p_date date, p_split jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  v_prompt public.savings_prompts;
  v_period public.budget_periods;
  v_line record;
  v_fund_id uuid;
  v_fund_ids uuid[] := '{}';
  v_amounts bigint[] := '{}';
begin
  if uid is null then
    raise exception 'confirm_savings_split: not signed in' using errcode = '42501';
  end if;

  if p_date is null or coalesce(jsonb_typeof(p_split), '') <> 'array' then
    raise exception 'confirm_savings_split: a date and 1 to 20 split lines are needed' using errcode = '22023';
  end if;
  if jsonb_array_length(p_split) not between 1 and 20
     or exists (select 1 from jsonb_array_elements(p_split) as e (value) where jsonb_typeof(e.value) <> 'object') then
    raise exception 'confirm_savings_split: a date and 1 to 20 split lines are needed' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_split) as e (value)
    where not private.is_whole_pence(e.value -> 'amount_pence', 0)
       or ((e.value ? 'fund_id') = (e.value ? 'new_name'))
       or (e.value ? 'fund_id' and jsonb_typeof(e.value -> 'fund_id') <> 'string')
       or (e.value ? 'new_name' and (
             jsonb_typeof(e.value -> 'new_name') <> 'string'
             or char_length(btrim(e.value ->> 'new_name')) not between 1 and 50))
       or (jsonb_typeof(e.value -> 'new_target_pence') <> 'null'
           and not private.is_whole_pence(e.value -> 'new_target_pence', 1))
  ) then
    raise exception 'confirm_savings_split: each line is a fund or a new fund with an amount of £0 to £10m'
      using errcode = '22023';
  end if;

  if (select count(*) <> count(distinct e.value ->> 'fund_id')
      from jsonb_array_elements(p_split) as e (value) where e.value ? 'fund_id')
     or (select count(*) <> count(distinct lower(btrim(e.value ->> 'new_name')))
         from jsonb_array_elements(p_split) as e (value) where e.value ? 'new_name') then
    raise exception 'confirm_savings_split: a fund appears twice' using errcode = '22023';
  end if;

  -- Serialise with save_budget and renewals, then hold the prompt.
  perform 1 from public.profiles where user_id = uid for update;

  select * into v_prompt
  from public.savings_prompts
  where user_id = uid and period_id = p_period_id
  for update;
  if not found then
    raise exception 'confirm_savings_split: no savings to move for this period' using errcode = 'P0002';
  end if;
  if v_prompt.status <> 'waiting' then
    raise exception 'confirm_savings_split: these savings have already been moved' using errcode = 'PT409';
  end if;

  select * into v_period from public.budget_periods where user_id = uid and id = p_period_id;
  if v_period.start_date > p_date then
    raise exception 'confirm_savings_split: the period has not started yet' using errcode = '22023';
  end if;

  if (select sum((e.value ->> 'amount_pence')::bigint) from jsonb_array_elements(p_split) as e (value))
     <> v_period.savings_pence then
    raise exception 'confirm_savings_split: the split must add up to the savings (%)', v_period.savings_pence
      using errcode = 'PT422';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_split) as e (value)
    where e.value ? 'fund_id'
      and not exists (select 1 from public.funds f
                      where f.user_id = uid and f.id::text = e.value ->> 'fund_id')
  ) then
    raise exception 'confirm_savings_split: unknown fund' using errcode = 'PT404';
  end if;

  for v_line in
    select e.value, e.ord from jsonb_array_elements(p_split) with ordinality as e (value, ord) order by e.ord
  loop
    if v_line.value ? 'fund_id' then
      v_fund_id := (v_line.value ->> 'fund_id')::uuid;
    else
      insert into public.funds (user_id, name, target_pence)
      values (uid, btrim(v_line.value ->> 'new_name'), (v_line.value ->> 'new_target_pence')::bigint)
      returning id into v_fund_id;
    end if;
    if (v_line.value ->> 'amount_pence')::bigint > 0 then
      v_fund_ids := v_fund_ids || v_fund_id;
      v_amounts := v_amounts || (v_line.value ->> 'amount_pence')::bigint;
    end if;
  end loop;

  insert into public.fund_movements (user_id, fund_id, date, kind, amount_pence)
  select uid, m.fund_id, p_date, 'contribution', m.amount
  from unnest(v_fund_ids, v_amounts) as m (fund_id, amount);

  update public.savings_prompts
  set status = 'confirmed',
      split = coalesce((select jsonb_object_agg(m.fund_id, m.amount)
                        from unnest(v_fund_ids, v_amounts) as m (fund_id, amount)), '{}'::jsonb)
  where user_id = uid and period_id = p_period_id;
end;
$$;

revoke execute on function public.confirm_savings_split(uuid, date, jsonb) from public, anon;
grant execute on function public.confirm_savings_split(uuid, date, jsonb) to authenticated;

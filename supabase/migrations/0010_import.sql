-- CSV import (Task 20).
--
-- import_expenses saves one import, all or nothing: an import_batches row
-- (the file's name) and its expenses, each with source 'csv', the batch id,
-- no external id, and checked. undo_import removes one import: its expenses
-- and its batch, together. Both run as the caller, so RLS and the composite
-- foreign keys keep every row (and every category) to the signed-in user.
-- The browser parses the file; the server action checks the rows again and
-- passes the user's today; this function checks the bounds once more.

-- import_expenses ---------------------------------------------------------------
-- p_rows: a JSON array of 1 to 5,000 objects
--   { "name": text 1-100 (trimmed), "amount_pence": whole pence 1 to 1e9,
--     "date": "YYYY-MM-DD", "category_id": uuid of the caller's category }.
-- p_today: the user's today (within a day of the server's, for time zones);
-- dates may be from 10 years before it to a year after it (expenseDateRange).
-- Returns { "batch_id": uuid, "inserted": int }.
create function public.import_expenses(p_filename text, p_today date, p_rows jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  v_batch_id uuid;
  v_inserted int;
begin
  if uid is null then
    raise exception 'import_expenses: not signed in' using errcode = '42501';
  end if;

  if coalesce(char_length(btrim(p_filename)), 0) not between 1 and 255
     or p_today is null or p_today not between current_date - 1 and current_date + 1
     or coalesce(jsonb_typeof(p_rows), '') <> 'array'
     or jsonb_array_length(p_rows) not between 1 and 5000 then
    raise exception 'import_expenses: a file name (1-255), today and 1 to 5,000 rows are needed' using errcode = '22023';
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_rows) as e (value)
    where jsonb_typeof(e.value) is distinct from 'object'
       or jsonb_typeof(e.value -> 'name') is distinct from 'string'
       or coalesce(char_length(btrim(e.value ->> 'name')), 0) not between 1 and 100
       or not coalesce(private.is_whole_pence(e.value -> 'amount_pence', 1), false)
       or jsonb_typeof(e.value -> 'date') is distinct from 'string'
       or coalesce((e.value ->> 'date') !~ '^\d{4}-\d{2}-\d{2}$', true)
       or jsonb_typeof(e.value -> 'category_id') is distinct from 'string'
       or coalesce((e.value ->> 'category_id') !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$', true)
  ) then
    raise exception 'import_expenses: each row needs a name (1-100), an amount of 1p to £10m, a YYYY-MM-DD date and a category'
      using errcode = '22023';
  end if;

  -- Real dates only (2026-02-31 raises 22008), within the expense date range.
  if exists (
    select 1 from jsonb_array_elements(p_rows) as e (value)
    where (e.value ->> 'date')::date not between (p_today - interval '10 years')::date and (p_today + interval '1 year')::date
  ) then
    raise exception 'import_expenses: dates must be within the last 10 years or the next 12 months' using errcode = '22023';
  end if;

  insert into public.import_batches (filename) values (btrim(p_filename)) returning id into v_batch_id;

  -- A category that isn't the caller's fails the composite foreign key (23503)
  -- and nothing, batch included, is saved.
  insert into public.transactions (name, amount_pence, date, category_id, source, external_id, import_batch_id, unchecked)
  select btrim(e.value ->> 'name'), (e.value ->> 'amount_pence')::bigint, (e.value ->> 'date')::date,
         (e.value ->> 'category_id')::uuid, 'csv', null, v_batch_id, false
  from jsonb_array_elements(p_rows) as e (value);
  get diagnostics v_inserted = row_count;

  return jsonb_build_object('batch_id', v_batch_id, 'inserted', v_inserted);
end;
$$;

revoke execute on function public.import_expenses(text, date, jsonb) from public, anon;
grant execute on function public.import_expenses(text, date, jsonb) to authenticated;

-- undo_import -------------------------------------------------------------------
-- Deletes one of the caller's imports: its expenses, then the batch. Raises
-- P0002 for an unknown batch or another user's (RLS hides it). Returns how many
-- expenses went.
create function public.undo_import(p_batch_id uuid)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  v_deleted int;
begin
  if uid is null then
    raise exception 'undo_import: not signed in' using errcode = '42501';
  end if;

  perform 1 from public.import_batches where id = p_batch_id and user_id = uid for update;
  if not found then
    raise exception 'undo_import: no such import' using errcode = 'P0002';
  end if;

  delete from public.transactions where import_batch_id = p_batch_id and user_id = uid;
  get diagnostics v_deleted = row_count;
  delete from public.import_batches where id = p_batch_id and user_id = uid;
  return v_deleted;
end;
$$;

revoke execute on function public.undo_import(uuid) from public, anon;
grant execute on function public.undo_import(uuid) to authenticated;

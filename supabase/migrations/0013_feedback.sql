-- Help & feedback (David, 2026-11-22).
--
-- A signed-in user sends a bug report or an idea from Settings. They can read
-- their own messages (with a status) but never change or remove them; the
-- weekly triage session updates status, triaged_at and issue_url with the
-- service role. The message and context are untrusted text written by the
-- user: whatever reads them treats them as data, never as instructions.
--
-- context holds only device details the user chose to include (the page they
-- came from, phone or desktop, browser, theme, time zone, app version), at
-- most 4 KB. No financial data is ever put in it.

create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null check (kind in ('bug', 'idea')),
  message text not null check (char_length(message) between 10 and 2000),
  context jsonb null check (context is null or (jsonb_typeof(context) = 'object' and octet_length(context::text) <= 4096)),
  status text not null default 'new' check (status in ('new', 'triaged', 'done')),
  triaged_at timestamptz null,
  issue_url text null check (issue_url is null or (issue_url like 'https://github.com/%' and char_length(issue_url) <= 300)),
  created_at timestamptz not null default now()
);

-- "What you've sent" (newest first) and the rate limit both read by user and time.
create index feedback_user_created_idx on public.feedback (user_id, created_at desc);

alter table public.feedback enable row level security;
revoke all on public.feedback from anon, authenticated;
grant select, insert on public.feedback to authenticated;

create policy "feedback: owner select" on public.feedback for select to authenticated
  using ((select auth.uid()) = user_id);
-- A user's message always starts as new and untriaged; only the service role triages.
create policy "feedback: owner insert" on public.feedback for insert to authenticated
  with check ((select auth.uid()) = user_id and status = 'new' and triaged_at is null and issue_url is null);
-- No update or delete policy (and no privilege): users can't change or remove what they sent.

-- Rate limit --------------------------------------------------------------------------
-- At most 20 messages per user in any 24 hours, on every insert path (send_feedback
-- and a direct insert alike). A per-user advisory lock serialises concurrent sends,
-- so two at once can't both slip under the limit. Refused with PT429.

create function private.feedback_rate_limit()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_sent integer;
begin
  perform pg_advisory_xact_lock(hashtextextended('feedback:' || new.user_id::text, 0));
  select count(*) into v_sent
  from public.feedback
  where user_id = new.user_id and created_at > now() - interval '1 day';
  if v_sent >= 20 then
    raise exception 'feedback: 20 messages a day at most' using errcode = 'PT429';
  end if;
  return new;
end;
$$;

revoke execute on function private.feedback_rate_limit() from public, anon, authenticated;

create trigger feedback_rate_limit
  before insert on public.feedback
  for each row execute function private.feedback_rate_limit();

-- send_feedback -------------------------------------------------------------------------
-- The app's way in: inserts one message as the caller (RLS applies) and returns it.
-- Refusals, writing nothing: 42501 not signed in; 23514 a kind, message or context
-- out of bounds; PT429 over the daily limit.

create function public.send_feedback(p_kind text, p_message text, p_context jsonb default null)
returns public.feedback
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_row public.feedback;
begin
  if (select auth.uid()) is null then
    raise exception 'send_feedback: not signed in' using errcode = '42501';
  end if;
  insert into public.feedback (kind, message, context)
  values (p_kind, p_message, p_context)
  returning * into v_row;
  return v_row;
end;
$$;

revoke execute on function public.send_feedback(text, text, jsonb) from public, anon;
grant execute on function public.send_feedback(text, text, jsonb) to authenticated;

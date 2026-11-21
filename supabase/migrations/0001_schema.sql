-- Personal Finance OS schema.
--
-- Every table is per-user: user_id defaults to the signed-in user and cascades
-- from auth.users. Every table with an id also has unique (id, user_id), and
-- every cross-table reference is a composite foreign key (x_id, user_id), so a
-- row can never point at another user's row. Nullable references use MATCH
-- SIMPLE (the default), so a null x_id is allowed. Natural unique keys lead
-- with user_id, so a cross-user insert fails on the foreign key rather than
-- revealing that another user's row exists.
--
-- Money is integer pence (bigint). Calendar dates are `date`.

-- profiles -------------------------------------------------------------------

create table public.profiles (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  -- Home zone: detected from the device once, at first sign-in, then edited in Settings.
  -- Travelling changes only "today" (the tz cookie), never this.
  timezone text not null default 'Europe/London',
  timezone_detected boolean not null default false,
  currency text not null default 'GBP',
  budget_start_day int not null check (budget_start_day between 1 and 31)
);

-- Creates the profile row when a user signs up.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id, budget_start_day) values (new.id, 1);
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- categories -----------------------------------------------------------------

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  kind text not null check (kind in ('need', 'want')),
  icon text,
  colour text,
  unique (id, user_id),
  unique (user_id, name)
);

-- budget periods and allocations ---------------------------------------------

create table public.budget_periods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  start_date date not null,
  end_date date not null,
  income_pence bigint not null check (income_pence >= 0),
  savings_pence bigint not null check (savings_pence >= 0),
  unassigned_carry_pence bigint not null default 0,
  check (end_date >= start_date),
  unique (id, user_id),
  unique (user_id, start_date)
);

create table public.allocations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  period_id uuid not null,
  category_id uuid not null,
  amount_pence bigint not null check (amount_pence >= 0),
  unique (id, user_id),
  unique (user_id, period_id, category_id),
  foreign key (period_id, user_id) references public.budget_periods (id, user_id) on delete cascade,
  foreign key (category_id, user_id) references public.categories (id, user_id)
);

-- savings funds --------------------------------------------------------------

create table public.funds (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  opening_pence bigint not null default 0 check (opening_pence >= 0),
  target_pence bigint check (target_pence >= 0),
  target_date date,
  unique (id, user_id)
);

create table public.fund_movements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  fund_id uuid not null,
  date date not null,
  kind text not null check (kind in ('contribution', 'withdrawal')),
  amount_pence bigint not null check (amount_pence > 0),
  note text,
  unique (id, user_id),
  foreign key (fund_id, user_id) references public.funds (id, user_id) on delete cascade
);

-- one savings prompt per period
create table public.savings_prompts (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  period_id uuid not null,
  status text not null check (status in ('waiting', 'confirmed')),
  split jsonb not null default '{}'::jsonb,
  primary key (user_id, period_id),
  foreign key (period_id, user_id) references public.budget_periods (id, user_id) on delete cascade
);

-- one leftover decision per period
create table public.leftover_movements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  period_id uuid not null,
  destination text not null check (destination in ('fund', 'next_period', 'unassigned')),
  fund_id uuid,
  amount_pence bigint not null check (amount_pence > 0),
  check ((destination = 'fund') = (fund_id is not null)),
  unique (id, user_id),
  unique (user_id, period_id),
  foreign key (period_id, user_id) references public.budget_periods (id, user_id) on delete cascade,
  foreign key (fund_id, user_id) references public.funds (id, user_id)
);

-- trips ----------------------------------------------------------------------

create table public.trips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  place text,
  start_date date not null,
  end_date date not null,
  check (end_date >= start_date),
  unique (id, user_id)
);

-- recurring payments ---------------------------------------------------------

create table public.recurring_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  category_id uuid not null,
  fund_id uuid,
  frequency text not null check (frequency in ('weekly', 'fortnightly', 'monthly', 'quarterly', 'annually')),
  anchor_date date not null,
  end_date date,
  paused_until date,
  skipped_dates date[] not null default '{}',
  unique (id, user_id),
  foreign key (category_id, user_id) references public.categories (id, user_id),
  foreign key (fund_id, user_id) references public.funds (id, user_id)
);

create table public.recurring_prices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  rule_id uuid not null,
  effective_from date not null,
  amount_pence bigint not null check (amount_pence >= 0),
  unique (id, user_id),
  unique (user_id, rule_id, effective_from),
  foreign key (rule_id, user_id) references public.recurring_rules (id, user_id) on delete cascade
);

-- imports and transactions ---------------------------------------------------

create table public.import_batches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  filename text not null,
  created_at timestamptz not null default now(),
  unique (id, user_id)
);

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  amount_pence bigint not null check (amount_pence > 0),
  date date not null,
  category_id uuid not null,
  fund_id uuid,
  account_label text,
  notes text,
  trip_id uuid,
  trip_override boolean not null default false,
  recurring_rule_id uuid,
  unchecked boolean not null default false,
  source text not null default 'manual',
  external_id text,
  import_batch_id uuid,
  unique (id, user_id),
  foreign key (category_id, user_id) references public.categories (id, user_id),
  foreign key (fund_id, user_id) references public.funds (id, user_id),
  foreign key (trip_id, user_id) references public.trips (id, user_id),
  foreign key (recurring_rule_id, user_id) references public.recurring_rules (id, user_id),
  foreign key (import_batch_id, user_id) references public.import_batches (id, user_id)
);

-- a recurring payment is recorded at most once per due date
create unique index transactions_recurring_rule_date_key
  on public.transactions (user_id, recurring_rule_id, date)
  where recurring_rule_id is not null;

-- indexes --------------------------------------------------------------------
-- user_id for RLS filtering and each composite foreign key for joins and
-- referential checks, except where a primary key or unique constraint above
-- already covers the same columns.

create index allocations_category_idx on public.allocations (category_id, user_id);

create index funds_user_id_idx on public.funds (user_id);

create index fund_movements_user_id_idx on public.fund_movements (user_id);
create index fund_movements_fund_idx on public.fund_movements (fund_id, user_id);

create index leftover_movements_fund_idx on public.leftover_movements (fund_id, user_id);

create index trips_user_id_idx on public.trips (user_id);

create index recurring_rules_user_id_idx on public.recurring_rules (user_id);
create index recurring_rules_category_idx on public.recurring_rules (category_id, user_id);
create index recurring_rules_fund_idx on public.recurring_rules (fund_id, user_id);

create index import_batches_user_id_idx on public.import_batches (user_id);

create index transactions_user_id_date_idx on public.transactions (user_id, date);
create index transactions_category_idx on public.transactions (category_id, user_id);
create index transactions_fund_idx on public.transactions (fund_id, user_id);
create index transactions_trip_idx on public.transactions (trip_id, user_id);
create index transactions_recurring_rule_idx on public.transactions (recurring_rule_id, user_id);
create index transactions_import_batch_idx on public.transactions (import_batch_id, user_id);

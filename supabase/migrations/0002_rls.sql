-- Row-level security: every table is readable and writable only by its owner.
--
-- Each table gets RLS plus separate select/insert/update/delete policies for
-- the authenticated role, keyed on (select auth.uid()) = user_id (the subselect
-- lets Postgres evaluate auth.uid() once per statement). Insert and update use
-- `with check`, so a row cannot be created for, or moved to, another user.
--
-- Privileges are reset per table (Supabase's default grants include TRUNCATE,
-- REFERENCES and TRIGGER): anon gets nothing and authenticated gets only the
-- statements it has policies for.
--
-- profiles has no delete grant or policy: a profile goes only with its account,
-- which is deleted with the service role.

-- profiles
alter table public.profiles enable row level security;
revoke all on public.profiles from anon, authenticated;
grant select, insert, update on public.profiles to authenticated;

create policy "profiles: owner select" on public.profiles for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "profiles: owner insert" on public.profiles for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "profiles: owner update" on public.profiles for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- categories
alter table public.categories enable row level security;
revoke all on public.categories from anon, authenticated;
grant select, insert, update, delete on public.categories to authenticated;

create policy "categories: owner select" on public.categories for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "categories: owner insert" on public.categories for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "categories: owner update" on public.categories for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "categories: owner delete" on public.categories for delete to authenticated
  using ((select auth.uid()) = user_id);

-- budget_periods
alter table public.budget_periods enable row level security;
revoke all on public.budget_periods from anon, authenticated;
grant select, insert, update, delete on public.budget_periods to authenticated;

create policy "budget_periods: owner select" on public.budget_periods for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "budget_periods: owner insert" on public.budget_periods for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "budget_periods: owner update" on public.budget_periods for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "budget_periods: owner delete" on public.budget_periods for delete to authenticated
  using ((select auth.uid()) = user_id);

-- allocations
alter table public.allocations enable row level security;
revoke all on public.allocations from anon, authenticated;
grant select, insert, update, delete on public.allocations to authenticated;

create policy "allocations: owner select" on public.allocations for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "allocations: owner insert" on public.allocations for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "allocations: owner update" on public.allocations for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "allocations: owner delete" on public.allocations for delete to authenticated
  using ((select auth.uid()) = user_id);

-- funds
alter table public.funds enable row level security;
revoke all on public.funds from anon, authenticated;
grant select, insert, update, delete on public.funds to authenticated;

create policy "funds: owner select" on public.funds for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "funds: owner insert" on public.funds for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "funds: owner update" on public.funds for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "funds: owner delete" on public.funds for delete to authenticated
  using ((select auth.uid()) = user_id);

-- fund_movements
alter table public.fund_movements enable row level security;
revoke all on public.fund_movements from anon, authenticated;
grant select, insert, update, delete on public.fund_movements to authenticated;

create policy "fund_movements: owner select" on public.fund_movements for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "fund_movements: owner insert" on public.fund_movements for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "fund_movements: owner update" on public.fund_movements for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "fund_movements: owner delete" on public.fund_movements for delete to authenticated
  using ((select auth.uid()) = user_id);

-- savings_prompts
alter table public.savings_prompts enable row level security;
revoke all on public.savings_prompts from anon, authenticated;
grant select, insert, update, delete on public.savings_prompts to authenticated;

create policy "savings_prompts: owner select" on public.savings_prompts for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "savings_prompts: owner insert" on public.savings_prompts for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "savings_prompts: owner update" on public.savings_prompts for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "savings_prompts: owner delete" on public.savings_prompts for delete to authenticated
  using ((select auth.uid()) = user_id);

-- leftover_movements
alter table public.leftover_movements enable row level security;
revoke all on public.leftover_movements from anon, authenticated;
grant select, insert, update, delete on public.leftover_movements to authenticated;

create policy "leftover_movements: owner select" on public.leftover_movements for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "leftover_movements: owner insert" on public.leftover_movements for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "leftover_movements: owner update" on public.leftover_movements for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "leftover_movements: owner delete" on public.leftover_movements for delete to authenticated
  using ((select auth.uid()) = user_id);

-- trips
alter table public.trips enable row level security;
revoke all on public.trips from anon, authenticated;
grant select, insert, update, delete on public.trips to authenticated;

create policy "trips: owner select" on public.trips for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "trips: owner insert" on public.trips for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "trips: owner update" on public.trips for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "trips: owner delete" on public.trips for delete to authenticated
  using ((select auth.uid()) = user_id);

-- recurring_rules
alter table public.recurring_rules enable row level security;
revoke all on public.recurring_rules from anon, authenticated;
grant select, insert, update, delete on public.recurring_rules to authenticated;

create policy "recurring_rules: owner select" on public.recurring_rules for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "recurring_rules: owner insert" on public.recurring_rules for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "recurring_rules: owner update" on public.recurring_rules for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "recurring_rules: owner delete" on public.recurring_rules for delete to authenticated
  using ((select auth.uid()) = user_id);

-- recurring_prices
alter table public.recurring_prices enable row level security;
revoke all on public.recurring_prices from anon, authenticated;
grant select, insert, update, delete on public.recurring_prices to authenticated;

create policy "recurring_prices: owner select" on public.recurring_prices for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "recurring_prices: owner insert" on public.recurring_prices for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "recurring_prices: owner update" on public.recurring_prices for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "recurring_prices: owner delete" on public.recurring_prices for delete to authenticated
  using ((select auth.uid()) = user_id);

-- import_batches
alter table public.import_batches enable row level security;
revoke all on public.import_batches from anon, authenticated;
grant select, insert, update, delete on public.import_batches to authenticated;

create policy "import_batches: owner select" on public.import_batches for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "import_batches: owner insert" on public.import_batches for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "import_batches: owner update" on public.import_batches for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "import_batches: owner delete" on public.import_batches for delete to authenticated
  using ((select auth.uid()) = user_id);

-- transactions
alter table public.transactions enable row level security;
revoke all on public.transactions from anon, authenticated;
grant select, insert, update, delete on public.transactions to authenticated;

create policy "transactions: owner select" on public.transactions for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "transactions: owner insert" on public.transactions for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "transactions: owner update" on public.transactions for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "transactions: owner delete" on public.transactions for delete to authenticated
  using ((select auth.uid()) = user_id);

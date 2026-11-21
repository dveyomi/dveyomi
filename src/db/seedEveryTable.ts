import { admin, queryAsPostgres } from "./testClients";

/** Every public table that holds a user's rows (has a user_id column), from the catalog, sorted. */
export function userTablesInSchema(): string[] {
  return queryAsPostgres<{ table_name: string }>(
    `select c.table_name from information_schema.columns c
       join information_schema.tables t using (table_schema, table_name)
      where c.table_schema = 'public' and c.column_name = 'user_id' and t.table_type = 'BASE TABLE'
      order by c.table_name`,
  ).map((r) => r.table_name);
}

type Row = Record<string, unknown>;

async function insert(table: string, rows: Row | Row[]): Promise<{ id: string }[]> {
  const { data, error } = await admin.from(table).insert(rows as never).select();
  if (error) throw new Error(`seeding ${table} failed: ${error.message}`);
  return data as { id: string }[];
}

/**
 * Gives `userId` at least one row in every user table (as the service role,
 * so no grant gets in the way): a November budget with allocations, a fund
 * with a movement, a savings prompt and a leftover decision, a trip with an
 * expense added to it by hand and one taken out of it (manual overrides), a
 * recurring rule with a price and an occurrence, an import with an imported
 * expense, and a dismissed detection. `extraTransactions` adds that many more
 * plain expenses.
 */
export async function seedEveryTable(userId: string, extraTransactions = 0): Promise<void> {
  const user_id = userId;
  const [cat] = await insert("categories", { user_id, name: "Groceries", kind: "need" });
  const [period] = await insert("budget_periods", {
    user_id,
    start_date: "2026-11-01",
    end_date: "2026-11-30",
    income_pence: 300000,
    savings_pence: 50000,
  });
  await insert("allocations", { user_id, period_id: period.id, category_id: cat.id, amount_pence: 40000 });
  const [fund] = await insert("funds", { user_id, name: "Holiday" });
  await insert("fund_movements", { user_id, fund_id: fund.id, date: "2026-11-02", kind: "contribution", amount_pence: 5000 });
  await insert("savings_prompts", { user_id, period_id: period.id, status: "waiting" });
  await insert("leftover_movements", {
    user_id,
    period_id: period.id,
    destination: "fund",
    fund_id: fund.id,
    amount_pence: 1000,
  });
  const [trip] = await insert("trips", { user_id, name: "Lisbon", place: "Lisbon", start_date: "2026-11-10", end_date: "2026-11-14" });
  const [rule] = await insert("recurring_rules", {
    user_id,
    name: "Rent",
    category_id: cat.id,
    frequency: "monthly",
    anchor_date: "2026-11-01",
  });
  await insert("recurring_prices", { user_id, rule_id: rule.id, effective_from: "2026-11-01", amount_pence: 90000 });
  const [batch] = await insert("import_batches", { user_id, filename: "bank.csv" });
  await insert("recurring_dismissals", { user_id, name_key: "netflix" });

  const txn = (over: Record<string, unknown>) => ({
    user_id,
    name: "Tesco",
    amount_pence: 1250,
    date: "2026-11-05",
    category_id: cat.id,
    // A bulk insert sends every row the same columns, so spell out the defaults.
    source: "manual",
    trip_override: false,
    trip_id: null,
    recurring_rule_id: null,
    import_batch_id: null,
    fund_id: null,
    ...over,
  });
  await insert("transactions", [
    txn({ name: "Airport taxi", date: "2026-11-09", trip_override: true, trip_id: trip.id }), // added to the trip by hand
    txn({ name: "Groceries at home", date: "2026-11-12", trip_override: true, trip_id: null }), // taken out of it
    txn({ name: "Rent", amount_pence: 90000, date: "2026-11-01", recurring_rule_id: rule.id }),
    txn({ name: "Pret", amount_pence: 499, source: "csv", import_batch_id: batch.id }),
    txn({ name: "Train", fund_id: fund.id }),
  ]);
  for (let done = 0; done < extraTransactions; done += 500) {
    const n = Math.min(500, extraTransactions - done);
    await insert(
      "transactions",
      Array.from({ length: n }, (_, i) => txn({ name: `Coffee ${done + i + 1}`, amount_pence: 300 })),
    );
  }
}

/** How many rows `userId` has in `table`, counted as the service role. */
export async function countRows(table: string, userId: string): Promise<number> {
  const { count, error } = await admin.from(table).select("user_id", { count: "exact", head: true }).eq("user_id", userId);
  if (error) throw new Error(`counting ${table} failed: ${error.message}`);
  return count ?? 0;
}

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createSignedInUser, deleteUser, queryAsPostgres, type TestUser } from "./testClients";

type Row = { id: string };

async function insertOne(user: TestUser, table: string, values: Record<string, unknown>): Promise<Row> {
  const { data, error } = await user.client.from(table).insert(values).select("id").single();
  if (error) throw new Error(`insert into ${table} failed: ${error.message}`);
  return data as Row;
}

let a: TestUser;
let b: TestUser;
// A's rows
let catA: Row;
let fundA: Row;
let tripA: Row;
let ruleA: Row;
let txnA: Row;
let periodA: Row;
// B's own category, so each cross-user insert below has exactly one foreign reference
let catB: Row;

beforeAll(async () => {
  a = await createSignedInUser("a");
  b = await createSignedInUser("b");

  catA = await insertOne(a, "categories", { name: "Groceries", kind: "need" });
  fundA = await insertOne(a, "funds", { name: "Holiday" });
  tripA = await insertOne(a, "trips", {
    name: "Lisbon",
    place: "Lisbon",
    start_date: "2026-06-01",
    end_date: "2026-06-07",
  });
  ruleA = await insertOne(a, "recurring_rules", {
    name: "Rent",
    category_id: catA.id,
    frequency: "monthly",
    anchor_date: "2026-01-01",
  });
  txnA = await insertOne(a, "transactions", {
    name: "Tesco",
    amount_pence: 1234,
    date: "2026-11-20",
    category_id: catA.id,
  });
  periodA = await insertOne(a, "budget_periods", {
    start_date: "2026-11-01",
    end_date: "2026-11-30",
    income_pence: 300000,
    savings_pence: 50000,
  });
  catB = await insertOne(b, "categories", { name: "Groceries", kind: "need" });
});

afterAll(async () => {
  await deleteUser(a);
  await deleteUser(b);
});

describe("profiles", () => {
  it("are created on sign-up with budget_start_day 1 and visible only to their owner", async () => {
    const own = await a.client.from("profiles").select("user_id, budget_start_day, timezone, currency");
    expect(own.error).toBeNull();
    expect(own.data).toEqual([
      { user_id: a.id, budget_start_day: 1, timezone: "Europe/London", currency: "GBP" },
    ]);
  });

  it("cannot be deleted by their owner", async () => {
    const { error } = await a.client.from("profiles").delete().eq("user_id", a.id);
    expect(error?.code).toBe("42501"); // no delete privilege
    const check = await a.client.from("profiles").select("user_id");
    expect(check.data).toHaveLength(1);
  });
});

describe("row-level security", () => {
  const idOf = (table: string) =>
    ({ transactions: txnA.id, funds: fundA.id, categories: catA.id })[table] as string;

  it.each(["transactions", "funds", "categories"])("A can read their own %s", async (table) => {
    const { data, error } = await a.client.from(table).select("id").eq("id", idOf(table));
    expect(error).toBeNull();
    expect(data).toEqual([{ id: idOf(table) }]);
  });

  it.each(["transactions", "funds", "categories"])("B selecting A's %s gets zero rows", async (table) => {
    const { data, error } = await b.client.from(table).select("id").eq("id", idOf(table));
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("B updating A's transaction affects zero rows", async () => {
    const { data, error } = await b.client
      .from("transactions")
      .update({ amount_pence: 1 })
      .eq("id", txnA.id)
      .select("id");
    expect(error).toBeNull();
    expect(data).toEqual([]);

    const check = await a.client.from("transactions").select("amount_pence").eq("id", txnA.id).single();
    expect(check.data).toEqual({ amount_pence: 1234 });
  });

  it("B deleting A's transaction affects zero rows", async () => {
    const { data, error } = await b.client.from("transactions").delete().eq("id", txnA.id).select("id");
    expect(error).toBeNull();
    expect(data).toEqual([]);

    const check = await a.client.from("transactions").select("id").eq("id", txnA.id);
    expect(check.data).toHaveLength(1);
  });

  it("B cannot insert a row owned by A", async () => {
    const { error } = await b.client.from("funds").insert({ name: "Sneaky", user_id: a.id });
    expect(error?.code).toBe("42501"); // RLS with check violation
  });

  it("A cannot move their own row to B", async () => {
    const { error } = await a.client.from("funds").update({ user_id: b.id }).eq("id", fundA.id);
    expect(error?.code).toBe("42501");
  });
});

describe("composite foreign keys", () => {
  const base = () => ({ name: "Coffee", amount_pence: 350, date: "2026-11-20", category_id: catB.id });

  it("B inserting a transaction with A's category errors", async () => {
    const { error } = await b.client.from("transactions").insert({ ...base(), category_id: catA.id });
    expect(error?.code).toBe("23503");
  });

  it.each([
    ["fund_id", () => fundA.id],
    ["trip_id", () => tripA.id],
    ["recurring_rule_id", () => ruleA.id],
  ])("B inserting a transaction with A's %s errors", async (column, id) => {
    // A trip_id needs trip_override (0009's check), so the foreign key is what refuses it.
    const extra = column === "trip_id" ? { trip_override: true } : {};
    const { error } = await b.client.from("transactions").insert({ ...base(), ...extra, [column]: id() });
    expect(error?.code).toBe("23503");
  });

  it("B inserting a savings prompt for A's period errors on the foreign key, not A's unique key", async () => {
    const own = await a.client.from("savings_prompts").insert({ period_id: periodA.id, status: "waiting" });
    expect(own.error).toBeNull();
    // A unique violation (23505) here would reveal that A's period has a prompt.
    const { error } = await b.client.from("savings_prompts").insert({ period_id: periodA.id, status: "waiting" });
    expect(error?.code).toBe("23503");
  });

  it("B can insert a transaction referencing only their own rows", async () => {
    const { error } = await b.client.from("transactions").insert(base());
    expect(error).toBeNull();
  });
});

describe("transaction constraints", () => {
  it("amount_pence = 0 errors", async () => {
    const { error } = await a.client
      .from("transactions")
      .insert({ name: "Zero", amount_pence: 0, date: "2026-11-20", category_id: catA.id });
    expect(error?.code).toBe("23514");
  });

  it("a second transaction for the same (recurring_rule_id, date) errors", async () => {
    const row = { name: "Rent", amount_pence: 95000, date: "2026-11-01", category_id: catA.id, recurring_rule_id: ruleA.id };
    const first = await a.client.from("transactions").insert(row);
    expect(first.error).toBeNull();
    const second = await a.client.from("transactions").insert(row);
    expect(second.error?.code).toBe("23505");
  });
});

describe("table privileges", () => {
  it("authenticated has exactly select/insert/update/delete (profiles: no delete; leftover_movements: update on one column; carry_adjustments and feedback: select/insert only); anon has none", () => {
    const rows = queryAsPostgres<{ table_name: string; anon: string | null; authenticated: string | null }>(`
      select t.table_name,
        (select string_agg(privilege_type, ',' order by privilege_type) from information_schema.role_table_grants g
          where g.table_schema = 'public' and g.table_name = t.table_name and g.grantee = 'anon') as anon,
        (select string_agg(privilege_type, ',' order by privilege_type) from information_schema.role_table_grants g
          where g.table_schema = 'public' and g.table_name = t.table_name and g.grantee = 'authenticated') as authenticated
      from information_schema.tables t
      where t.table_schema = 'public' and t.table_type = 'BASE TABLE'
      order by t.table_name`);
    expect(rows).toHaveLength(16);
    for (const row of rows) {
      const expected =
        row.table_name === "profiles"
          ? "INSERT,SELECT,UPDATE"
          : row.table_name === "leftover_movements"
            ? "DELETE,INSERT,SELECT"
            : row.table_name === "carry_adjustments" || row.table_name === "feedback"
              ? "INSERT,SELECT"
              : "DELETE,INSERT,SELECT,UPDATE";
      expect(row).toEqual({ table_name: row.table_name, anon: null, authenticated: expected });
    }
  });

  it("on leftover_movements authenticated may update only nudge_dismissed_at (record_leftover writes the rest)", () => {
    const rows = queryAsPostgres<{ column_name: string }>(`
      select column_name from information_schema.column_privileges
      where table_schema = 'public' and table_name = 'leftover_movements'
        and grantee = 'authenticated' and privilege_type = 'UPDATE'
      order by column_name`);
    expect(rows).toEqual([{ column_name: "nudge_dismissed_at" }]);
  });
});

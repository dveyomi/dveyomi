import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createSignedInUser, deleteUser, type TestUser } from "./testClients";

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
});

describe("row-level security", () => {
  it.each(["transactions", "funds", "categories"])("A can read their own %s", async (table) => {
    const { data, error } = await a.client.from(table).select("id");
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });

  it.each(["transactions", "funds", "categories"])("B selecting A's %s gets zero rows", async (table) => {
    const ids = { transactions: txnA.id, funds: fundA.id, categories: catA.id } as Record<string, string>;
    const { data, error } = await b.client.from(table).select("id").eq("id", ids[table]);
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
    const { error } = await b.client.from("transactions").insert({ ...base(), [column]: id() });
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

import { afterEach, describe, expect, it } from "vitest";
import { createSignedInUser, deleteUser, type TestUser } from "@/db/testClients";
import type { IsoDate } from "@/lib/calc";
import { loadBudgetView, loadPeriodSummary } from "./budget";
import { NameTakenError } from "./budgetEdit";
import type { Db } from "./types";
import { createCategory } from "./category";
import {
  createTransaction,
  deleteTransaction,
  loadExpenseOptions,
  loadTransaction,
  MissingReferenceError,
  saveExpense,
  TransactionNotFoundError,
  updateTransaction,
} from "./transactions";

const TODAY = "2026-11-21";
const users: TestUser[] = [];
afterEach(async () => {
  await Promise.all(users.splice(0).map((u) => deleteUser(u)));
});

async function signIn(): Promise<TestUser> {
  const u = await createSignedInUser("transactions");
  users.push(u);
  const { error } = await u.client.from("profiles").update({ budget_start_day: 1 }).eq("user_id", u.id);
  if (error) throw error;
  return u;
}

async function insertPeriod(u: TestUser, start: IsoDate, end: IsoDate, allocations: Record<string, number>) {
  const { data, error } = await u.client
    .from("budget_periods")
    .insert({ start_date: start, end_date: end, income_pence: 300000, savings_pence: 50000 })
    .select("id")
    .single();
  if (error) throw error;
  const rows = Object.entries(allocations).map(([category_id, amount_pence]) => ({ period_id: data.id, category_id, amount_pence }));
  const ins = await u.client.from("allocations").insert(rows);
  if (ins.error) throw ins.error;
}

/** `summarise` for any stored period, the way loadBudgetView builds the current one. */
async function summariseStored(u: TestUser, start: IsoDate) {
  const { data: row, error } = await u.client.from("budget_periods").select("id").eq("start_date", start).single();
  if (error) throw error;
  return (await loadPeriodSummary(u.client as unknown as Db, row.id, TODAY)).summary;
}

/** A user with October (past) and November (current) budgets, a past expense of £50 and a current one of £25. */
async function seed() {
  const u = await signIn();
  const groceries = await createCategory(u.client, { name: "Groceries", kind: "need" });
  await insertPeriod(u, "2026-10-01", "2026-10-31", { [groceries]: 40000 });
  await insertPeriod(u, "2026-11-01", "2026-11-30", { [groceries]: 40000 });
  const past = await createTransaction(u.client, { name: "Big shop", amountPence: 5000, date: "2026-10-15", categoryId: groceries });
  await createTransaction(u.client, { name: "Tesco", amountPence: 2500, date: "2026-11-04", categoryId: groceries });
  return { u, groceries, past };
}

describe("createTransaction", () => {
  it("stores the entered values as a manual expense and returns its id", async () => {
    const u = await signIn();
    const travel = await createCategory(u.client, { name: "Travel", kind: "want" });
    const { data: fund } = await u.client.from("funds").insert({ name: "Holiday" }).select("id").single();
    const id = await createTransaction(u.client, {
      name: "Flights",
      amountPence: 1250,
      date: "2026-11-21",
      categoryId: travel,
      fundId: fund!.id,
      accountLabel: "Amex",
      notes: "Lisbon",
    });
    const { data } = await u.client.from("transactions").select("*").eq("id", id).single();
    expect(data).toMatchObject({
      user_id: u.id,
      name: "Flights",
      amount_pence: 1250,
      date: "2026-11-21",
      category_id: travel,
      fund_id: fund!.id,
      account_label: "Amex",
      notes: "Lisbon",
      source: "manual",
      external_id: null,
    });
    expect(await loadTransaction(u.client, id)).toEqual({
      id,
      name: "Flights",
      amountPence: 1250,
      date: "2026-11-21",
      categoryId: travel,
      fundId: fund!.id,
      accountLabel: "Amex",
      notes: "Lisbon",
      recurringRuleId: null,
      unchecked: false,
      trip: "auto",
    });
  });

  it("refuses another user's category or fund", async () => {
    const owner = await signIn();
    const theirs = await createCategory(owner.client, { name: "Theirs", kind: "need" });
    const { data: theirFund } = await owner.client.from("funds").insert({ name: "Theirs" }).select("id").single();
    const u = await signIn();
    const mine = await createCategory(u.client, { name: "Mine", kind: "need" });
    const base = { name: "X", amountPence: 100, date: TODAY };
    await expect(createTransaction(u.client, { ...base, categoryId: theirs })).rejects.toBeInstanceOf(MissingReferenceError);
    await expect(createTransaction(u.client, { ...base, categoryId: mine, fundId: theirFund!.id })).rejects.toBeInstanceOf(
      MissingReferenceError,
    );
  });
});

describe("createCategory", () => {
  it("creates a category with no allocation, and refuses a taken name ignoring case", async () => {
    const u = await signIn();
    const id = await createCategory(u.client, { name: "Gifts", kind: "want" });
    const { data } = await u.client.from("categories").select("name, kind").eq("id", id).single();
    expect(data).toEqual({ name: "Gifts", kind: "want" });
    expect((await u.client.from("allocations").select("id").eq("category_id", id)).data).toEqual([]);
    await expect(createCategory(u.client, { name: "gifts", kind: "need" })).rejects.toBeInstanceOf(NameTakenError);
  });
});

describe("loadExpenseOptions", () => {
  it("lists the user's categories and funds by name", async () => {
    const u = await signIn();
    const b = await createCategory(u.client, { name: "Rent", kind: "need" });
    const a = await createCategory(u.client, { name: "Gifts", kind: "want" });
    const { data: fund } = await u.client.from("funds").insert({ name: "Holiday" }).select("id").single();
    const other = await signIn();
    await createCategory(other.client, { name: "Other's", kind: "need" });
    expect(await loadExpenseOptions(u.client)).toEqual({
      categories: [
        { id: a, name: "Gifts", kind: "want" },
        { id: b, name: "Rent", kind: "need" },
      ],
      funds: [{ id: fund!.id, name: "Holiday" }],
    });
  });
});

// Review Focus 4: changing a past expense changes only that past period's figures.
describe("editing or deleting a past expense", () => {
  it("leaves today's budget unchanged; the past period's spending changes by 4000", async () => {
    const { u, groceries, past } = await seed();
    const currentBefore = await loadBudgetView(u.client, TODAY);
    const pastBefore = await summariseStored(u, "2026-10-01");
    expect(pastBefore.spentPence).toBe(5000);

    await updateTransaction(u.client, past, { name: "Big shop", amountPence: 9000, date: "2026-10-15", categoryId: groceries });

    expect(await loadBudgetView(u.client, TODAY)).toEqual(currentBefore);
    const pastAfter = await summariseStored(u, "2026-10-01");
    expect(pastAfter.spentPence - pastBefore.spentPence).toBe(4000);
    expect(pastAfter.categories[0].leftPence - pastBefore.categories[0].leftPence).toBe(-4000);
  });

  it("deleting it likewise changes only the past period", async () => {
    const { u, past } = await seed();
    const currentBefore = await loadBudgetView(u.client, TODAY);
    const pastBefore = await summariseStored(u, "2026-10-01");

    await deleteTransaction(u.client, past);

    expect(await loadBudgetView(u.client, TODAY)).toEqual(currentBefore);
    expect((await summariseStored(u, "2026-10-01")).spentPence).toBe(pastBefore.spentPence - 5000);
    expect(await loadTransaction(u.client, past)).toBeNull();
  });
});

describe("updateTransaction / deleteTransaction", () => {
  it("clears optional fields that are left out", async () => {
    const u = await signIn();
    const c = await createCategory(u.client, { name: "Travel", kind: "want" });
    const id = await createTransaction(u.client, { name: "Taxi", amountPence: 900, date: TODAY, categoryId: c, accountLabel: "Amex", notes: "Late" });
    await updateTransaction(u.client, id, { name: "Taxi home", amountPence: 950, date: TODAY, categoryId: c });
    expect(await loadTransaction(u.client, id)).toMatchObject({ name: "Taxi home", amountPence: 950, accountLabel: null, notes: null, fundId: null });
  });

  it("can't touch another user's expense: not found, nothing changed", async () => {
    const { u, past } = await seed();
    const other = await signIn();
    const theirs = await createCategory(other.client, { name: "Food", kind: "need" });
    expect(await loadTransaction(other.client, past)).toBeNull();
    await expect(
      updateTransaction(other.client, past, { name: "Hacked", amountPence: 1, date: TODAY, categoryId: theirs }),
    ).rejects.toBeInstanceOf(TransactionNotFoundError);
    await expect(deleteTransaction(other.client, past)).rejects.toBeInstanceOf(TransactionNotFoundError);
    expect(await loadTransaction(u.client, past)).toMatchObject({ name: "Big shop", amountPence: 5000 });
  });

  it("loadTransaction returns null for a malformed id", async () => {
    const u = await signIn();
    expect(await loadTransaction(u.client, "not-a-uuid")).toBeNull();
  });
});

describe("saveExpense", () => {
  it("creates a new category (no allocation) in the same save, and uses it", async () => {
    const { u } = await seed();
    const id = await saveExpense(u.client, null, {
      name: "Birthday",
      amountPence: 2000,
      date: TODAY,
      category: { name: "Presents", kind: "want" },
      fundId: null,
    });
    const txn = await loadTransaction(u.client, id);
    const { data: cat } = await u.client.from("categories").select("id, name, kind").eq("id", txn!.categoryId).single();
    expect(cat).toMatchObject({ name: "Presents", kind: "want" });
    // No allocation, so the Budget tab shows it as "no budget yet".
    const view = await loadBudgetView(u.client, TODAY);
    expect(view.summary!.categories.find((c) => c.categoryId === cat!.id)).toMatchObject({ noBudget: true, spentPence: 2000 });
  });

  it("updates an expense, moving it to an existing category", async () => {
    const { u, past } = await seed();
    const other = await createCategory(u.client, { name: "Eating out", kind: "want" });
    expect(await saveExpense(u.client, past, { name: "Dinner", amountPence: 4200, date: "2026-10-16", category: { id: other }, fundId: null, notes: "Birthday" })).toBe(past);
    expect(await loadTransaction(u.client, past)).toMatchObject({ name: "Dinner", amountPence: 4200, date: "2026-10-16", categoryId: other, notes: "Birthday" });
  });

  it("leaves no new category behind when the expense can't be saved", async () => {
    const owner = await signIn();
    const { data: theirFund } = await owner.client.from("funds").insert({ name: "Theirs" }).select("id").single();
    const u = await signIn();
    await expect(
      saveExpense(u.client, null, { name: "X", amountPence: 100, date: TODAY, category: { name: "Orphan", kind: "need" }, fundId: theirFund!.id }),
    ).rejects.toBeInstanceOf(MissingReferenceError);
    expect((await u.client.from("categories").select("id").eq("name", "Orphan")).data).toEqual([]);
  });
});

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { admin, createSignedInUser, deleteUser, type TestUser } from "@/db/testClients";
import {
  leftToSpendPercent,
  leftoverBreakdown,
  summarise,
  summariseExpenses,
  totalSpent,
  type Allocation,
  type BudgetSummary,
  type Period,
  type Txn,
} from "@/lib/calc";
import { loadBudgetView } from "./budget";
import { loadCategoryView } from "./category";
import { loadExpensesView } from "./expenses";
import { commitImport } from "./imports";
import { createRule, generateDue } from "./recurring";
import { loadReview } from "./review";
import { createTrip } from "./trips";

// One user, every kind of expense, and every screen's figure checked against
// calc run by hand on the same inputs: no figure is calculated two ways.
const TODAY = "2026-11-21";
const NOW = new Date("2026-11-21T12:00:00Z");
const NOVEMBER: Period = { start: "2026-11-01", end: "2026-11-30", nextStart: "2026-12-01" };
const OCTOBER: Period = { start: "2026-10-01", end: "2026-10-31", nextStart: "2026-11-01" };
const INCOME = 600000;
const SAVINGS = 100000;

let u: TestUser;
const ids: Record<"rent" | "groceries" | "fun" | "holiday", string> = { rent: "", groceries: "", fun: "", holiday: "" };
let allocations: Allocation[];

/** The expenses as calc sees them, written out by hand (not read back from the database). */
const txn = (id: string, amountPence: number, date: string, categoryId: string, fundId: string | null = null): Txn => ({
  id,
  amountPence,
  date,
  categoryId,
  fundId,
});
let novemberTxns: Txn[];
let octoberTxns: Txn[];

const expected = (txns: Txn[]): BudgetSummary =>
  summarise({ incomePence: INCOME, savingsPence: SAVINGS, unassignedCarryPence: 0, allocations }, txns, NOVEMBER, TODAY)!;

/** The summary with its categories in id order: the database returns allocations in no set order. */
const byId = (s: BudgetSummary | null) =>
  s && { ...s, categories: s.categories.toSorted((a, b) => a.categoryId.localeCompare(b.categoryId)) };

beforeAll(async () => {
  u = await createSignedInUser("consistency");
  const profile = await u.client.from("profiles").update({ budget_start_day: 1 }).eq("user_id", u.id);
  if (profile.error) throw profile.error;

  const cats = await u.client
    .from("categories")
    .insert([
      { name: "Rent", kind: "need" },
      { name: "Groceries", kind: "need" },
      { name: "Fun", kind: "want" },
    ])
    .select("id, name");
  if (cats.error) throw cats.error;
  const cat = (name: string) => cats.data.find((c) => c.name === name)!.id;
  ids.rent = cat("Rent");
  ids.groceries = cat("Groceries");
  ids.fun = cat("Fun");
  allocations = [
    { categoryId: ids.rent, kind: "need", amountPence: 150000 },
    { categoryId: ids.groceries, kind: "need", amountPence: 40000 },
    { categoryId: ids.fun, kind: "want", amountPence: 60000 },
  ];

  const fund = await u.client.from("funds").insert({ name: "Holiday", opening_pence: 50000 }).select("id").single();
  if (fund.error) throw fund.error;
  ids.holiday = fund.data.id;

  for (const p of [OCTOBER, NOVEMBER]) {
    const period = await u.client
      .from("budget_periods")
      .insert({ start_date: p.start, end_date: p.end, income_pence: INCOME, savings_pence: SAVINGS })
      .select("id")
      .single();
    if (period.error) throw period.error;
    const alloc = await u.client
      .from("allocations")
      .insert(allocations.map((a) => ({ period_id: period.data.id, category_id: a.categoryId, amount_pence: a.amountPence })));
    if (alloc.error) throw alloc.error;
  }

  const rows = await u.client
    .from("transactions")
    .insert([
      { name: "Rent", amount_pence: 150000, date: "2026-11-01", category_id: ids.rent },
      { name: "Tesco", amount_pence: 2500, date: "2026-11-03", category_id: ids.groceries },
      { name: "Flights", amount_pence: 30000, date: "2026-11-12", category_id: ids.fun, fund_id: ids.holiday },
      // Past period: never in November's figures.
      { name: "October rent", amount_pence: 150000, date: "2026-10-01", category_id: ids.rent },
      { name: "October shop", amount_pence: 45000, date: "2026-10-10", category_id: ids.groceries },
    ])
    .select("id, name");
  if (rows.error) throw rows.error;
  const row = (name: string) => rows.data.find((r) => r.name === name)!.id;

  // A recurring payment, auto-added on its due date and still unchecked.
  await createRule(u.client, { name: "Spotify", categoryId: ids.fun, fundId: null, frequency: "monthly", anchorDate: "2026-11-05", amountPence: 1199 });
  expect(await generateDue(u.client, u.id, "Europe/London", NOW)).toBe(1);
  const spotify = await u.client.from("transactions").select("id, unchecked, date").eq("name", "Spotify").single();
  if (spotify.error) throw spotify.error;
  expect(spotify.data).toMatchObject({ unchecked: true, date: "2026-11-05" });

  novemberTxns = [
    txn(row("Rent"), 150000, "2026-11-01", ids.rent),
    txn(row("Tesco"), 2500, "2026-11-03", ids.groceries),
    txn(row("Flights"), 30000, "2026-11-12", ids.fun, ids.holiday),
    txn(spotify.data.id, 1199, "2026-11-05", ids.fun),
  ];
  octoberTxns = [
    txn(row("October rent"), 150000, "2026-10-01", ids.rent),
    txn(row("October shop"), 45000, "2026-10-10", ids.groceries),
  ];
});

afterAll(async () => {
  await deleteUser(u);
});

async function figures() {
  const budget = await loadBudgetView(u.client, TODAY);
  const groceries = await loadCategoryView(u.client, TODAY, ids.groceries);
  const expenses = await loadExpensesView(u.client, TODAY, { range: "period", month: null });
  const analytics = summariseExpenses(expenses.transactions, expenses.window.current, expenses.window.previous, TODAY);
  return { budget, groceries, expenses, analytics };
}

describe("one set of figures", () => {
  it("Budget, category detail and Expenses all come from calc on the same expenses", async () => {
    const { budget, groceries, expenses, analytics } = await figures();
    const want = expected(novemberTxns);

    expect(byId(budget.summary)).toEqual(byId(want));
    // The gauge: its percent and its amount.
    expect(leftToSpendPercent(budget.summary!)).toBe(leftToSpendPercent(want));
    expect(budget.summary!.leftToSpendPence).toBe(INCOME - SAVINGS - (150000 + 2500 + 1199));
    // Category detail "left" is the Budget tab's own figure.
    expect(groceries!.figure).toEqual(want.categories.find((c) => c.categoryId === ids.groceries));
    expect(groceries!.figure!.leftPence).toBe(40000 - 2500);
    // Expenses total: every November expense, fund-paid included.
    expect(expenses.window.current).toEqual(NOVEMBER);
    expect(analytics.totalPence).toBe(totalSpent(novemberTxns, NOVEMBER));
    expect(analytics.totalPence).toBe(150000 + 2500 + 30000 + 1199);
  });

  it("a fund-paid expense counts in the Expenses total but not in monthly spent", async () => {
    const { budget, analytics } = await figures();
    expect(analytics.totalPence - budget.summary!.spentPence).toBe(30000);
    expect(budget.summary!.categories.find((c) => c.categoryId === ids.fun)!.spentPence).toBe(1199);
  });

  it("an unchecked recurring payment counts in both", async () => {
    const { budget, analytics } = await figures();
    const withoutSpotify = novemberTxns.filter((t) => t.amountPence !== 1199);
    expect(budget.summary!.spentPence - expected(withoutSpotify).spentPence).toBe(1199);
    expect(analytics.totalPence - totalSpent(withoutSpotify, NOVEMBER)).toBe(1199);
  });

  it("a trip changes no figure", async () => {
    const before = await figures();
    await createTrip(u.client, { name: "Lisbon", place: "Lisbon", startDate: "2026-11-10", endDate: "2026-11-14" });
    const after = await figures();
    expect(byId(after.budget.summary)).toEqual(byId(before.budget.summary));
    expect(after.groceries!.figure).toEqual(before.groceries!.figure);
    expect(after.analytics).toEqual(before.analytics);
  });

  it("an imported (CSV) expense counts exactly as calc says an expense does", async () => {
    const { batchId } = await commitImport(u.client, [{ row: 2, date: "2026-11-15", amountPence: 1800, name: "Cinema" }], ids.fun, {
      filename: "bank.csv",
      today: TODAY,
    });
    const imported = await admin.from("transactions").select("id, source").eq("import_batch_id", batchId).single();
    if (imported.error) throw imported.error;
    expect(imported.data.source).toBe("csv");
    const withImport = [...novemberTxns, txn(imported.data.id, 1800, "2026-11-15", ids.fun)];

    const { budget, analytics } = await figures();
    expect(byId(budget.summary)).toEqual(byId(expected(withImport)));
    expect(analytics.totalPence).toBe(totalSpent(withImport, NOVEMBER));
    novemberTxns = withImport;
  });

  it("the period-end leftover is that period's left to spend", async () => {
    const review = await loadReview(u.client, TODAY);
    const october = summarise({ incomePence: INCOME, savingsPence: SAVINGS, unassignedCarryPence: 0, allocations }, octoberTxns, OCTOBER, OCTOBER.end)!;
    expect(review!.period).toEqual(OCTOBER);
    expect(review!.breakdown).toEqual(leftoverBreakdown(october, 0, 0));
    expect(review!.breakdown.totalPence).toBe(october.leftToSpendPence);
    expect(review!.breakdown.totalPence).toBe(INCOME - SAVINGS - 195000);
    // October's Groceries overspend is shown, not carried into November.
    expect(review!.overspent).toEqual([{ categoryId: ids.groceries, name: "Groceries", overPence: 5000 }]);
  });
});

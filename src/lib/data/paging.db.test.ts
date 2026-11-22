import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { admin, createSignedInUser, deleteUser, type TestUser } from "@/db/testClients";
import { exportUserData } from "./account";
import { loadBudgetView } from "./budget";
import { loadCategoryView } from "./category";
import { loadExpensesView } from "./expenses";
import { addFundMovement, loadSavingView } from "./funds";
import { existingExpensesFor } from "./imports";
import { loadDetections } from "./recurring";
import { tripTransactions } from "./trips";

// PostgREST returns at most max_rows (1,000) rows per request. These figures
// come from more rows than that, so a read that isn't paged gets them wrong.
const TODAY = "2026-11-21";
const GROCERY_ROWS = 1100; // £1.00 each
const FUND_TXN_ROWS = 1050; // £0.10 each, paid from Holiday
const CONTRIBUTIONS = 1100; // £1.00 each into Holiday

let u: TestUser;
let groceries: string;
let fundId: string;
let tripId: string;

const novemberDay = (i: number) => `2026-11-${String((i % 20) + 1).padStart(2, "0")}`;

async function insertAll(table: "transactions" | "fund_movements", rows: Record<string, unknown>[]) {
  const { error } = await admin.from(table).insert(rows as never);
  if (error) throw error;
}

beforeAll(async () => {
  u = await createSignedInUser("paging");
  const profile = await u.client.from("profiles").update({ budget_start_day: 1 }).eq("user_id", u.id);
  if (profile.error) throw profile.error;

  const cat = await u.client.from("categories").insert({ name: "Groceries", kind: "need" }).select("id").single();
  if (cat.error) throw cat.error;
  groceries = cat.data.id;
  const period = await u.client
    .from("budget_periods")
    .insert({ start_date: "2026-11-01", end_date: "2026-11-30", income_pence: 600000, savings_pence: 0 })
    .select("id")
    .single();
  if (period.error) throw period.error;
  const alloc = await u.client.from("allocations").insert({ period_id: period.data.id, category_id: groceries, amount_pence: 500000 });
  if (alloc.error) throw alloc.error;
  const fund = await u.client.from("funds").insert({ name: "Holiday" }).select("id").single();
  if (fund.error) throw fund.error;
  fundId = fund.data.id;
  const trip = await u.client.from("trips").insert({ name: "November", start_date: "2026-11-01", end_date: "2026-11-30" }).select("id").single();
  if (trip.error) throw trip.error;
  tripId = trip.data.id;

  const base = { user_id: u.id, category_id: groceries };
  await insertAll(
    "transactions",
    Array.from({ length: GROCERY_ROWS }, (_, i) => ({ ...base, name: `Shop ${i}`, amount_pence: 100, date: novemberDay(i) })),
  );
  await insertAll(
    "transactions",
    Array.from({ length: FUND_TXN_ROWS }, (_, i) => ({ ...base, name: `Ice cream ${i}`, amount_pence: 10, date: novemberDay(i), fund_id: fundId })),
  );
  // Three monthly payments older than every other expense: newest-first, they
  // come after the first 1,000 rows.
  await insertAll(
    "transactions",
    ["2026-08-21", "2026-09-21", "2026-10-21"].map((date) => ({ ...base, name: "Gym", amount_pence: 3000, date })),
  );
  await insertAll(
    "fund_movements",
    Array.from({ length: CONTRIBUTIONS }, (_, i) => ({ user_id: u.id, fund_id: fundId, date: novemberDay(i), kind: "contribution", amount_pence: 100 })),
  );
}, 120_000);

afterAll(async () => {
  await deleteUser(u);
});

const NOVEMBER_TXNS = GROCERY_ROWS + FUND_TXN_ROWS;
const BALANCE = CONTRIBUTIONS * 100 - FUND_TXN_ROWS * 10;

describe("reads past 1,000 rows", () => {
  it("Budget: spent counts every in-period expense (fund-paid left out)", async () => {
    const view = await loadBudgetView(u.client, TODAY);
    expect(view.summary!.spentPence).toBe(GROCERY_ROWS * 100);
  });

  it("category detail lists every expense in the period", async () => {
    const view = await loadCategoryView(u.client, TODAY, groceries);
    expect(view!.transactions).toHaveLength(NOVEMBER_TXNS);
  });

  it("Expenses: every expense in both windows", async () => {
    const view = await loadExpensesView(u.client, TODAY, { range: "month", month: null });
    // November's plus October's Gym.
    expect(view.transactions).toHaveLength(NOVEMBER_TXNS + 1);
  });

  it("Saving: the fund's balance and history use every movement and fund-paid expense", async () => {
    const view = await loadSavingView(u.client, TODAY);
    const holiday = view.funds.find((f) => f.id === fundId)!;
    expect(holiday.balancePence).toBe(BALANCE);
    expect(holiday.history).toHaveLength(CONTRIBUTIONS + FUND_TXN_ROWS);
  });

  it("a withdrawal of the whole balance is allowed (balance read in full)", async () => {
    await addFundMovement(u.client, fundId, { kind: "withdrawal", amountPence: BALANCE, date: TODAY, note: null });
    const { count } = await admin.from("fund_movements").select("id", { count: "exact", head: true }).eq("kind", "withdrawal").eq("user_id", u.id);
    expect(count).toBe(1);
    const { error } = await admin.from("fund_movements").delete().eq("kind", "withdrawal").eq("user_id", u.id);
    if (error) throw error;
  });

  it("recurring detection sees payments beyond the newest 1,000 expenses", async () => {
    const hits = await loadDetections(u.client, TODAY);
    expect(hits.map((h) => h.name)).toEqual(["Gym"]);
  });

  it("trip lists every expense inside its dates", async () => {
    expect(await tripTransactions(u.client, tripId)).toHaveLength(NOVEMBER_TXNS);
  });

  it("import duplicate check reads every expense in the file's date range", async () => {
    const found = await existingExpensesFor(u.client, [{ date: "2026-11-01" }, { date: "2026-11-30" }]);
    expect(found).toHaveLength(NOVEMBER_TXNS);
  });

  it("export holds every row", async () => {
    const data = await exportUserData(u.client);
    expect(data.transactions).toHaveLength(NOVEMBER_TXNS + 3);
    expect(data.fund_movements).toHaveLength(CONTRIBUTIONS);
  });
});

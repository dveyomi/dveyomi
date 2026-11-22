import { afterEach, describe, expect, it } from "vitest";
import { createSignedInUser, deleteUser, type TestUser } from "@/db/testClients";
import { loadBudgetView } from "./budget";
import {
  FundNotFoundError,
  InsufficientFundsError,
  loadSavingView,
  moveBetweenFunds,
  SameFundError,
  withdrawFromFund,
} from "./funds";
import { loadReviewStatus } from "./review";
import type { Db } from "./types";

/**
 * Fund money movements (David, 2026-11-22): a withdrawal can go into this
 * month's spending money (one transaction: the withdrawal and the current
 * period's carry, with a from_fund adjustment), or just come out; and money
 * can move from one fund to another without touching the budget.
 */

const TODAY = "2026-11-21";
const users: TestUser[] = [];
afterEach(async () => {
  await Promise.all(users.splice(0).map((u) => deleteUser(u)));
});

const db = (u: TestUser) => u.client as unknown as Db;

/** November (current, £2,500 to spend), Emergency holding £500 and Holiday holding £200. */
async function seed() {
  const u = await createSignedInUser("fund-moves");
  users.push(u);
  const p = await u.client.from("profiles").update({ budget_start_day: 1 }).eq("user_id", u.id);
  if (p.error) throw p.error;
  const period = await u.client
    .from("budget_periods")
    .insert({ start_date: "2026-11-01", end_date: "2026-11-30", income_pence: 300000, savings_pence: 50000 })
    .select("id")
    .single();
  if (period.error) throw period.error;
  const funds = await u.client
    .from("funds")
    .insert([
      { name: "Emergency", opening_pence: 50000 },
      { name: "Holiday", opening_pence: 20000 },
    ])
    .select("id, name");
  if (funds.error) throw funds.error;
  const id = (name: string) => funds.data.find((f) => f.name === name)!.id;
  return { u, periodId: period.data.id, emergency: id("Emergency"), holiday: id("Holiday") };
}

async function fund(u: TestUser, id: string) {
  return (await loadSavingView(db(u), TODAY)).funds.find((f) => f.id === id)!;
}

const left = async (u: TestUser) => (await loadBudgetView(db(u), TODAY)).summary!.leftToSpendPence;
const withdrawal = (amountPence: number, note: string | null = null) => ({
  kind: "withdrawal" as const,
  amountPence,
  date: "2026-11-20",
  note,
});

describe("withdrawFromFund", () => {
  it("into this month's spending: the fund goes down and November's left to spend goes up, together", async () => {
    const { u, emergency, periodId } = await seed();
    await withdrawFromFund(db(u), TODAY, emergency, withdrawal(10000), "spending");
    const e = await fund(u, emergency);
    expect(e.balancePence).toBe(40000);
    expect(e.history[0]).toMatchObject({ direction: "out", amountPence: 10000, title: "Withdrawn", note: "Moved to November spending" });
    expect(await left(u)).toBe(260000);
    const adj = await u.client.from("carry_adjustments").select("period_id, fund_id, amount_pence, reason");
    expect(adj.data).toEqual([{ period_id: periodId, fund_id: emergency, amount_pence: 10000, reason: "from_fund" }]);
    expect((await loadReviewStatus(db(u), TODAY)).adjustments).toEqual([
      { kind: "from_fund", label: "from Emergency fund", amountPence: 10000 },
    ]);
  });

  it("keeps a note typed with it", async () => {
    const { u, emergency } = await seed();
    await withdrawFromFund(db(u), TODAY, emergency, withdrawal(10000, "Car repair"), "spending");
    expect((await fund(u, emergency)).history[0].note).toBe("Moved to November spending · Car repair");
  });

  it("just taking it out leaves the budget alone", async () => {
    const { u, emergency } = await seed();
    await withdrawFromFund(db(u), TODAY, emergency, withdrawal(10000, "Deposit"), "out");
    expect((await fund(u, emergency)).balancePence).toBe(40000);
    expect((await fund(u, emergency)).history[0].note).toBe("Deposit");
    expect(await left(u)).toBe(250000);
    expect((await u.client.from("carry_adjustments").select("id")).data).toEqual([]);
  });

  it("refuses more than the fund holds, writing nothing", async () => {
    const { u, emergency } = await seed();
    const err = await withdrawFromFund(db(u), TODAY, emergency, withdrawal(50001), "spending").catch((e) => e);
    expect(err).toBeInstanceOf(InsufficientFundsError);
    expect((err as InsufficientFundsError).balancePence).toBe(50000);
    expect((await fund(u, emergency)).balancePence).toBe(50000);
    expect(await left(u)).toBe(250000);
  });

  it("refuses another user's fund", async () => {
    const { emergency } = await seed();
    const { u: other } = await seed();
    await expect(withdrawFromFund(db(other), TODAY, emergency, withdrawal(100), "spending")).rejects.toBeInstanceOf(
      FundNotFoundError,
    );
  });
});

describe("moveBetweenFunds", () => {
  it("moves money from one fund to another, with linked notes, and the budget untouched", async () => {
    const { u, emergency, holiday } = await seed();
    await moveBetweenFunds(db(u), emergency, holiday, { amountPence: 15000, date: "2026-11-20", note: null });
    const e = await fund(u, emergency);
    const h = await fund(u, holiday);
    expect(e.balancePence).toBe(35000);
    expect(h.balancePence).toBe(35000);
    expect(e.history[0]).toMatchObject({ direction: "out", amountPence: 15000, note: "To Holiday", date: "2026-11-20" });
    expect(h.history[0]).toMatchObject({ direction: "in", amountPence: 15000, note: "From Emergency", date: "2026-11-20" });
    expect(await left(u)).toBe(250000);
  });

  it("refuses more than the first fund holds, writing nothing", async () => {
    const { u, emergency, holiday } = await seed();
    await expect(
      moveBetweenFunds(db(u), holiday, emergency, { amountPence: 20001, date: "2026-11-20", note: null }),
    ).rejects.toBeInstanceOf(InsufficientFundsError);
    expect((await fund(u, holiday)).balancePence).toBe(20000);
    expect((await fund(u, emergency)).balancePence).toBe(50000);
  });

  it("refuses moving a fund into itself", async () => {
    const { u, emergency } = await seed();
    await expect(
      moveBetweenFunds(db(u), emergency, emergency, { amountPence: 100, date: "2026-11-20", note: null }),
    ).rejects.toBeInstanceOf(SameFundError);
  });

  it("refuses another user's fund on either side", async () => {
    const { u, emergency } = await seed();
    const { holiday: theirs } = await seed();
    await expect(
      moveBetweenFunds(db(u), emergency, theirs, { amountPence: 100, date: "2026-11-20", note: null }),
    ).rejects.toBeInstanceOf(FundNotFoundError);
    expect((await fund(u, emergency)).balancePence).toBe(50000);
  });
});

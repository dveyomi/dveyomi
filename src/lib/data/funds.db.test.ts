import { afterEach, describe, expect, it } from "vitest";
import { admin, createSignedInUser, deleteUser, queryAsPostgres, type TestUser } from "@/db/testClients";
import {
  FundNameTakenError,
  FundNotFoundError,
  InsufficientFundsError,
  SavingsAlreadyMovedError,
  SplitTotalError,
  addFundMovement,
  confirmSavingsSplit,
  createFund,
  loadSavingView,
  updateFund,
} from "./funds";

const TODAY = "2026-11-21";

let users: TestUser[] = [];
afterEach(async () => {
  await Promise.all(users.map((u) => deleteUser(u)));
  users = [];
});

async function signIn(): Promise<TestUser> {
  const u = await createSignedInUser("funds");
  users.push(u);
  const { error } = await u.client.from("profiles").update({ budget_start_day: 1 }).eq("user_id", u.id);
  if (error) throw error;
  return u;
}

async function insertFund(u: TestUser, name: string, opening = 0, target: number | null = null, targetDate: string | null = null) {
  const { data, error } = await u.client
    .from("funds")
    .insert({ name, opening_pence: opening, target_pence: target, target_date: targetDate })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

async function insertPeriod(u: TestUser, start: string, end: string, savings: number) {
  const { data, error } = await u.client
    .from("budget_periods")
    .insert({ start_date: start, end_date: end, income_pence: 600000, savings_pence: savings })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

async function insertPrompt(u: TestUser, periodId: string, status: "waiting" | "confirmed", split: Record<string, number> = {}) {
  const { error } = await u.client.from("savings_prompts").insert({ period_id: periodId, status, split });
  if (error) throw error;
}

async function movements(u: TestUser) {
  const { data, error } = await admin
    .from("fund_movements")
    .select("fund_id, date, kind, amount_pence, note")
    .eq("user_id", u.id)
    .order("amount_pence", { ascending: false });
  if (error) throw error;
  return data;
}

async function prompt(u: TestUser, periodId: string) {
  const { data, error } = await admin
    .from("savings_prompts")
    .select("status, split")
    .eq("user_id", u.id)
    .eq("period_id", periodId)
    .single();
  if (error) throw error;
  return data;
}

/** A user with Holiday (target £1,000) and Emergency, and a waiting £300 prompt for November. */
async function seedNovember() {
  const u = await signIn();
  const holiday = await insertFund(u, "Holiday", 10000, 100000, "2027-07-31");
  const emergency = await insertFund(u, "Emergency", 50000);
  const nov = await insertPeriod(u, "2026-11-01", "2026-11-30", 30000);
  await insertPrompt(u, nov, "waiting", { [holiday]: 20000, [emergency]: 10000 });
  return { u, holiday, emergency, nov };
}

describe("loadSavingView", () => {
  it("lists funds by name with balance, progress and history (fund-paid expenses as money out), newest first", async () => {
    const { u, holiday } = await seedNovember();
    const cat = await u.client.from("categories").insert({ name: "Travel", kind: "want" }).select("id").single();
    if (cat.error) throw cat.error;
    const mv = await u.client.from("fund_movements").insert([
      { fund_id: holiday, date: "2026-10-05", kind: "contribution", amount_pence: 30000, note: "Birthday money" },
      { fund_id: holiday, date: "2026-11-02", kind: "withdrawal", amount_pence: 5000 },
    ]);
    if (mv.error) throw mv.error;
    const txn = await u.client
      .from("transactions")
      .insert({ name: "Flights", amount_pence: 12000, date: "2026-11-12", category_id: cat.data.id, fund_id: holiday })
      .select("id")
      .single();
    if (txn.error) throw txn.error;

    const view = await loadSavingView(u.client, TODAY);

    expect(view.funds.map((f) => f.name)).toEqual(["Emergency", "Holiday"]);
    const h = view.funds.find((f) => f.id === holiday)!;
    // 100.00 opening + 300.00 in − 50.00 out − 120.00 flights
    expect(h).toMatchObject({
      name: "Holiday",
      openingPence: 10000,
      balancePence: 23000,
      targetPence: 100000,
      targetDate: "2027-07-31",
      progressPercent: 23,
    });
    expect(h.history).toEqual([
      { date: "2026-11-12", direction: "out", amountPence: 12000, label: "expense", refId: txn.data.id, title: "Flights", note: null },
      { date: "2026-11-02", direction: "out", amountPence: 5000, label: "withdrawal", refId: expect.any(String), title: "Withdrawn", note: null },
      { date: "2026-10-05", direction: "in", amountPence: 30000, label: "contribution", refId: expect.any(String), title: "Added", note: "Birthday money" },
    ]);
    const e = view.funds.find((f) => f.name === "Emergency")!;
    expect(e).toMatchObject({ balancePence: 50000, targetPence: null, progressPercent: null, history: [] });
  });

  it("lets fund-paid spending take a balance below zero", async () => {
    const u = await signIn();
    const fund = await insertFund(u, "Car", 1000);
    const cat = await u.client.from("categories").insert({ name: "Repairs", kind: "need" }).select("id").single();
    if (cat.error) throw cat.error;
    const ins = await u.client
      .from("transactions")
      .insert({ name: "MOT", amount_pence: 5000, date: "2026-11-10", category_id: cat.data.id, fund_id: fund });
    if (ins.error) throw ins.error;
    const view = await loadSavingView(u.client, TODAY);
    expect(view.funds[0]).toMatchObject({ balancePence: -4000 });
  });

  it("shows a waiting prompt with its period's current savings, pre-filled with its own split when nothing was confirmed before", async () => {
    const { u, holiday, emergency, nov } = await seedNovember();
    const view = await loadSavingView(u.client, TODAY);
    expect(view.waiting).toEqual([
      {
        periodId: nov,
        start: "2026-11-01",
        end: "2026-11-30",
        savingsPence: 30000,
        prefill: expect.arrayContaining([
          { fundId: holiday, amountPence: 20000 },
          { fundId: emergency, amountPence: 10000 },
        ]),
        prefillFrom: "setup",
      },
    ]);
    expect(view.waiting[0].prefill).toHaveLength(2);
  });

  it("pre-fills last period's confirmed split, keeping only funds that still exist", async () => {
    const u = await signIn();
    const holiday = await insertFund(u, "Holiday");
    const gone = await insertFund(u, "Old fund");
    const sep = await insertPeriod(u, "2026-09-01", "2026-09-30", 20000);
    await insertPrompt(u, sep, "confirmed", { [holiday]: 5000 });
    const oct = await insertPeriod(u, "2026-10-01", "2026-10-31", 30000);
    await insertPrompt(u, oct, "confirmed", { [holiday]: 25000, [gone]: 5000 });
    const nov = await insertPeriod(u, "2026-11-01", "2026-11-30", 30000);
    await insertPrompt(u, nov, "waiting");
    const del = await u.client.from("funds").delete().eq("id", gone);
    if (del.error) throw del.error;

    const view = await loadSavingView(u.client, TODAY);
    expect(view.waiting).toEqual([
      expect.objectContaining({ periodId: nov, savingsPence: 30000, prefill: [{ fundId: holiday, amountPence: 25000 }], prefillFrom: "last_period" }),
    ]);
  });

  it("pre-fills nothing without any split", async () => {
    const u = await signIn();
    await insertFund(u, "Holiday");
    const nov = await insertPeriod(u, "2026-11-01", "2026-11-30", 30000);
    await insertPrompt(u, nov, "waiting");
    const view = await loadSavingView(u.client, TODAY);
    expect(view.waiting).toEqual([expect.objectContaining({ periodId: nov, prefill: [], prefillFrom: "none" })]);
  });

  it("lists waiting prompts of past periods too, oldest first, but not confirmed ones or periods not started yet", async () => {
    const u = await signIn();
    const sep = await insertPeriod(u, "2026-09-01", "2026-09-30", 10000);
    await insertPrompt(u, sep, "waiting");
    const oct = await insertPeriod(u, "2026-10-01", "2026-10-31", 20000);
    await insertPrompt(u, oct, "confirmed");
    const nov = await insertPeriod(u, "2026-11-01", "2026-11-30", 30000);
    await insertPrompt(u, nov, "waiting");
    const dec = await insertPeriod(u, "2026-12-01", "2026-12-31", 30000);
    await insertPrompt(u, dec, "waiting");

    const view = await loadSavingView(u.client, TODAY);
    expect(view.waiting.map((w) => [w.periodId, w.savingsPence])).toEqual([
      [sep, 10000],
      [nov, 30000],
    ]);
  });
});

describe("confirmSavingsSplit", () => {
  it("creates one contribution per fund dated today, marks the prompt confirmed with the split, and the prompt disappears", async () => {
    const { u, holiday, emergency, nov } = await seedNovember();
    await confirmSavingsSplit(
      u.client,
      nov,
      [
        { fundId: holiday, amountPence: 20000 },
        { fundId: emergency, amountPence: 10000 },
      ],
      TODAY,
    );

    expect(await movements(u)).toEqual([
      { fund_id: holiday, date: TODAY, kind: "contribution", amount_pence: 20000, note: null },
      { fund_id: emergency, date: TODAY, kind: "contribution", amount_pence: 10000, note: null },
    ]);
    expect(await prompt(u, nov)).toEqual({ status: "confirmed", split: { [holiday]: 20000, [emergency]: 10000 } });
    const view = await loadSavingView(u.client, TODAY);
    expect(view.waiting).toEqual([]);
    expect(view.funds.find((f) => f.id === holiday)!.balancePence).toBe(30000);
  });

  it("confirms a £300 split across two funds (brief case)", async () => {
    const u = await signIn();
    const a = await insertFund(u, "A");
    const b = await insertFund(u, "B");
    const nov = await insertPeriod(u, "2026-11-01", "2026-11-30", 300000);
    await insertPrompt(u, nov, "waiting");
    await confirmSavingsSplit(u.client, nov, [{ fundId: a, amountPence: 200000 }, { fundId: b, amountPence: 100000 }], TODAY);
    const rows = await movements(u);
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.date === TODAY && r.kind === "contribution")).toBe(true);
    expect((await loadSavingView(u.client, TODAY)).waiting).toEqual([]);
  });

  it("refuses a split whose total differs from the savings (250000 of 300000), writing nothing", async () => {
    const u = await signIn();
    const a = await insertFund(u, "A");
    const b = await insertFund(u, "B");
    const nov = await insertPeriod(u, "2026-11-01", "2026-11-30", 300000);
    await insertPrompt(u, nov, "waiting");
    await expect(
      confirmSavingsSplit(u.client, nov, [{ fundId: a, amountPence: 200000 }, { fundId: b, amountPence: 50000 }], TODAY),
    ).rejects.toBeInstanceOf(SplitTotalError);
    expect(await movements(u)).toEqual([]);
    expect((await prompt(u, nov)).status).toBe("waiting");
  });

  it("checks the total against the period's current savings, not the one the prompt was made with", async () => {
    const { u, holiday, nov } = await seedNovember();
    const upd = await u.client.from("budget_periods").update({ savings_pence: 40000 }).eq("id", nov);
    if (upd.error) throw upd.error;
    await expect(confirmSavingsSplit(u.client, nov, [{ fundId: holiday, amountPence: 30000 }], TODAY)).rejects.toBeInstanceOf(
      SplitTotalError,
    );
    await confirmSavingsSplit(u.client, nov, [{ fundId: holiday, amountPence: 40000 }], TODAY);
    expect(await movements(u)).toHaveLength(1);
  });

  it("confirming twice does not create duplicate contributions", async () => {
    const { u, holiday, emergency, nov } = await seedNovember();
    const split = [
      { fundId: holiday, amountPence: 20000 },
      { fundId: emergency, amountPence: 10000 },
    ];
    await confirmSavingsSplit(u.client, nov, split, TODAY);
    await expect(confirmSavingsSplit(u.client, nov, split, TODAY)).rejects.toBeInstanceOf(SavingsAlreadyMovedError);
    expect(await movements(u)).toHaveLength(2);
  });

  it("concurrent confirms create one set of contributions", async () => {
    const { u, holiday, nov } = await seedNovember();
    const split = [{ fundId: holiday, amountPence: 30000 }];
    const results = await Promise.allSettled([
      confirmSavingsSplit(u.client, nov, split, TODAY),
      confirmSavingsSplit(u.client, nov, split, TODAY),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await movements(u)).toHaveLength(1);
  });

  it("writes no movement for a fund given £0, and leaves it out of the stored split", async () => {
    const { u, holiday, emergency, nov } = await seedNovember();
    await confirmSavingsSplit(u.client, nov, [{ fundId: holiday, amountPence: 30000 }, { fundId: emergency, amountPence: 0 }], TODAY);
    expect(await movements(u)).toEqual([expect.objectContaining({ fund_id: holiday, amount_pence: 30000 })]);
    expect((await prompt(u, nov)).split).toEqual({ [holiday]: 30000 });
  });

  it("creates a new fund in the same confirm and puts its share in it", async () => {
    const { u, holiday, nov } = await seedNovember();
    await confirmSavingsSplit(
      u.client,
      nov,
      [
        { fundId: holiday, amountPence: 10000 },
        { newFund: { name: "  New car ", targetPence: 500000 }, amountPence: 20000 },
      ],
      TODAY,
    );
    const view = await loadSavingView(u.client, TODAY);
    const car = view.funds.find((f) => f.name === "New car")!;
    expect(car).toMatchObject({ openingPence: 0, balancePence: 20000, targetPence: 500000, progressPercent: 4 });
    expect((await prompt(u, nov)).split).toEqual({ [holiday]: 10000, [car.id]: 20000 });
  });

  it("refuses a new fund named like an existing one (ignoring case), creating nothing", async () => {
    const { u, nov } = await seedNovember();
    await expect(
      confirmSavingsSplit(u.client, nov, [{ newFund: { name: "holiday", targetPence: null }, amountPence: 30000 }], TODAY),
    ).rejects.toBeInstanceOf(FundNameTakenError);
    expect(await movements(u)).toEqual([]);
    const { data } = await admin.from("funds").select("id").eq("user_id", u.id);
    expect(data).toHaveLength(2);
  });

  it("refuses another user's fund", async () => {
    const { u, nov } = await seedNovember();
    const other = await signIn();
    const theirs = await insertFund(other, "Theirs");
    await expect(confirmSavingsSplit(u.client, nov, [{ fundId: theirs, amountPence: 30000 }], TODAY)).rejects.toBeInstanceOf(
      FundNotFoundError,
    );
    expect(await movements(other)).toEqual([]);
    expect((await prompt(u, nov)).status).toBe("waiting");
  });

  it("refuses (22023) a negative amount, a fund listed twice and a malformed split when called directly", async () => {
    const { u, holiday, emergency, nov } = await seedNovember();
    const call = (split: unknown) => u.client.rpc("confirm_savings_split", { p_period_id: nov, p_date: TODAY, p_split: split });
    for (const split of [
      [
        { fund_id: holiday, amount_pence: 40000 },
        { fund_id: emergency, amount_pence: -10000 },
      ],
      [
        { fund_id: holiday, amount_pence: 15000 },
        { fund_id: holiday, amount_pence: 15000 },
      ],
      { fund_id: holiday, amount_pence: 30000 },
      [{ amount_pence: 30000 }],
      [{ fund_id: holiday, new_name: "Both", amount_pence: 30000 }],
      [{ new_name: "   ", amount_pence: 30000 }],
    ]) {
      const { error } = await call(split);
      expect(error?.code, JSON.stringify(split)).toBe("22023");
    }
    expect(await movements(u)).toEqual([]);
  });

  it("refuses a period that has not started yet, or one with no prompt", async () => {
    const u = await signIn();
    const fund = await insertFund(u, "A");
    const dec = await insertPeriod(u, "2026-12-01", "2026-12-31", 30000);
    await insertPrompt(u, dec, "waiting");
    const { error } = await u.client.rpc("confirm_savings_split", {
      p_period_id: dec,
      p_date: TODAY,
      p_split: [{ fund_id: fund, amount_pence: 30000 }],
    });
    expect(error?.code).toBe("22023");
    const oct = await insertPeriod(u, "2026-10-01", "2026-10-31", 30000);
    await expect(confirmSavingsSplit(u.client, oct, [{ fundId: fund, amountPence: 30000 }], TODAY)).rejects.toBeInstanceOf(
      SavingsAlreadyMovedError,
    );
  });

  it("is callable by signed-in users only (no anon or public execute)", () => {
    const rows = queryAsPostgres<{ anon: boolean; authenticated: boolean; definer: boolean }>(
      `select has_function_privilege('anon', p.oid, 'execute') as anon,
              has_function_privilege('authenticated', p.oid, 'execute') as authenticated,
              p.prosecdef as definer
       from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.proname = 'confirm_savings_split'`,
    );
    expect(rows).toEqual([{ anon: false, authenticated: true, definer: false }]);
  });
});

describe("funds and movements outside the prompt", () => {
  it("createFund and updateFund save name, target and target date; names are unique ignoring case", async () => {
    const u = await signIn();
    const id = await createFund(u.client, { name: "Holiday", targetPence: 100000, targetDate: "2027-07-31" });
    await expect(createFund(u.client, { name: "HOLIDAY", targetPence: null, targetDate: null })).rejects.toBeInstanceOf(
      FundNameTakenError,
    );
    await updateFund(u.client, id, { name: "Summer holiday", targetPence: null, targetDate: null });
    const view = await loadSavingView(u.client, TODAY);
    expect(view.funds).toEqual([
      expect.objectContaining({ id, name: "Summer holiday", openingPence: 0, targetPence: null, targetDate: null }),
    ]);
    await expect(updateFund(u.client, crypto.randomUUID(), { name: "X", targetPence: null, targetDate: null })).rejects.toBeInstanceOf(
      FundNotFoundError,
    );
  });

  it("addFundMovement records a dated contribution or withdrawal with a note, without touching the budget", async () => {
    const { u, holiday, nov } = await seedNovember();
    await addFundMovement(u.client, holiday, { kind: "contribution", amountPence: 5000, date: "2026-11-20", note: "Gift" });
    await addFundMovement(u.client, holiday, { kind: "withdrawal", amountPence: 15000, date: TODAY, note: null });
    expect(await movements(u)).toEqual([
      { fund_id: holiday, date: TODAY, kind: "withdrawal", amount_pence: 15000, note: null },
      { fund_id: holiday, date: "2026-11-20", kind: "contribution", amount_pence: 5000, note: "Gift" },
    ]);
    const view = await loadSavingView(u.client, TODAY);
    expect(view.funds.find((f) => f.id === holiday)!.balancePence).toBe(0);
    expect(view.waiting.map((w) => [w.periodId, w.savingsPence])).toEqual([[nov, 30000]]);
  });

  it("refuses a withdrawal larger than the balance", async () => {
    const { u, holiday } = await seedNovember();
    await expect(
      addFundMovement(u.client, holiday, { kind: "withdrawal", amountPence: 10001, date: TODAY, note: null }),
    ).rejects.toEqual(new InsufficientFundsError(10000));
    expect(await movements(u)).toEqual([]);
  });

  it("refuses another user's fund", async () => {
    const { u } = await seedNovember();
    const other = await signIn();
    const theirs = await insertFund(other, "Theirs", 10000);
    await expect(
      addFundMovement(u.client, theirs, { kind: "contribution", amountPence: 100, date: TODAY, note: null }),
    ).rejects.toBeInstanceOf(FundNotFoundError);
  });
});

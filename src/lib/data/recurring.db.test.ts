import { afterEach, describe, expect, it, vi } from "vitest";
import { admin, createSignedInUser, deleteUser, queryAsPostgres, type TestUser } from "@/db/testClients";
import type { IsoDate } from "@/lib/calc";
import { loadBudgetView } from "./budget";
import { createCategory } from "./category";
import {
  acceptDetection,
  cancelRule,
  changePrice,
  confirmOccurrence,
  createRule,
  dismissDetection,
  editOccurrence,
  generateDue,
  loadDetections,
  loadRecurringView,
  pauseRule,
  resumeRule,
  skipNext,
} from "./recurring";
import { createTransaction, DuplicateOccurrenceError, MissingReferenceError, saveExpense } from "./transactions";

const users: TestUser[] = [];
afterEach(async () => {
  await Promise.all(users.splice(0).map((u) => deleteUser(u)));
});

async function signIn(): Promise<TestUser> {
  const u = await createSignedInUser("recurring");
  users.push(u);
  return u;
}

/** Midday UTC on `date`: the same calendar day in London. */
const noon = (date: IsoDate) => new Date(`${date}T12:00:00Z`);
const LONDON = "Europe/London";

async function rows(u: TestUser, ruleId: string) {
  const { data, error } = await u.client
    .from("transactions")
    .select("id, date, amount_pence, unchecked, source, name, category_id")
    .eq("recurring_rule_id", ruleId)
    .order("date");
  if (error) throw error;
  return data;
}

async function withRule(over: Partial<Parameters<typeof createRule>[1]> = {}) {
  const u = await signIn();
  const categoryId = await createCategory(u.client, { name: "Subscriptions", kind: "want" });
  const ruleId = await createRule(u.client, {
    name: "Gym",
    categoryId,
    fundId: null,
    frequency: "weekly",
    anchorDate: "2026-11-02",
    amountPence: 3000,
    ...over,
  });
  return { u, categoryId, ruleId };
}

describe("generateDue", () => {
  it("creates each due payment once, however often it runs", async () => {
    const { u, ruleId } = await withRule();
    expect(await generateDue(u.client, u.id, LONDON, noon("2026-11-10"))).toBe(2);
    expect(await generateDue(u.client, u.id, LONDON, noon("2026-11-10"))).toBe(0);
    expect((await rows(u, ruleId)).map((r) => r.date)).toEqual(["2026-11-02", "2026-11-09"]);
  });

  it("after three missed weeks creates three payments on the right dates", async () => {
    const { u, ruleId } = await withRule();
    await generateDue(u.client, u.id, LONDON, noon("2026-11-02"));
    expect(await generateDue(u.client, u.id, LONDON, noon("2026-11-25"))).toBe(3);
    expect((await rows(u, ruleId)).map((r) => r.date)).toEqual(["2026-11-02", "2026-11-09", "2026-11-16", "2026-11-23"]);
  });

  it("uses the user's own today: Auckland has reached 21 Nov at 12:30 UTC on the 20th, London hasn't", async () => {
    const now = new Date("2026-11-20T12:30:00Z");
    const london = await withRule({ frequency: "monthly", anchorDate: "2026-10-21" });
    const auckland = await withRule({ frequency: "monthly", anchorDate: "2026-10-21" });
    await generateDue(london.u.client, london.u.id, "Europe/London", now);
    await generateDue(auckland.u.client, auckland.u.id, "Pacific/Auckland", now);
    expect((await rows(london.u, london.ruleId)).map((r) => r.date)).toEqual(["2026-10-21"]);
    expect((await rows(auckland.u, auckland.ruleId)).map((r) => r.date)).toEqual(["2026-10-21", "2026-11-21"]);
  });

  it("adds payments as unchecked, source 'recurring', with the rule's name and category, and they count in the budget", async () => {
    const { u, ruleId, categoryId } = await withRule();
    await u.client.from("profiles").update({ budget_start_day: 1 }).eq("user_id", u.id);
    await u.client
      .from("budget_periods")
      .insert({ start_date: "2026-11-01", end_date: "2026-11-30", income_pence: 300000, savings_pence: 0 });
    await generateDue(u.client, u.id, LONDON, noon("2026-11-10"));
    expect(await rows(u, ruleId)).toEqual([
      expect.objectContaining({ date: "2026-11-02", amount_pence: 3000, unchecked: true, source: "recurring", name: "Gym", category_id: categoryId }),
      expect.objectContaining({ date: "2026-11-09", unchecked: true }),
    ]);
    const view = await loadBudgetView(u.client, "2026-11-10");
    expect(view.summary!.categories.find((c) => c.categoryId === categoryId)?.spentPence).toBe(6000);
  });

  it("generates nothing while paused, then resumes on the pause's end date", async () => {
    const { u, ruleId } = await withRule();
    await pauseRule(u.client, ruleId, "2026-11-16", LONDON, noon("2026-11-01"));
    await generateDue(u.client, u.id, LONDON, noon("2026-11-15"));
    expect(await rows(u, ruleId)).toEqual([]);
    await generateDue(u.client, u.id, LONDON, noon("2026-11-16"));
    expect((await rows(u, ruleId)).map((r) => r.date)).toEqual(["2026-11-16"]);
  });

  it("doesn't bring back a payment the user deleted", async () => {
    const { u, ruleId } = await withRule();
    await generateDue(u.client, u.id, LONDON, noon("2026-11-10"));
    const [first] = await rows(u, ruleId);
    await u.client.from("transactions").delete().eq("id", first.id);
    await generateDue(u.client, u.id, LONDON, noon("2026-11-11"));
    expect((await rows(u, ruleId)).map((r) => r.date)).toEqual(["2026-11-09"]);
  });

  it("stops at a due date with no price, without passing it, and logs it", async () => {
    const u = await signIn();
    const categoryId = await createCategory(u.client, { name: "Subscriptions", kind: "want" });
    const { data: rule } = await u.client
      .from("recurring_rules")
      .insert({ name: "Odd", category_id: categoryId, frequency: "weekly", anchor_date: "2026-11-02" })
      .select("id")
      .single();
    await u.client.from("recurring_prices").insert({ rule_id: rule!.id, effective_from: "2026-11-09", amount_pence: 500 });
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await generateDue(u.client, u.id, LONDON, noon("2026-11-20"))).toBe(0);
    expect(log).toHaveBeenCalled();
    log.mockRestore();
    // Once a price covers 2 Nov, nothing has been passed over.
    await u.client.from("recurring_prices").insert({ rule_id: rule!.id, effective_from: "2026-11-02", amount_pence: 400 });
    expect(await generateDue(u.client, u.id, LONDON, noon("2026-11-20"))).toBe(3);
  });

  it("with the service role, adds payments only for the user named", async () => {
    const a = await withRule();
    const b = await withRule();
    expect(await generateDue(admin, a.u.id, LONDON, noon("2026-11-03"))).toBe(1);
    expect(await rows(a.u, a.ruleId)).toHaveLength(1);
    expect(await rows(b.u, b.ruleId)).toHaveLength(0);
  });

  it("can't add payments to another user's rules through the user's own client", async () => {
    const a = await withRule();
    const b = await withRule();
    expect(await generateDue(a.u.client, b.u.id, LONDON, noon("2026-11-03"))).toBe(0);
    expect(await rows(b.u, b.ruleId)).toHaveLength(0);
  });
});

describe("skipNext / cancelRule / resumeRule", () => {
  it("skipNext skips exactly the next date", async () => {
    const { u, ruleId } = await withRule();
    await generateDue(u.client, u.id, LONDON, noon("2026-11-02"));
    expect(await skipNext(u.client, ruleId, LONDON, noon("2026-11-02"))).toBe("2026-11-09");
    await generateDue(u.client, u.id, LONDON, noon("2026-11-20"));
    expect((await rows(u, ruleId)).map((r) => r.date)).toEqual(["2026-11-02", "2026-11-16"]);
  });

  it("cancelRule stops further payments and keeps the ones already added", async () => {
    const { u, ruleId } = await withRule();
    await generateDue(u.client, u.id, LONDON, noon("2026-11-10"));
    await cancelRule(u.client, ruleId, "2026-11-10");
    await generateDue(u.client, u.id, LONDON, noon("2026-12-31"));
    expect((await rows(u, ruleId)).map((r) => r.date)).toEqual(["2026-11-02", "2026-11-09"]);
  });

  it("pausing first adds the payments already due (they were paid), then pauses", async () => {
    const { u, ruleId } = await withRule();
    // Nothing generated yet; on 20 Nov, 2, 9 and 16 Nov are due.
    await pauseRule(u.client, ruleId, "2027-01-01", LONDON, noon("2026-11-20"));
    await generateDue(u.client, u.id, LONDON, noon("2026-12-31"));
    expect((await rows(u, ruleId)).map((r) => r.date)).toEqual(["2026-11-02", "2026-11-09", "2026-11-16"]);
  });

  it("skipping first adds the payments already due, then skips the next one after today", async () => {
    const { u, ruleId } = await withRule();
    expect(await skipNext(u.client, ruleId, LONDON, noon("2026-11-20"))).toBe("2026-11-23");
    await generateDue(u.client, u.id, LONDON, noon("2026-12-01"));
    expect((await rows(u, ruleId)).map((r) => r.date)).toEqual(["2026-11-02", "2026-11-09", "2026-11-16", "2026-11-30"]);
  });

  it("resumeRule clears a pause", async () => {
    const { u, ruleId } = await withRule();
    await pauseRule(u.client, ruleId, "2027-01-01", LONDON, noon("2026-11-01"));
    await resumeRule(u.client, ruleId);
    await generateDue(u.client, u.id, LONDON, noon("2026-11-02"));
    expect(await rows(u, ruleId)).toHaveLength(1);
  });
});

describe("editOccurrence", () => {
  /** Spotify at £8 a month from 10 Jan; January to May added; February checked. */
  async function spotify() {
    const ctx = await withRule({ name: "Spotify", frequency: "monthly", anchorDate: "2026-01-10", amountPence: 800 });
    await generateDue(ctx.u.client, ctx.u.id, LONDON, noon("2026-05-15"));
    const all = await rows(ctx.u, ctx.ruleId);
    await confirmOccurrence(ctx.u.client, all[1].id);
    return { ...ctx, all };
  }

  it("'this and future' from March sets March and later unchecked payments to £12; February stays £8", async () => {
    const { u, ruleId, all } = await spotify();
    await editOccurrence(u.client, all[2].id, "this_and_future", 1200);
    expect((await rows(u, ruleId)).map((r) => [r.date, r.amount_pence, r.unchecked])).toEqual([
      ["2026-01-10", 800, true],
      ["2026-02-10", 800, false],
      ["2026-03-10", 1200, false], // edited, so checked
      ["2026-04-10", 1200, true],
      ["2026-05-10", 1200, true],
    ]);
    // Later payments use the new price too.
    await generateDue(u.client, u.id, LONDON, noon("2026-06-10"));
    expect((await rows(u, ruleId)).at(-1)).toMatchObject({ date: "2026-06-10", amount_pence: 1200 });
  });

  it("'this and future' leaves later payments the user has checked alone", async () => {
    const { u, ruleId, all } = await spotify();
    await confirmOccurrence(u.client, all[4].id);
    await editOccurrence(u.client, all[2].id, "this_and_future", 1200);
    expect((await rows(u, ruleId)).map((r) => r.amount_pence)).toEqual([800, 800, 1200, 1200, 800]);
  });

  it("'just this payment' changes only that one", async () => {
    const { u, ruleId, all } = await spotify();
    await editOccurrence(u.client, all[2].id, "this", 1200);
    expect((await rows(u, ruleId)).map((r) => r.amount_pence)).toEqual([800, 800, 1200, 800, 800]);
    expect((await rows(u, ruleId))[2].unchecked).toBe(false);
    await generateDue(u.client, u.id, LONDON, noon("2026-06-10"));
    expect((await rows(u, ruleId)).at(-1)).toMatchObject({ amount_pence: 800 });
  });

  it("changePrice from a date updates the unchecked payments on and after it", async () => {
    const { u, ruleId } = await spotify();
    await changePrice(u.client, ruleId, "2026-04-01", 999);
    expect((await rows(u, ruleId)).map((r) => r.amount_pence)).toEqual([800, 800, 800, 999, 999]);
  });

  it("can't change another user's payment", async () => {
    const { all } = await spotify();
    const other = await signIn();
    await expect(editOccurrence(other.client, all[2].id, "this_and_future", 1)).rejects.toThrow();
  });
});

describe("saveExpense on a recurring payment", () => {
  async function spotify() {
    const ctx = await withRule({ name: "Spotify", frequency: "monthly", anchorDate: "2026-01-10", amountPence: 800 });
    await generateDue(ctx.u.client, ctx.u.id, LONDON, noon("2026-05-15"));
    return { ...ctx, all: await rows(ctx.u, ctx.ruleId) };
  }
  const input = (categoryId: string, over: Record<string, unknown> = {}) => ({
    name: "Spotify", amountPence: 800, date: "2026-03-10", category: { id: categoryId }, fundId: null, ...over,
  });

  it("any edit checks the payment", async () => {
    const { u, ruleId, all, categoryId } = await spotify();
    await saveExpense(u.client, all[2].id, input(categoryId, { notes: "family plan" }));
    expect((await rows(u, ruleId)).map((r) => r.unchecked)).toEqual([true, true, false, true, true]);
  });

  it("'This and future payments' sets this payment, the price and later unchecked payments together", async () => {
    const { u, ruleId, all, categoryId } = await spotify();
    await saveExpense(u.client, all[2].id, input(categoryId, { amountPence: 1200, amountScope: "this_and_future" }));
    expect((await rows(u, ruleId)).map((r) => [r.amount_pence, r.unchecked])).toEqual([
      [800, true], [800, true], [1200, false], [1200, true], [1200, true],
    ]);
    const { data: prices } = await u.client.from("recurring_prices").select("effective_from, amount_pence").eq("rule_id", ruleId).order("effective_from");
    expect(prices).toEqual([
      { effective_from: "2026-01-10", amount_pence: 800 },
      { effective_from: "2026-03-10", amount_pence: 1200 },
    ]);
  });

  it("'This and future payments' changes nothing when any part fails", async () => {
    const { u, ruleId, all, categoryId } = await spotify();
    const owner = await signIn();
    const { data: theirFund } = await owner.client.from("funds").insert({ name: "Theirs" }).select("id").single();
    await expect(
      saveExpense(u.client, all[2].id, input(categoryId, { amountPence: 1200, amountScope: "this_and_future", fundId: theirFund!.id })),
    ).rejects.toBeInstanceOf(MissingReferenceError);
    expect((await rows(u, ruleId)).map((r) => [r.amount_pence, r.unchecked])).toEqual([
      [800, true], [800, true], [800, true], [800, true], [800, true],
    ]);
    expect((await u.client.from("recurring_prices").select("id").eq("rule_id", ruleId)).data).toHaveLength(1);
  });

  it("moving a payment onto a date that already has one is refused in words", async () => {
    const { u, all, categoryId } = await spotify();
    await expect(saveExpense(u.client, all[2].id, input(categoryId, { date: "2026-04-10" }))).rejects.toBeInstanceOf(
      DuplicateOccurrenceError,
    );
    await expect(
      saveExpense(u.client, all[2].id, input(categoryId, { date: "2026-04-10", amountPence: 900, amountScope: "this_and_future" })),
    ).rejects.toBeInstanceOf(DuplicateOccurrenceError);
  });

  it("ignores Repeat when editing", async () => {
    const u = await signIn();
    const cat = await createCategory(u.client, { name: "Music", kind: "want" });
    const id = await createTransaction(u.client, { name: "Gig", amountPence: 2000, date: "2026-11-01", categoryId: cat });
    await saveExpense(u.client, id, { name: "Gig", amountPence: 2000, date: "2026-11-01", category: { id: cat }, fundId: null, repeat: "monthly" });
    expect((await u.client.from("recurring_rules").select("id")).data).toEqual([]);
  });
});

describe("confirmOccurrence", () => {
  it("clears unchecked", async () => {
    const { u, ruleId } = await withRule();
    await generateDue(u.client, u.id, LONDON, noon("2026-11-02"));
    const [row] = await rows(u, ruleId);
    await confirmOccurrence(u.client, row.id);
    expect((await rows(u, ruleId))[0].unchecked).toBe(false);
  });
});

describe("saveExpense with Repeat", () => {
  it("creates the rule from the expense and links it as the first, checked payment", async () => {
    const u = await signIn();
    const cat = await createCategory(u.client, { name: "Music", kind: "want" });
    const id = await saveExpense(u.client, null, {
      name: "Spotify", amountPence: 1199, date: "2026-11-15", category: { id: cat }, fundId: null, repeat: "monthly",
    });
    const { data: txn } = await u.client.from("transactions").select("recurring_rule_id, unchecked").eq("id", id).single();
    expect(txn!.unchecked).toBe(false);
    const { data: rule } = await u.client
      .from("recurring_rules")
      .select("name, category_id, fund_id, frequency, anchor_date, recurring_prices(effective_from, amount_pence)")
      .eq("id", txn!.recurring_rule_id!)
      .single();
    expect(rule).toEqual({
      name: "Spotify", category_id: cat, fund_id: null, frequency: "monthly", anchor_date: "2026-11-15",
      recurring_prices: [{ effective_from: "2026-11-15", amount_pence: 1199 }],
    });
    // The expense is the first payment, so catching up adds only the next one.
    expect(await generateDue(u.client, u.id, LONDON, noon("2026-12-15"))).toBe(1);
  });

  it("creates a new category, the expense and the rule together, or none of them", async () => {
    const owner = await signIn();
    const { data: theirFund } = await owner.client.from("funds").insert({ name: "Theirs" }).select("id").single();
    const u = await signIn();
    await expect(
      saveExpense(u.client, null, {
        name: "X", amountPence: 100, date: "2026-11-15", category: { name: "Orphan", kind: "need" }, fundId: theirFund!.id, repeat: "weekly",
      }),
    ).rejects.toBeInstanceOf(MissingReferenceError);
    expect((await u.client.from("categories").select("id")).data).toEqual([]);
    expect((await u.client.from("transactions").select("id")).data).toEqual([]);
    expect((await u.client.from("recurring_rules").select("id")).data).toEqual([]);

    const id = await saveExpense(u.client, null, {
      name: "Netflix", amountPence: 1099, date: "2026-11-15", category: { name: "Streaming", kind: "want" }, fundId: null, repeat: "monthly",
    });
    const { data } = await u.client.from("transactions").select("categories(name), recurring_rules(name)").eq("id", id).single();
    expect(data).toEqual({ categories: { name: "Streaming" }, recurring_rules: { name: "Netflix" } });
  });
});

describe("detection", () => {
  async function gymPayments(u: TestUser, categoryId: string) {
    for (const date of ["2026-09-03", "2026-10-03", "2026-11-03"]) {
      await createTransaction(u.client, { name: "Gym", amountPence: 3500, date, categoryId });
    }
  }

  it("suggests three unlinked monthly payments, and 'No' dismisses it for good", async () => {
    const u = await signIn();
    const cat = await createCategory(u.client, { name: "Health", kind: "want" });
    await gymPayments(u, cat);
    expect(await loadDetections(u.client, "2026-11-21")).toEqual([{ name: "Gym", nameKey: "gym", frequency: "monthly" }]);
    await dismissDetection(u.client, "gym");
    await dismissDetection(u.client, "gym");
    expect(await loadDetections(u.client, "2026-11-21")).toEqual([]);
  });

  it("'Yes, repeat it' makes a rule from the latest payment and links all three", async () => {
    const u = await signIn();
    const cat = await createCategory(u.client, { name: "Health", kind: "want" });
    await gymPayments(u, cat);
    const ruleId = await acceptDetection(u.client, "gym", "2026-11-21");
    expect((await rows(u, ruleId)).map((r) => [r.date, r.unchecked])).toEqual([
      ["2026-09-03", false],
      ["2026-10-03", false],
      ["2026-11-03", false],
    ]);
    const { data: rule } = await u.client.from("recurring_rules").select("frequency, anchor_date, category_id").eq("id", ruleId).single();
    expect(rule).toEqual({ frequency: "monthly", anchor_date: "2026-11-03", category_id: cat });
    expect(await loadDetections(u.client, "2026-11-21")).toEqual([]);
    expect(await generateDue(u.client, u.id, LONDON, noon("2026-12-03"))).toBe(1);
  });

  it("sees three quarterly or annual payments, further back than 120 days", async () => {
    const u = await signIn();
    const cat = await createCategory(u.client, { name: "Bills", kind: "need" });
    for (const date of ["2026-05-01", "2026-08-01", "2026-11-01"]) {
      await createTransaction(u.client, { name: "Water", amountPence: 9000, date, categoryId: cat });
    }
    for (const date of ["2024-11-10", "2025-11-10", "2026-11-10"]) {
      await createTransaction(u.client, { name: "TV licence", amountPence: 17450, date, categoryId: cat });
    }
    // Monthly payments that stopped months ago are not suggested.
    for (const date of ["2026-03-05", "2026-04-05", "2026-05-05"]) {
      await createTransaction(u.client, { name: "Old gym", amountPence: 3000, date, categoryId: cat });
    }
    expect(await loadDetections(u.client, "2026-11-21")).toEqual([
      { name: "TV licence", nameKey: "tv licence", frequency: "annually" },
      { name: "Water", nameKey: "water", frequency: "quarterly" },
    ]);
  });

  it("dismissals are private to each user", async () => {
    const a = await signIn();
    const b = await signIn();
    await dismissDetection(a.client, "gym");
    expect((await b.client.from("recurring_dismissals").select("name_key")).data).toEqual([]);
    const forged = await b.client.from("recurring_dismissals").insert({ user_id: a.id, name_key: "x" });
    expect(forged.error?.code).toBe("42501");
  });
});

describe("loadRecurringView", () => {
  it("lists each rule with its current amount, next due date and status", async () => {
    const { u, ruleId } = await withRule({ name: "Spotify", frequency: "monthly", anchorDate: "2026-09-15", amountPence: 800 });
    await changePrice(u.client, ruleId, "2026-11-01", 1199);
    await generateDue(u.client, u.id, LONDON, noon("2026-11-21"));
    const view = await loadRecurringView(u.client, "2026-11-21");
    expect(view.rules).toEqual([
      expect.objectContaining({
        id: ruleId, name: "Spotify", categoryName: "Subscriptions", frequency: "monthly",
        currentPence: 1199, nextDue: "2026-12-15", status: { kind: "active" },
      }),
    ]);
  });
});

describe("recurring functions and tables", () => {
  it("functions run as the caller (RLS applies) with an empty search_path; only signed-in users may call them", () => {
    const fns = queryAsPostgres<{ name: string; definer: boolean; anon: boolean; authenticated: boolean; path: string }>(`
      select p.proname as name, p.prosecdef as definer,
             has_function_privilege('anon', p.oid, 'execute') as anon,
             has_function_privilege('authenticated', p.oid, 'execute') as authenticated,
             array_to_string(p.proconfig, ',') as path
      from pg_proc p
      where p.pronamespace = 'public'::regnamespace
        and p.proname in ('save_expense', 'create_recurring_rule', 'apply_recurring_price')
      order by 1`);
    expect(fns).toEqual(
      ["apply_recurring_price", "create_recurring_rule", "save_expense"].map((name) => ({
        name, definer: false, anon: false, authenticated: true, path: 'search_path=""',
      })),
    );
  });

  it("the cron job's function can be run by neither anon nor authenticated", () => {
    const [fn] = queryAsPostgres<{ anon: boolean; authenticated: boolean; path: string }>(`
      select has_function_privilege('anon', p.oid, 'execute') as anon,
             has_function_privilege('authenticated', p.oid, 'execute') as authenticated,
             array_to_string(p.proconfig, ',') as path
      from pg_proc p where p.oid = 'private.request_recurring_run()'::regprocedure`);
    expect(fn).toEqual({ anon: false, authenticated: false, path: 'search_path=""' });
  });

  it("the hourly job is scheduled and does nothing while the Vault secrets are missing", () => {
    const jobs = queryAsPostgres<{ schedule: string; command: string }>(
      `select schedule, command from cron.job where jobname = 'recurring-payments'`,
    );
    expect(jobs).toEqual([{ schedule: "0 * * * *", command: "select private.request_recurring_run()" }]);
    const [run] = queryAsPostgres<{ id: number | null }>(`select private.request_recurring_run() as id`);
    expect(run.id).toBeNull();
  });

  it("recurring_dismissals has RLS and exactly the authenticated grants", () => {
    const [t] = queryAsPostgres<{ rls: boolean; anon: string | null; authenticated: string | null }>(`
      select c.relrowsecurity as rls,
        (select string_agg(privilege_type, ',' order by privilege_type) from information_schema.role_table_grants g
          where g.table_schema = 'public' and g.table_name = 'recurring_dismissals' and g.grantee = 'anon') as anon,
        (select string_agg(privilege_type, ',' order by privilege_type) from information_schema.role_table_grants g
          where g.table_schema = 'public' and g.table_name = 'recurring_dismissals' and g.grantee = 'authenticated') as authenticated
      from pg_class c where c.oid = 'public.recurring_dismissals'::regclass`);
    expect(t).toEqual({ rls: true, anon: null, authenticated: "DELETE,INSERT,SELECT,UPDATE" });
  });
});

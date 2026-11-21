import { afterEach, describe, expect, it } from "vitest";
import { admin, createSignedInUser, deleteUser, queryAsPostgres, type TestUser } from "@/db/testClients";
import { completeOnboarding, hasBudget, type OnboardingInput } from "./onboarding";

let user: TestUser | undefined;
afterEach(async () => {
  await deleteUser(user);
  user = undefined;
});

const setup: OnboardingInput = {
  incomePence: 600000,
  startDay: 25,
  savingsPence: 50000,
  categories: [
    { name: "Rent", kind: "need", amountPence: 150000 },
    { name: "Groceries", kind: "need", amountPence: 40000 },
    { name: "Eating out", kind: "want", amountPence: 20000 },
  ],
  funds: [
    { name: "Holiday", amountPence: 30000, alreadySavedPence: 20000 },
    { name: "Rainy day", amountPence: 20000, alreadySavedPence: 0 },
  ],
};

async function rows(u: TestUser) {
  const [profile, periods, categories, allocations, funds, prompts] = await Promise.all([
    admin.from("profiles").select("budget_start_day").eq("user_id", u.id).single(),
    admin.from("budget_periods").select("*").eq("user_id", u.id),
    admin.from("categories").select("id, name, kind").eq("user_id", u.id),
    admin.from("allocations").select("period_id, category_id, amount_pence").eq("user_id", u.id),
    admin.from("funds").select("id, name, opening_pence").eq("user_id", u.id),
    admin.from("savings_prompts").select("period_id, status, split").eq("user_id", u.id),
  ]);
  for (const r of [profile, periods, categories, allocations, funds, prompts]) if (r.error) throw r.error;
  return {
    startDay: profile.data!.budget_start_day,
    periods: periods.data!,
    categories: categories.data!,
    allocations: allocations.data!,
    funds: funds.data!,
    prompts: prompts.data!,
  };
}

describe("complete_onboarding", () => {
  it("runs as the caller (RLS applies) and only signed-in users may call it", () => {
    const [row] = queryAsPostgres<{ definer: boolean; anon: boolean; authenticated: boolean; public: boolean }>(`
      select p.prosecdef as definer,
             has_function_privilege('anon', p.oid, 'execute') as anon,
             has_function_privilege('authenticated', p.oid, 'execute') as authenticated,
             exists (select 1 from aclexplode(p.proacl) a where a.grantee = 0 and a.privilege_type = 'EXECUTE') as public
      from pg_proc p where p.proname = 'complete_onboarding' and p.pronamespace = 'public'::regnamespace`);
    expect(row).toEqual({ definer: false, anon: false, authenticated: true, public: false });
  });
});

describe("completeOnboarding", () => {
  it("creates the start day, period, categories, allocations, funds and a waiting savings split", async () => {
    user = await createSignedInUser("onboard");
    expect(await hasBudget(user.client)).toBe(false);

    await completeOnboarding(user.client, setup, "2026-11-21");

    const r = await rows(user);
    expect(r.startDay).toBe(25);
    expect(r.periods).toHaveLength(1);
    const period = r.periods[0];
    expect(period).toMatchObject({
      start_date: "2026-10-25",
      end_date: "2026-11-24",
      income_pence: 600000,
      savings_pence: 50000,
      unassigned_carry_pence: 0,
    });

    const nameOf = new Map(r.categories.map((c) => [c.id, c.name]));
    expect(r.categories.map((c) => [c.name, c.kind]).sort()).toEqual([
      ["Eating out", "want"],
      ["Groceries", "need"],
      ["Rent", "need"],
    ]);
    expect(r.allocations.every((a) => a.period_id === period.id)).toBe(true);
    expect(Object.fromEntries(r.allocations.map((a) => [nameOf.get(a.category_id), a.amount_pence]))).toEqual({
      Rent: 150000,
      Groceries: 40000,
      "Eating out": 20000,
    });
    expect(r.allocations.reduce((s, a) => s + a.amount_pence, 0)).toBe(210000);

    const fund = (name: string) => r.funds.find((f) => f.name === name)!;
    expect(fund("Holiday").opening_pence).toBe(20000);
    expect(fund("Rainy day").opening_pence).toBe(0);

    expect(r.prompts).toEqual([
      {
        period_id: period.id,
        status: "waiting",
        split: { [fund("Holiday").id]: 30000, [fund("Rainy day").id]: 20000 },
      },
    ]);
    expect(await hasBudget(user.client)).toBe(true);
  });

  it("creates no savings prompt when nothing is saved each period, but keeps funds' already-saved balances", async () => {
    user = await createSignedInUser("onboard");
    await completeOnboarding(
      user.client,
      { ...setup, savingsPence: 0, funds: [{ name: "Rainy day", amountPence: 0, alreadySavedPence: 90000 }] },
      "2026-11-21",
    );
    const r = await rows(user);
    expect(r.periods[0].savings_pence).toBe(0);
    expect(r.prompts).toEqual([]);
    expect(r.funds.map((f) => [f.name, f.opening_pence])).toEqual([["Rainy day", 90000]]);
  });

  it("refuses a second submit and creates nothing more", async () => {
    user = await createSignedInUser("onboard");
    await completeOnboarding(user.client, setup, "2026-11-21");
    await expect(completeOnboarding(user.client, setup, "2026-11-22")).rejects.toThrow(/already/i);
    const r = await rows(user);
    expect(r.periods).toHaveLength(1);
    expect(r.categories).toHaveLength(3);
    expect(r.allocations).toHaveLength(3);
    expect(r.funds).toHaveLength(2);
    expect(r.prompts).toHaveLength(1);
  });

  it("two concurrent submits create one budget", async () => {
    user = await createSignedInUser("onboard");
    const results = await Promise.allSettled([
      completeOnboarding(user.client, setup, "2026-11-21"),
      completeOnboarding(user.client, setup, "2026-11-21"),
    ]);
    expect(results.filter((x) => x.status === "fulfilled")).toHaveLength(1);
    const r = await rows(user);
    expect(r.periods).toHaveLength(1);
    expect(r.categories).toHaveLength(3);
    expect(r.funds).toHaveLength(2);
  });

  it("is all or nothing: a failure part-way leaves no rows", async () => {
    user = await createSignedInUser("onboard");
    // Fund amounts that do not add up to the savings are refused by the function itself.
    await expect(
      completeOnboarding(user.client, { ...setup, funds: [{ name: "Holiday", amountPence: 1, alreadySavedPence: 0 }] }, "2026-11-21"),
    ).rejects.toThrow();
    const r = await rows(user);
    expect(r.startDay).toBe(1);
    expect(r.periods).toEqual([]);
    expect(r.categories).toEqual([]);
    expect(r.funds).toEqual([]);
  });

  it("does not touch another user's data", async () => {
    user = await createSignedInUser("onboard");
    const other = await createSignedInUser("onboard-other");
    try {
      await completeOnboarding(other.client, setup, "2026-11-21");
      await completeOnboarding(user.client, setup, "2026-11-21");
      expect((await rows(user)).periods).toHaveLength(1);
      expect((await rows(other)).periods).toHaveLength(1);
    } finally {
      await deleteUser(other);
    }
  });
});

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

// Valid arguments for calling the function directly, bypassing the TS layer.
const rpcArgs = {
  p_start_day: 25,
  p_start: "2026-10-25",
  p_end: "2026-11-24",
  p_income_pence: 600000,
  p_savings_pence: 0,
  p_categories: [{ name: "Rent", kind: "need", amount_pence: 150000 }],
  p_funds: [] as unknown[],
};

describe("complete_onboarding called directly", () => {
  const cases: [string, Partial<typeof rpcArgs> | Record<string, unknown>][] = [
    ["null categories", { p_categories: null }],
    ["categories not an array", { p_categories: { name: "Rent" } }],
    ["null funds", { p_funds: null }],
    ["no categories", { p_categories: [] }],
    [
      "51 categories",
      { p_categories: Array.from({ length: 51 }, (_, i) => ({ name: `C${i}`, kind: "need", amount_pence: 1 })) },
    ],
    ["21 funds", { p_funds: Array.from({ length: 21 }, (_, i) => ({ name: `F${i}`, amount_pence: 0, already_saved_pence: 0 })) }],
    ["a null category amount", { p_categories: [{ name: "Rent", kind: "need", amount_pence: null }] }],
    ["a zero category amount", { p_categories: [{ name: "Rent", kind: "need", amount_pence: 0 }] }],
    [
      "a negative fund amount",
      { p_savings_pence: 0, p_funds: [{ name: "A", amount_pence: -5, already_saved_pence: 0 }, { name: "B", amount_pence: 5, already_saved_pence: 0 }] },
    ],
    ["a null already-saved amount", { p_funds: [{ name: "A", amount_pence: 0, already_saved_pence: null }] }],
    ["an end before the start", { p_end: "2026-10-24" }],
    ["a start that is not the start day", { p_start: "2026-10-24" }],
    ["a category name over 50 characters", { p_categories: [{ name: "x".repeat(51), kind: "need", amount_pence: 1 }] }],
    ["a fund name over 50 characters", { p_funds: [{ name: "x".repeat(51), amount_pence: 0, already_saved_pence: 0 }] }],
    ["income over £10m", { p_income_pence: 1_000_000_001 }],
    ["an allocation over £10m", { p_categories: [{ name: "Rent", kind: "need", amount_pence: 1_000_000_001 }] }],
  ];

  it.each(cases)("refuses %s and writes nothing", async (_, override) => {
    user = await createSignedInUser("onboard");
    const { error } = await user.client.rpc("complete_onboarding", { ...rpcArgs, ...override });
    expect(error).not.toBeNull();
    const r = await rows(user);
    expect(r.startDay).toBe(1);
    expect(r.periods).toEqual([]);
    expect(r.categories).toEqual([]);
  });

  it("accepts a start day of 31 in a 30-day month as the month's last day", async () => {
    user = await createSignedInUser("onboard");
    const { error } = await user.client.rpc("complete_onboarding", {
      ...rpcArgs,
      p_start_day: 31,
      p_start: "2026-11-30",
      p_end: "2026-12-30",
    });
    expect(error).toBeNull();
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

  it("is all or nothing: a failure after the start day and period are written leaves nothing", async () => {
    user = await createSignedInUser("onboard");
    // A duplicate category name passes the function's pre-checks and fails on
    // the categories insert, after the profile update and the period insert.
    const { error } = await user.client.rpc("complete_onboarding", {
      ...rpcArgs,
      p_categories: [
        { name: "Rent", kind: "need", amount_pence: 100 },
        { name: "Rent", kind: "want", amount_pence: 100 },
      ],
    });
    expect(error?.code).toBe("23505");
    const r = await rows(user);
    expect(r.startDay).toBe(1);
    expect(r.periods).toEqual([]);
    expect(r.categories).toEqual([]);
    expect(r.allocations).toEqual([]);
    expect(r.funds).toEqual([]);
    expect(r.prompts).toEqual([]);
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

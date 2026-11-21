import { afterEach, describe, expect, it } from "vitest";
import { admin, createSignedInUser, deleteUser, queryAsPostgres, type TestUser } from "@/db/testClients";
import {
  CategoryInUseError,
  NameTakenError,
  deleteCategory,
  loadBudgetEditor,
  removeFromBudget,
  renameCategory,
  saveBudget,
  type BudgetEditInput,
} from "./budgetEdit";
import { ensureCurrentPeriod } from "./ensurePeriod";

const TODAY = "2026-11-21";

let users: TestUser[] = [];
afterEach(async () => {
  await Promise.all(users.map((u) => deleteUser(u)));
  users = [];
});

async function signIn(startDay = 1): Promise<TestUser> {
  const u = await createSignedInUser("edit");
  users.push(u);
  const { error } = await u.client.from("profiles").update({ budget_start_day: startDay }).eq("user_id", u.id);
  if (error) throw error;
  return u;
}

async function insertCategory(u: TestUser, name: string, kind: "need" | "want"): Promise<string> {
  const { data, error } = await u.client.from("categories").insert({ name, kind }).select("id").single();
  if (error) throw error;
  return data.id;
}

async function insertPeriod(
  u: TestUser,
  start: string,
  end: string,
  allocations: Record<string, number>,
  money: { income?: number; savings?: number } = {},
): Promise<string> {
  const { data, error } = await u.client
    .from("budget_periods")
    .insert({ start_date: start, end_date: end, income_pence: money.income ?? 300000, savings_pence: money.savings ?? 50000 })
    .select("id")
    .single();
  if (error) throw error;
  const rows = Object.entries(allocations).map(([category_id, amount_pence]) => ({
    period_id: data.id,
    category_id,
    amount_pence,
  }));
  if (rows.length) {
    const ins = await u.client.from("allocations").insert(rows);
    if (ins.error) throw ins.error;
  }
  return data.id;
}

async function periods(u: TestUser) {
  const { data, error } = await admin
    .from("budget_periods")
    .select("id, start_date, end_date, income_pence, savings_pence")
    .eq("user_id", u.id)
    .order("start_date");
  if (error) throw error;
  return data;
}

async function allocationsOf(periodId: string): Promise<Record<string, number>> {
  const { data, error } = await admin.from("allocations").select("category_id, amount_pence").eq("period_id", periodId);
  if (error) throw error;
  return Object.fromEntries(data.map((a) => [a.category_id, a.amount_pence]));
}

async function categoriesOf(u: TestUser) {
  const { data, error } = await admin.from("categories").select("id, name, kind").eq("user_id", u.id).order("name");
  if (error) throw error;
  return data;
}

async function promptsOf(u: TestUser) {
  const { data, error } = await admin.from("savings_prompts").select("period_id, status").eq("user_id", u.id);
  if (error) throw error;
  return data;
}

/** A user with a past October and a current November budget: Rent and Groceries (needs), Eating out (want). */
async function seeded() {
  const u = await signIn();
  const rent = await insertCategory(u, "Rent", "need");
  const food = await insertCategory(u, "Groceries", "need");
  const fun = await insertCategory(u, "Eating out", "want");
  const oct = await insertPeriod(u, "2026-10-01", "2026-10-31", { [rent]: 150000, [food]: 40000, [fun]: 20000 });
  const nov = await insertPeriod(u, "2026-11-01", "2026-11-30", { [rent]: 150000, [food]: 40000, [fun]: 20000 });
  return { u, rent, food, fun, oct, nov };
}

function edit(
  ids: { rent: string; food: string; fun: string },
  over: Partial<BudgetEditInput> = {},
): BudgetEditInput {
  return {
    incomePence: 320000,
    savingsPence: 60000,
    scope: "this",
    categories: [
      { id: ids.rent, name: "Rent", kind: "need", amountPence: 155000 },
      { id: ids.food, name: "Groceries", kind: "need", amountPence: 45000 },
      { id: ids.fun, name: "Eating out", kind: "want", amountPence: 20000 },
    ],
    ...over,
  };
}

describe("budget edit functions", () => {
  it("run as the caller (RLS applies) and only signed-in users may call them", () => {
    const rows = queryAsPostgres<{ name: string; definer: boolean; anon: boolean; authenticated: boolean; path: string }>(`
      select p.proname as name, p.prosecdef as definer,
             has_function_privilege('anon', p.oid, 'execute') as anon,
             has_function_privilege('authenticated', p.oid, 'execute') as authenticated,
             array_to_string(p.proconfig, ',') as path
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname in ('save_budget', 'remove_from_budget', 'delete_category')
      order by p.proname`);
    expect(rows).toEqual(
      ["delete_category", "remove_from_budget", "save_budget"].map((name) => ({
        name,
        definer: false,
        anon: false,
        authenticated: true,
        path: 'search_path=""',
      })),
    );
  });
});

describe("loadBudgetEditor", () => {
  it("returns the current period, no next period yet, and the current allocations with their categories", async () => {
    const { u, rent, food, fun, nov } = await seeded();
    const editor = await loadBudgetEditor(u.client, TODAY);
    expect(editor?.current.id).toBe(nov);
    expect(editor?.next).toBeNull();
    expect(editor?.categories).toEqual([
      { id: fun, name: "Eating out", kind: "want", amountPence: 20000 },
      { id: food, name: "Groceries", kind: "need", amountPence: 40000 },
      { id: rent, name: "Rent", kind: "need", amountPence: 150000 },
    ]);
  });

  it("returns null for a user with no budget", async () => {
    const u = await signIn();
    expect(await loadBudgetEditor(u.client, TODAY)).toBeNull();
  });
});

describe("saveBudget, from this period", () => {
  it("changes the current period's income, savings and allocations, but never a past period", async () => {
    const { u, rent, food, fun, oct, nov } = await seeded();
    await saveBudget(u.client, TODAY, edit({ rent, food, fun }));

    const [p1, p2] = await periods(u);
    expect(p1).toMatchObject({ id: oct, income_pence: 300000, savings_pence: 50000 });
    expect(p2).toMatchObject({ id: nov, income_pence: 320000, savings_pence: 60000 });
    expect(await allocationsOf(oct)).toEqual({ [rent]: 150000, [food]: 40000, [fun]: 20000 });
    expect(await allocationsOf(nov)).toEqual({ [rent]: 155000, [food]: 45000, [fun]: 20000 });
    expect(await periods(u)).toHaveLength(2);
  });

  it("also changes a next period that already exists", async () => {
    const { u, rent, food, fun, nov } = await seeded();
    const dec = await insertPeriod(u, "2026-12-01", "2026-12-31", { [rent]: 1, [food]: 1 });
    await saveBudget(u.client, TODAY, edit({ rent, food, fun }));

    expect(await allocationsOf(nov)).toEqual({ [rent]: 155000, [food]: 45000, [fun]: 20000 });
    expect(await allocationsOf(dec)).toEqual({ [rent]: 155000, [food]: 45000, [fun]: 20000 });
    expect((await periods(u))[2]).toMatchObject({ id: dec, income_pence: 320000, savings_pence: 60000 });
  });

  it("adds a new category, renames and re-kinds one, and removes one from the budget", async () => {
    const { u, rent, food, fun, oct, nov } = await seeded();
    await saveBudget(
      u.client,
      TODAY,
      edit(
        { rent, food, fun },
        {
          categories: [
            { id: rent, name: "Rent", kind: "need", amountPence: 150000 },
            { id: food, name: "Food shop", kind: "want", amountPence: 0 },
            { id: fun, name: "Eating out", kind: "want", amountPence: 20000, removed: true },
            { name: "  Gym  ", kind: "want", amountPence: 3000 },
          ],
        },
      ),
    );

    const cats = await categoriesOf(u);
    const gym = cats.find((c) => c.name === "Gym")!;
    expect(cats).toEqual([
      { id: fun, name: "Eating out", kind: "want" },
      { id: food, name: "Food shop", kind: "want" },
      { id: gym.id, name: "Gym", kind: "want" },
      { id: rent, name: "Rent", kind: "need" },
    ]);
    expect(await allocationsOf(nov)).toEqual({ [rent]: 150000, [food]: 0, [gym.id]: 3000 });
    expect(await allocationsOf(oct)).toEqual({ [rent]: 150000, [food]: 40000, [fun]: 20000 });
  });

  it("adding a category with the name of one outside the budget brings that category back", async () => {
    const { u, rent, food, fun, nov } = await seeded();
    const gifts = await insertCategory(u, "Gifts", "need");
    await saveBudget(
      u.client,
      TODAY,
      edit({ rent, food, fun }, {
        categories: [
          { id: rent, name: "Rent", kind: "need", amountPence: 150000 },
          { name: "gifts", kind: "want", amountPence: 2500 },
        ],
      }),
    );
    expect(await allocationsOf(nov)).toEqual({ [rent]: 150000, [gifts]: 2500 });
    expect((await categoriesOf(u)).find((c) => c.id === gifts)).toEqual({ id: gifts, name: "gifts", kind: "want" });
  });

  it("refuses renaming to the name of another category, ignoring case, and changes nothing", async () => {
    const { u, rent, food, fun, nov } = await seeded();
    await insertCategory(u, "Gifts", "want");
    await expect(
      saveBudget(
        u.client,
        TODAY,
        edit({ rent, food, fun }, {
          categories: [
            { id: rent, name: "GIFTS", kind: "need", amountPence: 1 },
            { id: food, name: "Groceries", kind: "need", amountPence: 1 },
          ],
        }),
      ),
    ).rejects.toBeInstanceOf(NameTakenError);
    expect(await allocationsOf(nov)).toEqual({ [rent]: 150000, [food]: 40000, [fun]: 20000 });
    expect((await periods(u))[1].income_pence).toBe(300000);
  });

  it("opens a waiting savings prompt when savings start, and drops a waiting one when they stop", async () => {
    const u = await signIn();
    const rent = await insertCategory(u, "Rent", "need");
    const nov = await insertPeriod(u, "2026-11-01", "2026-11-30", { [rent]: 1000 }, { savings: 0 });
    const input = { incomePence: 300000, scope: "this" as const, categories: [{ id: rent, name: "Rent", kind: "need" as const, amountPence: 1000 }] };

    await saveBudget(u.client, TODAY, { ...input, savingsPence: 20000 });
    expect(await promptsOf(u)).toEqual([{ period_id: nov, status: "waiting" }]);

    await saveBudget(u.client, TODAY, { ...input, savingsPence: 0 });
    expect(await promptsOf(u)).toEqual([]);
  });
});

describe("saveBudget, from next period", () => {
  it("leaves the current period unchanged and creates the next period with the new figures", async () => {
    const { u, rent, food, fun, nov } = await seeded();
    await saveBudget(u.client, TODAY, edit({ rent, food, fun }, { scope: "next" }));

    const all = await periods(u);
    expect(all).toHaveLength(3);
    expect(all[1]).toMatchObject({ id: nov, income_pence: 300000, savings_pence: 50000 });
    expect(await allocationsOf(nov)).toEqual({ [rent]: 150000, [food]: 40000, [fun]: 20000 });
    expect(all[2]).toMatchObject({
      start_date: "2026-12-01",
      end_date: "2026-12-31",
      income_pence: 320000,
      savings_pence: 60000,
    });
    expect(await allocationsOf(all[2].id)).toEqual({ [rent]: 155000, [food]: 45000, [fun]: 20000 });
    expect(await promptsOf(u)).toEqual([{ period_id: all[2].id, status: "waiting" }]);
  });

  it("uses the start day for the next period's end", async () => {
    const u = await signIn(25);
    const rent = await insertCategory(u, "Rent", "need");
    await insertPeriod(u, "2026-10-25", "2026-11-24", { [rent]: 1000 });
    await saveBudget(u.client, TODAY, {
      incomePence: 300000,
      savingsPence: 0,
      scope: "next",
      categories: [{ id: rent, name: "Rent", kind: "need", amountPence: 2000 }],
    });
    expect((await periods(u))[1]).toMatchObject({ start_date: "2026-11-25", end_date: "2026-12-24" });
  });

  it("updates a next period that already exists, and only that one", async () => {
    const { u, rent, food, fun, nov } = await seeded();
    const dec = await insertPeriod(u, "2026-12-01", "2026-12-31", { [rent]: 1 });
    await saveBudget(u.client, TODAY, edit({ rent, food, fun }, { scope: "next" }));

    expect(await periods(u)).toHaveLength(3);
    expect(await allocationsOf(nov)).toEqual({ [rent]: 150000, [food]: 40000, [fun]: 20000 });
    expect(await allocationsOf(dec)).toEqual({ [rent]: 155000, [food]: 45000, [fun]: 20000 });
  });
});

describe("a pre-created next period", () => {
  it("ensureCurrentPeriod on its first day returns it: no duplicate and no overlap", async () => {
    const { u, rent, food, fun } = await seeded();
    await saveBudget(u.client, TODAY, edit({ rent, food, fun }, { scope: "next" }));
    const dec = (await periods(u))[2];

    const got = await ensureCurrentPeriod(u.client, "2026-12-01");
    expect(got?.id).toBe(dec.id);
    expect(got?.income_pence).toBe(320000);
    expect(await periods(u)).toHaveLength(3);
  });

  it("renew_period refuses a period that would overlap a later one", async () => {
    const { u } = await seeded();
    await insertPeriod(u, "2026-12-10", "2027-01-09", {});
    const { error } = await u.client.rpc("renew_period", { p_start: "2026-12-01", p_end: "2026-12-31" });
    expect(error?.code).toBe("22023");
    expect(await periods(u)).toHaveLength(3);
  });
});

describe("renameCategory", () => {
  it("renames, trimming the name", async () => {
    const { u, food } = await seeded();
    await renameCategory(u.client, food, "  Food shop ");
    expect((await categoriesOf(u)).find((c) => c.id === food)?.name).toBe("Food shop");
  });

  it("allows changing only the case of its own name", async () => {
    const { u, food } = await seeded();
    await renameCategory(u.client, food, "groceries");
    expect((await categoriesOf(u)).find((c) => c.id === food)?.name).toBe("groceries");
  });

  it("refuses a name another category has, ignoring case", async () => {
    const { u, food } = await seeded();
    await expect(renameCategory(u.client, food, "rent")).rejects.toBeInstanceOf(NameTakenError);
    expect((await categoriesOf(u)).find((c) => c.id === food)?.name).toBe("Groceries");
  });

  it("refuses an empty or over-long name", async () => {
    const { u, food } = await seeded();
    await expect(renameCategory(u.client, food, "  ")).rejects.toThrow();
    await expect(renameCategory(u.client, food, "x".repeat(51))).rejects.toThrow();
  });
});

describe("deleteCategory", () => {
  it("deletes a category that was never used, with its allocations", async () => {
    const { u, fun, nov } = await seeded();
    await deleteCategory(u.client, fun);
    expect((await categoriesOf(u)).map((c) => c.id)).not.toContain(fun);
    expect(await allocationsOf(nov)).not.toHaveProperty(fun);
  });

  it("refuses a category with transactions, and deletes nothing", async () => {
    const { u, food, nov } = await seeded();
    const t = await u.client
      .from("transactions")
      .insert({ name: "Tesco", amount_pence: 100, date: "2026-10-03", category_id: food });
    if (t.error) throw t.error;
    await expect(deleteCategory(u.client, food)).rejects.toBeInstanceOf(CategoryInUseError);
    expect((await categoriesOf(u)).map((c) => c.id)).toContain(food);
    expect(await allocationsOf(nov)).toHaveProperty(food);
  });

  it("refuses a category with a recurring payment", async () => {
    const { u, rent } = await seeded();
    const r = await u.client
      .from("recurring_rules")
      .insert({ name: "Rent", category_id: rent, frequency: "monthly", anchor_date: "2026-11-01" });
    if (r.error) throw r.error;
    await expect(deleteCategory(u.client, rent)).rejects.toBeInstanceOf(CategoryInUseError);
  });
});

describe("removeFromBudget", () => {
  it("from this period: drops the allocation from the current and next periods, not past ones", async () => {
    const { u, rent, food, fun, oct, nov } = await seeded();
    const dec = await insertPeriod(u, "2026-12-01", "2026-12-31", { [rent]: 1, [food]: 1 });
    await removeFromBudget(u.client, TODAY, food, "this");

    expect(await allocationsOf(oct)).toEqual({ [rent]: 150000, [food]: 40000, [fun]: 20000 });
    expect(await allocationsOf(nov)).toEqual({ [rent]: 150000, [fun]: 20000 });
    expect(await allocationsOf(dec)).toEqual({ [rent]: 1 });
    expect((await categoriesOf(u)).map((c) => c.id)).toContain(food);
  });

  it("from next period: keeps the current allocation and creates the next period without it", async () => {
    const { u, rent, food, fun, nov } = await seeded();
    await removeFromBudget(u.client, TODAY, food, "next");

    expect(await allocationsOf(nov)).toEqual({ [rent]: 150000, [food]: 40000, [fun]: 20000 });
    const dec = (await periods(u))[2];
    expect(dec).toMatchObject({ start_date: "2026-12-01", end_date: "2026-12-31", income_pence: 300000 });
    expect(await allocationsOf(dec.id)).toEqual({ [rent]: 150000, [fun]: 20000 });
  });
});

describe("isolation", () => {
  it("another user can't edit, rename, delete or remove from this user's budget", async () => {
    const { u, rent, food, fun, nov } = await seeded();
    const other = await signIn();
    await insertPeriod(other, "2026-11-01", "2026-11-30", {});

    const direct = await other.client.rpc("save_budget", {
      p_period_id: nov,
      p_next_end: "2026-12-31",
      p_scope: "this",
      p_income_pence: 1,
      p_savings_pence: 0,
      p_categories: [{ id: rent, name: "Mine", kind: "need", amount_pence: 1 }],
    });
    expect(direct.error).not.toBeNull();
    await expect(
      saveBudget(other.client, TODAY, edit({ rent, food, fun })),
    ).rejects.toThrow();
    await expect(renameCategory(other.client, rent, "Mine")).rejects.toThrow();
    await expect(deleteCategory(other.client, rent)).rejects.toThrow();
    await expect(removeFromBudget(other.client, TODAY, rent, "this")).rejects.toThrow();

    expect(await allocationsOf(nov)).toEqual({ [rent]: 150000, [food]: 40000, [fun]: 20000 });
    expect((await categoriesOf(u)).map((c) => c.name)).toEqual(["Eating out", "Groceries", "Rent"]);
  });
});

describe("save_budget called directly", () => {
  const ok = (rent: string) => ({ id: rent, name: "Rent", kind: "need", amount_pence: 1000 });
  const cases: [string, (rent: string) => Record<string, unknown>][] = [
    ["categories not an array", () => ({ p_categories: { name: "Rent" } })],
    [
      "51 categories in the budget",
      () => ({ p_categories: Array.from({ length: 51 }, (_, i) => ({ name: `C${i}`, kind: "need", amount_pence: 1 })) }),
    ],
    ["a name over 50 characters", (rent) => ({ p_categories: [{ ...ok(rent), name: "x".repeat(51) }] })],
    ["a blank name", (rent) => ({ p_categories: [{ ...ok(rent), name: "   " }] })],
    ["a bad kind", (rent) => ({ p_categories: [{ ...ok(rent), kind: "luxury" }] })],
    ["a negative amount", (rent) => ({ p_categories: [{ ...ok(rent), amount_pence: -1 }] })],
    ["an amount over £10m", (rent) => ({ p_categories: [{ ...ok(rent), amount_pence: 1_000_000_001 }] })],
    ["income over £10m", () => ({ p_income_pence: 1_000_000_001 })],
    ["savings over income", () => ({ p_savings_pence: 300001 })],
    ["a bad scope", () => ({ p_scope: "past" })],
    ["an unknown category id", () => ({ p_categories: [ok(crypto.randomUUID())] })],
    ["a next period ending before it starts", () => ({ p_scope: "next", p_next_end: "2026-11-30" })],
  ];

  it.each(cases)("refuses %s and changes nothing", async (_, override) => {
    const { u, rent, food, fun, nov } = await seeded();
    const { error } = await u.client.rpc("save_budget", {
      p_period_id: nov,
      p_next_end: "2026-12-31",
      p_scope: "this",
      p_income_pence: 300000,
      p_savings_pence: 0,
      p_categories: [ok(rent)],
      ...override(rent),
    });
    expect(error).not.toBeNull();
    expect(await periods(u)).toHaveLength(2);
    expect((await periods(u))[1].savings_pence).toBe(50000);
    expect(await allocationsOf(nov)).toEqual({ [rent]: 150000, [food]: 40000, [fun]: 20000 });
  });
});

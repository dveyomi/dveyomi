import { afterEach, describe, expect, it } from "vitest";
import { createSignedInUser, deleteUser, queryAsPostgres, type TestUser } from "@/db/testClients";
import { addDays, todayIn } from "@/lib/calc";
import { expenseDateRange } from "@/lib/validation/expense";
import { findDuplicates, mapRows, parseCsv } from "@/lib/import/csv";
import { loadBudgetView } from "./budget";
import {
  commitImport,
  existingExpensesFor,
  ImportBatchNotFoundError,
  listImports,
  undoImport,
  type CommitRow,
} from "./imports";
import { MissingReferenceError } from "./transactions";
import type { Db } from "./types";

const users: TestUser[] = [];
afterEach(async () => {
  await Promise.all(users.splice(0).map((u) => deleteUser(u)));
});

/** The budget's "today" (fixed, like the seeded November period). */
const TODAY = "2026-11-21";
/** The real today: import_expenses refuses a today more than a day from the server's. */
const NOW = todayIn("UTC", new Date());
const RANGE = expenseDateRange(NOW);
const db = (u: TestUser) => u.client as unknown as Db;

/** A user with Groceries and Eating out, a November budget, and a manual Tesco expense on 5 Nov. */
async function seed(label = "import") {
  const u = await createSignedInUser(label);
  users.push(u);
  const profile = await u.client.from("profiles").update({ budget_start_day: 1 }).eq("user_id", u.id);
  if (profile.error) throw profile.error;
  const cats = await u.client
    .from("categories")
    .insert([
      { name: "Groceries", kind: "need" },
      { name: "Eating out", kind: "want" },
    ])
    .select("id, name");
  if (cats.error) throw cats.error;
  const cat = (name: string) => cats.data.find((c) => c.name === name)!.id;
  const period = await u.client
    .from("budget_periods")
    .insert({ start_date: "2026-11-01", end_date: "2026-11-30", income_pence: 300000, savings_pence: 0 })
    .select("id")
    .single();
  if (period.error) throw period.error;
  const allocs = await u.client.from("allocations").insert([
    { period_id: period.data.id, category_id: cat("Groceries"), amount_pence: 40000 },
    { period_id: period.data.id, category_id: cat("Eating out"), amount_pence: 20000 },
  ]);
  if (allocs.error) throw allocs.error;
  const manual = await u.client
    .from("transactions")
    .insert({ name: "Tesco", amount_pence: 1250, date: "2026-11-05", category_id: cat("Groceries") });
  if (manual.error) throw manual.error;
  return { u, cat };
}

const row = (over: Partial<CommitRow> = {}): CommitRow => ({ row: 2, date: "2026-11-10", amountPence: 499, name: "Pret", ...over });

const countRows = async (u: TestUser) => {
  const { count, error } = await u.client.from("transactions").select("id", { count: "exact", head: true });
  if (error) throw error;
  return count;
};

const BANK_FILE = [
  "Date,Description,Amount",
  "05/11/2026,TESCO,-12.50",
  "10/11/2026,PRET A MANGER,-4.99",
  "12/11/2026,Salary,2500.00",
  "14/11/2026,Wagamama,-23.40",
].join("\n");

describe("commitImport", () => {
  it("saves every row in one batch with source csv, the batch id, no external id, and checked", async () => {
    const { u, cat } = await seed();
    const result = await commitImport(db(u), [row(), row({ row: 3, name: "Wagamama", amountPence: 2340, categoryId: cat("Eating out") })], cat("Groceries"), {
      filename: "november.csv",
      today: NOW,
    });
    expect(result.inserted).toBe(2);

    const { data, error } = await u.client
      .from("transactions")
      .select("name, amount_pence, date, category_id, source, external_id, import_batch_id, unchecked")
      .eq("import_batch_id", result.batchId)
      .order("name");
    if (error) throw error;
    expect(data).toEqual([
      {
        name: "Pret",
        amount_pence: 499,
        date: "2026-11-10",
        category_id: cat("Groceries"),
        source: "csv",
        external_id: null,
        import_batch_id: result.batchId,
        unchecked: false,
      },
      {
        name: "Wagamama",
        amount_pence: 2340,
        date: "2026-11-10",
        category_id: cat("Eating out"),
        source: "csv",
        external_id: null,
        import_batch_id: result.batchId,
        unchecked: false,
      },
    ]);
    const batch = await u.client.from("import_batches").select("filename, user_id").eq("id", result.batchId).single();
    expect(batch.data).toEqual({ filename: "november.csv", user_id: u.id });
  });

  it("is all or nothing: one bad row saves nothing, not even the batch", async () => {
    const { u, cat } = await seed();
    const before = await countRows(u);
    await expect(
      commitImport(db(u), [row(), row({ amountPence: 0 })], cat("Groceries"), { filename: "bad.csv", today: NOW }),
    ).rejects.toThrow();
    expect(await countRows(u)).toBe(before);
    const batches = await u.client.from("import_batches").select("id");
    expect(batches.data).toEqual([]);
  });

  it("refuses another user's category and saves nothing", async () => {
    const { u, cat } = await seed("import-a");
    const other = await seed("import-b");
    await expect(
      commitImport(db(u), [row(), row({ categoryId: other.cat("Groceries") })], cat("Groceries"), { filename: "x.csv", today: NOW }),
    ).rejects.toBeInstanceOf(MissingReferenceError);
    expect(await countRows(u)).toBe(1);
    expect(await countRows(other.u)).toBe(1);
  });

  it("checks its bounds in the database too", async () => {
    const { u, cat } = await seed();
    const call = (args: Record<string, unknown>) =>
      u.client.rpc("import_expenses" as never, {
        p_filename: "f.csv",
        p_today: NOW,
        p_rows: [{ name: "Pret", amount_pence: 499, date: "2026-11-10", category_id: cat("Groceries") }],
        ...args,
      } as never);
    const good = { name: "Pret", amount_pence: 499, date: "2026-11-10", category_id: cat("Groceries") };
    const cases: Record<string, unknown>[] = [
      { p_rows: [] },
      { p_rows: Array.from({ length: 5001 }, () => good) },
      { p_rows: [{ ...good, name: "   " }] },
      { p_rows: [{ ...good, name: "x".repeat(101) }] },
      { p_rows: [{ ...good, amount_pence: 0 }] },
      { p_rows: [{ ...good, amount_pence: 1000000001 }] },
      { p_rows: [{ ...good, amount_pence: 1.5 }] },
      { p_rows: [{ ...good, date: addDays(RANGE.min, -1) }] },
      { p_rows: [{ ...good, date: addDays(RANGE.max, 1) }] },
      { p_rows: [{ ...good, date: "21/11/2026" }] },
      { p_rows: [{ ...good, category_id: "not-a-uuid" }] },
      ...(["name", "amount_pence", "date", "category_id"] as const).map((key) => ({
        p_rows: [Object.fromEntries(Object.entries(good).filter(([k]) => k !== key))],
      })),
      { p_filename: "" },
      { p_filename: "x".repeat(256) },
      { p_today: addDays(NOW, -2) },
      { p_today: addDays(NOW, 2) },
    ];
    for (const args of cases) {
      const { error } = await call(args);
      expect(error?.code, JSON.stringify(args).slice(0, 80)).toBe("22023");
    }
    expect(await countRows(u)).toBe(1);
    const ok = await call({ p_rows: [{ ...good, name: "  Pret  ", date: RANGE.min }] });
    expect(ok.error).toBeNull();
    const saved = await u.client.from("transactions").select("name").eq("date", RANGE.min).single();
    expect(saved.data).toEqual({ name: "Pret" });
  });
});

describe("importing the same file twice", () => {
  it("inserts zero rows the second time when the flagged duplicates stay unticked", async () => {
    const { u, cat } = await seed();
    const rows = parseCsv(BANK_FILE);
    const { ok } = mapRows(rows, { date: 0, name: 1, amount: 2, dateFormat: "DD/MM/YYYY", hasHeader: true }, NOW);
    expect(ok).toHaveLength(3);

    const importTicked = async () => {
      const existing = await existingExpensesFor(db(u), ok);
      const dupes = findDuplicates(ok, existing);
      const ticked = ok.filter((_, i) => !dupes.has(i));
      return ticked.length === 0 ? 0 : (await commitImport(db(u), ticked, cat("Groceries"), { filename: "bank.csv", today: NOW })).inserted;
    };

    // The manual Tesco on 5 Nov is a duplicate; Pret and Wagamama go in.
    expect(await importTicked()).toBe(2);
    expect(await importTicked()).toBe(0);
    expect(await countRows(u)).toBe(3);
  });
});

describe("existingExpensesFor", () => {
  it("returns the user's expenses within the rows' dates only", async () => {
    const { u, cat } = await seed();
    const other = await seed("import-other");
    await u.client.from("transactions").insert([
      { name: "Before", amount_pence: 100, date: "2026-11-01", category_id: cat("Groceries") },
      { name: "After", amount_pence: 100, date: "2026-11-30", category_id: cat("Groceries") },
    ]);
    const existing = await existingExpensesFor(db(u), [row({ date: "2026-11-05" }), row({ date: "2026-11-20" })]);
    expect(existing).toEqual([{ date: "2026-11-05", amountPence: 1250, name: "Tesco" }]);
    expect(await existingExpensesFor(db(other.u), [])).toEqual([]);
  });
});

describe("listImports and undoImport", () => {
  it("lists imports newest first with their row counts, and undo removes only that batch", async () => {
    const { u, cat } = await seed();
    const first = await commitImport(db(u), [row(), row({ name: "Boots" })], cat("Groceries"), { filename: "oct.csv", today: NOW });
    const second = await commitImport(db(u), [row({ name: "Costa" })], cat("Groceries"), { filename: "nov.csv", today: NOW });

    const listed = await listImports(db(u));
    expect(listed.map((b) => [b.id, b.filename, b.rowCount])).toEqual([
      [second.batchId, "nov.csv", 1],
      [first.batchId, "oct.csv", 2],
    ]);
    expect(typeof listed[0].createdAt).toBe("string");

    expect(await undoImport(db(u), first.batchId)).toBe(2);
    const names = await u.client.from("transactions").select("name").order("name");
    expect(names.data!.map((t) => t.name)).toEqual(["Costa", "Tesco"]);
    expect((await listImports(db(u))).map((b) => b.id)).toEqual([second.batchId]);
  });

  it("can't undo another user's import", async () => {
    const a = await seed("undo-a");
    const b = await seed("undo-b");
    const theirs = await commitImport(db(b.u), [row()], b.cat("Groceries"), { filename: "b.csv", today: NOW });
    await expect(undoImport(db(a.u), theirs.batchId)).rejects.toBeInstanceOf(ImportBatchNotFoundError);
    expect(await countRows(b.u)).toBe(2);
    expect(await listImports(db(a.u))).toEqual([]);
  });
});

describe("imported expenses in the budget", () => {
  it("count in spent exactly like manual ones", async () => {
    const { u, cat } = await seed();
    const before = await loadBudgetView(db(u), TODAY);
    const groceries = (v: typeof before) => v.summary!.categories.find((c) => c.categoryId === cat("Groceries"))!;
    expect(groceries(before).spentPence).toBe(1250);

    await commitImport(db(u), [row({ amountPence: 2000 }), row({ name: "Costa", amountPence: 350, categoryId: cat("Eating out") })], cat("Groceries"), {
      filename: "nov.csv",
      today: NOW,
    });
    const after = await loadBudgetView(db(u), TODAY);
    expect(groceries(after).spentPence).toBe(3250);
    expect(after.summary!.categories.find((c) => c.categoryId === cat("Eating out"))!.spentPence).toBe(350);
    expect(after.summary!.spentPence).toBe(before.summary!.spentPence + 2350);
  });
});

describe.each(["import_expenses", "undo_import"])("%s", (fn) => {
  it("runs as the caller (RLS applies) and only signed-in users may call it", () => {
    const rows = queryAsPostgres<{ anon: boolean; authenticated: boolean; public: boolean; definer: boolean; config: string[] }>(
      `select has_function_privilege('anon', p.oid, 'execute') as anon,
              has_function_privilege('authenticated', p.oid, 'execute') as authenticated,
              exists (select 1 from aclexplode(p.proacl) a where a.grantee = 0) as public,
              p.prosecdef as definer,
              p.proconfig as config
       from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.proname = '${fn}'`,
    );
    expect(rows).toEqual([{ anon: false, authenticated: true, public: false, definer: false, config: ['search_path=""'] }]);
  });
});

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { seedEveryTable, userTablesInSchema } from "@/db/seedEveryTable";
import { createSignedInUser, deleteUser, type TestUser } from "@/db/testClients";
import { exportUserData, USER_TABLES } from "@/lib/data/account";
import type { Db } from "@/lib/data/types";

let a: TestUser;
let b: TestUser;
let exported: Awaited<ReturnType<typeof exportUserData>>;

/** More than PostgREST's max_rows (1,000), so a single read would come back short. */
const EXTRA = 1_100;

beforeAll(async () => {
  a = await createSignedInUser("export-a");
  b = await createSignedInUser("export-b");
  await seedEveryTable(a.id, EXTRA);
  await seedEveryTable(b.id);
  exported = await exportUserData(a.client as unknown as Db);
}, 120_000);

afterAll(async () => {
  await deleteUser(a);
  await deleteUser(b);
});

describe("exportUserData", () => {
  it("covers every user table in the schema", () => {
    expect([...USER_TABLES].sort()).toEqual(userTablesInSchema());
    expect(Object.keys(exported).sort()).toEqual(userTablesInSchema());
  });

  it("has A's rows in every table, and only A's", () => {
    for (const table of USER_TABLES) {
      const rows = exported[table] as { user_id: string }[];
      expect(rows.length, table).toBeGreaterThan(0);
      expect(rows.every((r) => r.user_id === a.id), table).toBe(true);
    }
  });

  it("pages past 1,000 rows: every one of A's transactions, none of B's", () => {
    const txns = exported.transactions as { id: string; user_id: string; name: string }[];
    expect(txns).toHaveLength(EXTRA + 5);
    expect(new Set(txns.map((t) => t.id)).size).toBe(EXTRA + 5);
    expect(txns.some((t) => t.name === "Coffee 1100")).toBe(true);
    expect(txns.filter((t) => t.user_id === b.id)).toEqual([]);
  });

  it("includes the profile with its settings", () => {
    expect(exported.profiles).toEqual([
      expect.objectContaining({ user_id: a.id, currency: "GBP", timezone: "Europe/London", budget_start_day: 1 }),
    ]);
  });
});

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { countRows, seedEveryTable, userTablesInSchema } from "@/db/seedEveryTable";
import { admin, createSignedInUser, deleteUser, type TestUser } from "@/db/testClients";
import { deleteAccount } from "@/lib/data/account";
import type { Db } from "@/lib/data/types";

let a: TestUser;
let b: TestUser;
let tables: string[];
const before: Record<string, number> = {};

beforeAll(async () => {
  a = await createSignedInUser("delete-a");
  b = await createSignedInUser("delete-b");
  await seedEveryTable(a.id);
  await seedEveryTable(b.id);
  tables = userTablesInSchema();
  for (const t of tables) before[t] = await countRows(t, b.id);
}, 60_000);

afterAll(async () => {
  await deleteUser(b);
});

describe("deleteAccount", () => {
  it("A starts with rows in every table", async () => {
    for (const t of tables) expect(await countRows(t, a.id), t).toBeGreaterThan(0);
  });

  it("removes the auth user and every one of A's rows (a trip with manual overrides included)", async () => {
    await deleteAccount(admin as unknown as Db, a.id);
    for (const t of tables) expect(await countRows(t, a.id), t).toBe(0);
    const { data, error } = await admin.auth.admin.getUserById(a.id);
    expect(data.user).toBeNull();
    expect(error).not.toBeNull();
  });

  it("leaves B untouched", async () => {
    for (const t of tables) expect(await countRows(t, b.id), t).toBe(before[t]);
    const { data } = await admin.auth.admin.getUserById(b.id);
    expect(data.user?.id).toBe(b.id);
  });
});

import { describe, expect, it } from "vitest";
import { exportUserData, USER_TABLES } from "./account";
import type { Db } from "./types";

/** A fake client whose server returns at most `cap` rows per request, whatever range is asked for. */
function cappedClient(rowsPerTable: number, cap: number) {
  const calls: { table: string; from: number; to: number; count?: string }[] = [];
  const client = {
    from: (table: string) => {
      let count: string | undefined;
      const q = {
        select: (_: string, opts?: { count?: string }) => ((count = opts?.count), q),
        order: () => q,
        range: async (from: number, to: number) => {
          calls.push({ table, from, to, count });
          const all = Array.from({ length: rowsPerTable }, (_, i) => ({ id: `${table}-${i}` }));
          const data = all.slice(from, Math.min(to + 1, from + cap));
          return { data, error: null, count: count ? rowsPerTable : null };
        },
      };
      return q;
    },
  };
  return { client: client as unknown as Db, calls };
}

describe("exportUserData paging", () => {
  it("reads every row even when the server caps pages below the page size", async () => {
    const { client, calls } = cappedClient(5, 2);
    const data = await exportUserData(client, 4);
    for (const table of USER_TABLES) expect(data[table].map((r) => r.id), table).toEqual([0, 1, 2, 3, 4].map((i) => `${table}-${i}`));
    // Only the first request per table asks for the count.
    expect(calls.filter((c) => c.table === "transactions").map((c) => [c.from, c.count ?? null])).toEqual([
      [0, "exact"],
      [2, null],
      [4, null],
    ]);
  });

  it("stops at an empty page if rows vanish mid-export", async () => {
    const { client } = cappedClient(0, 2);
    const data = await exportUserData(client, 4);
    expect(data.transactions).toEqual([]);
  });
});

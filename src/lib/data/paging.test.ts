import { describe, expect, it } from "vitest";
import { allRows } from "./paging";

/** A fake query over `total` rows that returns at most `cap` per request, like PostgREST's max_rows. */
function fakeQuery(total: number, cap: number, { countKnown = true } = {}) {
  const rows = Array.from({ length: total }, (_, i) => i);
  const calls: { from: number; to: number; count: boolean }[] = [];
  const query = (opts: { count?: "exact" }) => ({
    range: async (from: number, to: number) => {
      calls.push({ from, to, count: opts.count === "exact" });
      const data = rows.slice(from, Math.min(to + 1, from + cap));
      return { data, error: null, count: opts.count === "exact" && countKnown ? total : null };
    },
  });
  return { query, calls };
}

describe("allRows", () => {
  it("reads every page, asking for the count only once", async () => {
    const { query, calls } = fakeQuery(2500, 1000);
    expect(await allRows(query, 1000)).toHaveLength(2500);
    expect(calls).toEqual([
      { from: 0, to: 999, count: true },
      { from: 1000, to: 1999, count: false },
      { from: 2000, to: 2999, count: false },
    ]);
  });

  it("keeps reading when the server caps pages below the page size", async () => {
    const { query } = fakeQuery(2500, 300);
    expect(await allRows(query, 1000)).toEqual(Array.from({ length: 2500 }, (_, i) => i));
  });

  it("without a count, stops at the first short page", async () => {
    const { query, calls } = fakeQuery(2500, 1000, { countKnown: false });
    expect(await allRows(query, 1000)).toHaveLength(2500);
    expect(calls).toHaveLength(3);
  });

  it("without a count, an exact multiple of the page size ends on an empty page", async () => {
    const { query, calls } = fakeQuery(2000, 1000, { countKnown: false });
    expect(await allRows(query, 1000)).toHaveLength(2000);
    expect(calls).toHaveLength(3);
  });

  it("stops on an empty page even when the count says more (rows deleted meanwhile)", async () => {
    const { query } = fakeQuery(1500, 1000);
    const shrinking = (opts: { count?: "exact" }) => {
      const q = query(opts);
      return {
        range: async (from: number, to: number) => {
          const r = await q.range(from, to);
          return from === 0 ? { ...r, count: 5000 } : r;
        },
      };
    };
    expect(await allRows(shrinking, 1000)).toHaveLength(1500);
  });

  it("throws the query's error", async () => {
    const boom = new Error("boom");
    const failing = () => ({ range: async () => ({ data: null, error: boom, count: null }) });
    await expect(allRows(failing, 1000)).rejects.toBe(boom);
  });
});

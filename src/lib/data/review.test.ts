import { beforeEach, describe, expect, it, vi } from "vitest";

const { loadPeriodSummary, ensureCurrentPeriod } = vi.hoisted(() => ({
  loadPeriodSummary: vi.fn(),
  ensureCurrentPeriod: vi.fn(),
}));
vi.mock("./budget", async (importOriginal) => ({ ...(await importOriginal<typeof import("./budget")>()), loadPeriodSummary }));
vi.mock("./ensurePeriod", () => ({ ensureCurrentPeriod }));

import { FundNameTakenError } from "./funds";
import { AlreadyReviewedError, fromFundLabel, recordLeftover } from "./review";
import { saveBudget } from "./budgetEdit";
import type { Db } from "./types";

/** A fake client: every query chain resolves to `results[table]`; rpc resolves to `rpcResult`. */
function fakeClient(results: Record<string, unknown>, rpcResult: unknown): Db {
  const chain = (table: string): unknown =>
    new Proxy(
      {},
      {
        get: (_, prop) =>
          prop === "then"
            ? (resolve: (v: unknown) => void) => resolve(results[table] ?? { data: null, error: null })
            : () => chain(table),
      },
    );
  return { from: (table: string) => chain(table), rpc: async () => rpcResult } as unknown as Db;
}

const PERIOD = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
  ensureCurrentPeriod.mockReset().mockResolvedValue({ id: "nov", end_date: "2026-11-30" });
  loadPeriodSummary.mockReset().mockResolvedValue({ row: { unassigned_carry_pence: 0 }, summary: { leftToSpendPence: 25000 } });
});

describe("recordLeftover's unique-key refusal", () => {
  const taken = fakeClient({}, { error: { code: "23505" } });

  it("is FundNameTakenError when a new fund was named", async () => {
    await expect(recordLeftover(taken, "2026-11-21", PERIOD, { destination: "fund", newFundName: "Holiday" })).rejects.toThrow(
      FundNameTakenError,
    );
  });

  it("is AlreadyReviewedError otherwise (the period was reviewed meanwhile)", async () => {
    await expect(recordLeftover(taken, "2026-11-21", PERIOD, { destination: "unassigned" })).rejects.toThrow(AlreadyReviewedError);
  });
});

describe("saveBudget", () => {
  it("still succeeds when hiding the nudge fails after the save committed", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const client = fakeClient(
      { profiles: { data: { budget_start_day: 1 }, error: null }, leftover_movements: { data: null, error: { message: "offline" } } },
      { error: null },
    );
    await expect(
      saveBudget(client, "2026-11-21", { incomePence: 300000, savingsPence: 0, scope: "this", categories: [] }),
    ).resolves.toBeUndefined();
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });
});

describe("fromFundLabel", () => {
  it("adds fund after a plain name", () => {
    expect(fromFundLabel("Emergency")).toBe("from Emergency fund");
  });

  it("doesn't say fund twice when the name already ends with it, in any case", () => {
    expect(fromFundLabel("Rainy Day Fund")).toBe("from Rainy Day Fund");
    expect(fromFundLabel("holiday fund")).toBe("from holiday fund");
    expect(fromFundLabel("Refund")).toBe("from Refund");
  });

  it("says a fund when it has been deleted", () => {
    expect(fromFundLabel(null)).toBe("from a fund");
  });
});

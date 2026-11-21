import { describe, expect, it } from "vitest";
import { allocationTotals, splitRemainder } from "./setup";

describe("allocationTotals", () => {
  it("the pool is income minus savings, split into needs and wants", () => {
    const t = allocationTotals(600000, 50000, [
      { kind: "need", amountPence: 200000 },
      { kind: "want", amountPence: 100000 },
      { kind: "need", amountPence: 50000 },
    ]);
    expect(t).toEqual({
      poolPence: 550000,
      needsPence: 250000,
      wantsPence: 100000,
      allocatedPence: 350000,
      unallocatedPence: 200000,
      overAllocatedPence: 0,
    });
  });

  it("reports how far allocations are over the pool", () => {
    const t = allocationTotals(100000, 0, [{ kind: "need", amountPence: 120000 }]);
    expect(t.overAllocatedPence).toBe(20000);
    expect(t.unallocatedPence).toBe(0);
  });

  it("savings shrink the pool and can push allocations over", () => {
    const t = allocationTotals(100000, 30000, [{ kind: "want", amountPence: 80000 }]);
    expect(t.poolPence).toBe(70000);
    expect(t.overAllocatedPence).toBe(10000);
  });

  it("no allocations: nothing allocated, the whole pool unallocated", () => {
    expect(allocationTotals(100000, 0, [])).toMatchObject({ allocatedPence: 0, unallocatedPence: 100000 });
  });
});

describe("splitRemainder", () => {
  it("is the total minus the parts: positive while some is still to split", () => {
    expect(splitRemainder(30000, [10000, 5000])).toBe(15000);
  });
  it("is zero when the parts match the total", () => {
    expect(splitRemainder(30000, [10000, 20000])).toBe(0);
  });
  it("is negative when the parts exceed the total", () => {
    expect(splitRemainder(30000, [40000])).toBe(-10000);
  });
});

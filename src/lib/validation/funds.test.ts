import { describe, expect, it } from "vitest";
import { validateConfirmSplit, validateFund, validateFundMove, validateMovement, validateWithdrawal } from "./funds";

const FUND = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const TODAY = "2026-11-21";

describe("validateFund", () => {
  it("trims the name and keeps a target and target date", () => {
    expect(validateFund({ name: " Holiday ", targetPence: 100000, targetDate: "2027-07-31" })).toEqual({
      ok: true,
      input: { name: "Holiday", targetPence: 100000, targetDate: "2027-07-31" },
    });
  });

  it("reads a missing or £0 target and an empty date as none", () => {
    expect(validateFund({ name: "Rainy day", targetPence: 0, targetDate: "" })).toEqual({
      ok: true,
      input: { name: "Rainy day", targetPence: null, targetDate: null },
    });
    expect(validateFund({ name: "Rainy day" })).toMatchObject({ ok: true, input: { targetPence: null, targetDate: null } });
  });

  it.each([
    [{ name: "  " }, "name"],
    [{ name: "x".repeat(51) }, "name"],
    [{ name: "A", targetPence: -1 }, "target"],
    [{ name: "A", targetPence: 1.5 }, "target"],
    [{ name: "A", targetPence: 1_000_000_001 }, "target"],
    [{ name: "A", targetDate: "2027-02-30" }, "targetDate"],
    [{ name: "A", targetDate: "1999-12-31" }, "targetDate"],
  ])("refuses %j (field %s)", (raw, field) => {
    expect(validateFund(raw)).toEqual({ ok: false, error: expect.any(String), field });
  });
});

describe("validateMovement", () => {
  it("keeps a dated contribution with a trimmed note", () => {
    expect(validateMovement({ kind: "contribution", amountPence: 5000, date: TODAY, note: " Gift " }, TODAY)).toEqual({
      ok: true,
      input: { kind: "contribution", amountPence: 5000, date: TODAY, note: "Gift" },
    });
  });

  it("reads an empty note as none", () => {
    expect(validateMovement({ kind: "withdrawal", amountPence: 1, date: "2026-01-01", note: "" }, TODAY)).toMatchObject({
      ok: true,
      input: { note: null },
    });
  });

  it.each([
    [{ kind: "transfer", amountPence: 5000, date: TODAY }, undefined],
    [{ kind: "contribution", amountPence: 0, date: TODAY }, "amount"],
    [{ kind: "contribution", amountPence: 5000, date: "2026-11-22" }, "date"],
    [{ kind: "contribution", amountPence: 5000, date: "2016-11-20" }, "date"],
    [{ kind: "contribution", amountPence: 5000, date: "nope" }, "date"],
    [{ kind: "contribution", amountPence: 5000, date: TODAY, note: "x".repeat(201) }, "note"],
  ])("refuses %j", (raw, field) => {
    expect(validateMovement(raw, TODAY)).toEqual({ ok: false, error: expect.any(String), ...(field ? { field } : {}) });
  });
});

describe("validateConfirmSplit", () => {
  it("keeps existing-fund lines and new funds (trimmed, £0 target as none)", () => {
    expect(
      validateConfirmSplit([
        { fundId: FUND, amountPence: 20000 },
        { fundId: OTHER, amountPence: 0 },
        { newFund: { name: " Car ", targetPence: 0 }, amountPence: 10000 },
      ]),
    ).toEqual({
      ok: true,
      lines: [
        { fundId: FUND, amountPence: 20000 },
        { fundId: OTHER, amountPence: 0 },
        { newFund: { name: "Car", targetPence: null }, amountPence: 10000 },
      ],
    });
  });

  it.each([
    ["not a list", { fundId: FUND, amountPence: 1 }],
    ["empty", []],
    ["a bad id", [{ fundId: "x", amountPence: 1 }]],
    ["a negative amount", [{ fundId: FUND, amountPence: -1 }]],
    ["a fund twice", [{ fundId: FUND, amountPence: 1 }, { fundId: FUND, amountPence: 1 }]],
    ["a blank new name", [{ newFund: { name: " ", targetPence: null }, amountPence: 1 }]],
    ["two new funds with one name", [
      { newFund: { name: "Car", targetPence: null }, amountPence: 1 },
      { newFund: { name: "car", targetPence: null }, amountPence: 1 },
    ]],
    ["21 lines", Array.from({ length: 21 }, () => ({ newFund: { name: crypto.randomUUID().slice(0, 8), targetPence: null }, amountPence: 1 }))],
  ])("refuses %s", (_label, raw) => {
    expect(validateConfirmSplit(raw)).toEqual({ ok: false, error: expect.any(String) });
  });
});

describe("validateWithdrawal", () => {
  const ok = { amountPence: 500, date: "2026-11-21", note: "", destination: "spending" };

  it("checks the movement and keeps where the money goes", () => {
    expect(validateWithdrawal(ok, "2026-11-21")).toEqual({
      ok: true,
      input: { kind: "withdrawal", amountPence: 500, date: "2026-11-21", note: null },
      destination: "spending",
    });
    expect(validateWithdrawal({ ...ok, destination: "out" }, "2026-11-21")).toMatchObject({ ok: true, destination: "out" });
  });

  it("refuses a missing or unknown destination, and a bad amount on its field", () => {
    expect(validateWithdrawal({ ...ok, destination: "bank" }, "2026-11-21")).toMatchObject({ ok: false });
    expect(validateWithdrawal({ ...ok, destination: undefined }, "2026-11-21")).toMatchObject({ ok: false });
    expect(validateWithdrawal({ ...ok, amountPence: 0 }, "2026-11-21")).toMatchObject({ ok: false, field: "amount" });
  });
});

describe("validateFundMove", () => {
  it("checks the amount, date and note", () => {
    expect(validateFundMove({ amountPence: 500, date: "2026-11-21", note: " Top up " }, "2026-11-21")).toEqual({
      ok: true,
      input: { amountPence: 500, date: "2026-11-21", note: "Top up" },
    });
    expect(validateFundMove({ amountPence: 500, date: "2026-11-22" }, "2026-11-21")).toMatchObject({ ok: false, field: "date" });
    expect(validateFundMove(null, "2026-11-21")).toMatchObject({ ok: false });
  });
});

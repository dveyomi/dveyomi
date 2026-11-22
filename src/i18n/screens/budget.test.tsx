import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/i18n/client";
import type { BudgetSummary, Period } from "@/lib/calc";
import type { CategoryRow } from "@/lib/data/types";

vi.mock("@/app/(app)/budget/actions", () => ({ renameCategoryAction: vi.fn(), deleteCategoryAction: vi.fn(), removeFromBudgetAction: vi.fn() }));
vi.mock("@/app/(app)/budget/fundActions", () => ({ confirmSavingsAction: vi.fn(), saveFundAction: vi.fn(), addFundMovementAction: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));

import { BudgetOverview } from "@/components/BudgetOverview";

const period: Period = { start: "2026-10-25", end: "2026-11-24", nextStart: "2026-11-25" };
const categories: CategoryRow[] = [
  { id: "rent", name: "房租", kind: "need", icon: null, colour: null, user_id: "u1" },
  { id: "fun", name: "外食", kind: "want", icon: null, colour: null, user_id: "u1" },
];
const summary: BudgetSummary = {
  poolPence: 3000000,
  spentPence: 0,
  leftToSpendPence: 3000000,
  needsLeftPence: 2000000,
  unallocatedPence: 0,
  overAllocatedPence: 0,
  daysLeft: 3,
  safeToSpendPerDayPence: 333300,
  categories: [
    { categoryId: "rent", kind: "need", allocatedPence: 2000000, spentPence: 0, leftPence: 2000000, overPence: 0, noBudget: false },
    { categoryId: "fun", kind: "want", allocatedPence: 1000000, spentPence: 0, leftPence: 1000000, overPence: 0, noBudget: false },
  ],
  status: "on_track",
};

describe("the Budget tab in Traditional Chinese with NT$", () => {
  it("labels the figures in Chinese and writes amounts in NT$", () => {
    render(
      <I18nProvider locale="zh-TW" currency="TWD">
        <BudgetOverview period={period} summary={summary} categories={categories} saving={{ funds: [], waiting: [] }} today="2026-11-22" tab="spending" />
      </I18nProvider>,
    );
    expect(screen.getByText("進度正常")).toBeInTheDocument();
    expect(screen.getByText("每日可安心花用")).toBeInTheDocument();
    expect(screen.getByRole("meter", { name: "剩餘可花用" })).toHaveAttribute("aria-valuetext", "剩 NT$30,000");
    expect(screen.getByRole("heading", { name: "必要支出" })).toBeInTheDocument();
    expect(screen.getByText("剩 3 天")).toBeInTheDocument();
    expect(screen.getByText("10月25日 – 11月24日")).toBeInTheDocument();
  });
});

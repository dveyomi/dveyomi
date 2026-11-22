import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/i18n/client";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));

import { Calendar } from "@/components/Calendar";
import { ExpenseForm } from "@/components/ExpenseForm";
import { newExpenseValues } from "@/lib/validation/expense";

const zh = (ui: React.ReactNode) => render(<I18nProvider locale="zh-TW" currency="TWD">{ui}</I18nProvider>);

describe("the Expenses tab in Traditional Chinese with NT$", () => {
  it("Calendar: weekday headers in Chinese and short NT$ totals", () => {
    zh(
      <Calendar
        period={{ start: "2026-11-01", end: "2026-11-30", nextStart: "2026-12-01" }}
        today="2026-11-22"
        dayTotals={new Map([["2026-11-05", 123400]])}
        dayCounts={new Map([["2026-11-05", 2]])}
        onSelect={() => {}}
      />,
    );
    expect(screen.getAllByText("一").length).toBeGreaterThan(0);
    expect(screen.getAllByText("日").length).toBeGreaterThan(0);
    expect(screen.getByText("NT$1.2千")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "11月5日星期四：已花 NT$1,234，2 筆支出" })).toBeInTheDocument();
  });

  it("ExpenseForm: labels and the save button in Chinese", () => {
    const categories = [{ id: "food", name: "日常採買", kind: "need" as const }];
    zh(
      <ExpenseForm
        categories={categories}
        funds={[]}
        today="2026-11-22"
        initial={newExpenseValues({}, categories, "2026-11-22")}
        returnTo="/expenses"
        save={vi.fn()}
      />,
    );
    expect(screen.getByLabelText("金額")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "儲存支出" }).length).toBeGreaterThan(0);
  });
});

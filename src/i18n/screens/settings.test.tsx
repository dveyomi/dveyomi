import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/i18n/client";

vi.mock("@/app/(app)/settings/settingsActions", () => ({
  saveStartDay: vi.fn(),
  saveHomeTimezone: vi.fn(),
  saveLanguage: vi.fn(),
  saveCurrency: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));

import { BudgetSection } from "@/app/(app)/settings/BudgetSection";
import { RegionSection } from "@/app/(app)/settings/RegionSection";
import { ThemeCard } from "@/app/(app)/settings/ThemeSection";

const zh = (ui: React.ReactNode) => render(<I18nProvider locale="zh-TW" currency="GBP">{ui}</I18nProvider>);

describe("Settings in Traditional Chinese", () => {
  it("headings, the language list and the currency warning are in Chinese", () => {
    zh(
      <>
        <BudgetSection startDay={25} nextBudgetStart="2026-11-25" />
        <RegionSection timezone="Asia/Taipei" zones={["Asia/Taipei", "Europe/London"]} language="zh-TW" currency="GBP" />
        <ThemeCard>{null}</ThemeCard>
      </>,
    );
    expect(screen.getByRole("heading", { name: "預算" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "地區" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "主題" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("幣別"), { target: { value: "TWD" } });
    const dialog = screen.getByRole("alertdialog", { name: "要變更幣別嗎？" });
    expect(within(dialog).getByText("金額不會換算。£1,250.00 會變成 NT$1,250。")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "取消" })).toBeInTheDocument();
  });
});

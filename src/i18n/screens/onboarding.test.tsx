import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/i18n/client";

vi.mock("@/app/onboarding/actions", () => ({ completeOnboardingAction: vi.fn() }));
vi.mock("@/app/(app)/settings/settingsActions", () => ({
  saveLanguage: vi.fn(async () => ({ ok: true })),
  saveCurrency: vi.fn(async () => ({ ok: true })),
}));

import { OnboardingWizard } from "@/app/onboarding/Wizard";

describe("onboarding in Traditional Chinese with NT$", () => {
  it("walks the first two steps in Chinese, with amounts in NT$", () => {
    render(
      <I18nProvider locale="zh-TW" currency="TWD">
        <OnboardingWizard today="2026-11-22" />
      </I18nProvider>,
    );
    expect(screen.getByRole("heading", { name: "歡迎" })).toBeInTheDocument();
    expect(screen.getByLabelText("語言 · Language")).toHaveValue("zh-TW");
    expect(screen.getByLabelText("幣別")).toHaveValue("TWD");
    fireEvent.click(screen.getByRole("button", { name: "開始設定" }));
    expect(screen.getByRole("heading", { name: "從基本資料開始" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("月收入"), { target: { value: "40000" } });
    fireEvent.click(screen.getByRole("button", { name: "繼續" }));

    expect(screen.getByRole("heading", { name: "你的支出預算" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "必要支出" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "想要支出" })).toBeInTheDocument();
    const add = screen.getByRole("form", { name: "新增必要支出" });
    fireEvent.change(within(add).getByLabelText("類別名稱"), { target: { value: "房租" } });
    fireEvent.change(within(add).getByLabelText("金額"), { target: { value: "45000" } });
    fireEvent.click(screen.getByRole("button", { name: "新增類別" }));
    expect(screen.getByText("超出 NT$5,000")).toBeInTheDocument();
  });
});

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/i18n/client";

vi.mock("next/navigation", () => ({ usePathname: () => "/budget" }));

import { NavBar } from "@/components/Nav";

describe("the menu in Traditional Chinese", () => {
  it("names the tabs and the add button in Chinese", () => {
    render(
      <I18nProvider locale="zh-TW" currency="TWD">
        <NavBar pathname="/budget" />
      </I18nProvider>,
    );
    expect(screen.getByRole("navigation", { name: "主選單" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "預算" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "支出" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "設定" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "新增支出" })).toBeInTheDocument();
  });
});

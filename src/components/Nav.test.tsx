import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Nav } from "./Nav";

let pathname = "/budget";
vi.mock("next/navigation", () => ({ usePathname: () => pathname }));

const nav = () => screen.getByRole("navigation", { name: "Main" });

describe("Nav", () => {
  beforeEach(() => {
    pathname = "/budget";
  });

  it("renders the tabs Expenses, Budget, Settings in that order", () => {
    render(<Nav />);
    const tabs = within(nav())
      .getAllByRole("link")
      .filter((a) => a.getAttribute("href") !== "/expenses/new");
    expect(tabs.map((a) => a.textContent)).toEqual(["Expenses", "Budget", "Settings"]);
    expect(tabs.map((a) => a.getAttribute("href"))).toEqual(["/expenses", "/budget", "/settings"]);
  });

  it("has a + link to /expenses/new", () => {
    render(<Nav />);
    expect(within(nav()).getByRole("link", { name: "Add expense" })).toHaveAttribute(
      "href",
      "/expenses/new",
    );
  });

  it("marks only the current tab with aria-current", () => {
    pathname = "/settings";
    render(<Nav />);
    const current = within(nav())
      .getAllByRole("link")
      .filter((a) => a.getAttribute("aria-current") === "page");
    expect(current.map((a) => a.textContent)).toEqual(["Settings"]);
  });

  it("marks a tab current on its sub-pages", () => {
    pathname = "/expenses/2026-11";
    render(<Nav />);
    expect(within(nav()).getByRole("link", { name: "Expenses" })).toHaveAttribute("aria-current", "page");
  });

  it("on /expenses/new marks the + link, not the Expenses tab", () => {
    pathname = "/expenses/new";
    render(<Nav />);
    expect(within(nav()).getByRole("link", { name: "Add expense" })).toHaveAttribute("aria-current", "page");
    expect(within(nav()).getByRole("link", { name: "Expenses" })).not.toHaveAttribute("aria-current");
  });
});

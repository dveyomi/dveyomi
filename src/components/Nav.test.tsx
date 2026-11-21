import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Nav, NavBar } from "./Nav";

let pathname = "/budget";
vi.mock("next/navigation", () => ({ usePathname: () => pathname }));

const nav = () => screen.getByRole("navigation", { name: "Main" });

describe("Nav", () => {
  beforeEach(() => {
    pathname = "/budget";
  });

  it("renders Expenses, Budget, Settings, then +, in DOM (and so focus) order", () => {
    render(<Nav />);
    const links = within(nav()).getAllByRole("link");
    expect(links.map((a) => a.textContent)).toEqual(["Expenses", "Budget", "Settings", "Add expense"]);
    expect(links.map((a) => a.getAttribute("href"))).toEqual([
      "/expenses",
      "/budget",
      "/settings",
      "/expenses/new",
    ]);
  });

  it("uses no CSS order utilities, so visual order is DOM order", () => {
    render(<Nav />);
    expect(nav().innerHTML).not.toMatch(/(?:^|[\s"])(?:md:)?-?order-/);
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

  it("NavBar without a pathname (the prerender fallback) renders every link and marks none current", () => {
    render(<NavBar pathname={null} />);
    const links = within(nav()).getAllByRole("link");
    expect(links.map((l) => l.textContent)).toEqual(["Expenses", "Budget", "Settings", "Add expense"]);
    for (const link of links) expect(link).not.toHaveAttribute("aria-current");
  });

  it.each(["/expenses/new", "/expenses/11111111-1111-4111-8111-111111111111"])(
    "on the expense form (%s) hides the phone pill and + (the form has its own close and save), keeping the desktop rail",
    (path) => {
      pathname = path;
      render(<Nav />);
      const el = screen.getByRole("navigation", { name: "Main", hidden: true });
      expect(el).toHaveClass("hidden", "md:flex");
    },
  );

  it.each(["/expenses", "/expenses/trips", "/expenses/2026-11", "/expenses/11111111-1111-4111-8111-111111111111/more", "/budget", "/budget/abc", "/settings"])("shows the phone pill on %s", (path) => {
    pathname = path;
    render(<Nav />);
    expect(nav()).not.toHaveClass("hidden");
    expect(nav()).toHaveClass("flex");
  });
});


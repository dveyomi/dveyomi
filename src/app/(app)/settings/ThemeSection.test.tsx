import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const cookieJar = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (cookieJar.has(name) ? { name, value: cookieJar.get(name)! } : undefined),
  }),
}));

import { SavedThemeChooser, ThemeCard } from "./ThemeSection";

beforeEach(() => cookieJar.clear());
afterEach(() => document.documentElement.removeAttribute("data-theme"));

describe("ThemeCard", () => {
  it("is a Theme section that holds the chooser (or its placeholder)", () => {
    render(
      <ThemeCard>
        <span>chooser</span>
      </ThemeCard>,
    );
    expect(screen.getByRole("heading", { name: "Theme" })).toBeInTheDocument();
    expect(screen.getByText("chooser")).toBeInTheDocument();
  });
});

describe("SavedThemeChooser", () => {
  it("shows Light selected when there is no cookie", async () => {
    render(await SavedThemeChooser());
    expect(screen.getByRole("radio", { name: "Light" })).toHaveAttribute("aria-checked", "true");
  });

  it("starts from the saved choice", async () => {
    cookieJar.set("theme", "dark");
    document.documentElement.dataset.theme = "dark";
    render(await SavedThemeChooser());
    expect(screen.getByRole("radio", { name: "Dark" })).toHaveAttribute("aria-checked", "true");
  });

  it("treats an invalid cookie as Light", async () => {
    cookieJar.set("theme", "neon");
    render(await SavedThemeChooser());
    expect(screen.getByRole("radio", { name: "Light" })).toHaveAttribute("aria-checked", "true");
  });
});

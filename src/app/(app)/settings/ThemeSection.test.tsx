import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const cookieJar = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (cookieJar.has(name) ? { name, value: cookieJar.get(name)! } : undefined),
  }),
}));

import { ThemeSection } from "./ThemeSection";

beforeEach(() => cookieJar.clear());

describe("ThemeSection", () => {
  it("is a Theme card with Light selected when there is no cookie", async () => {
    render(await ThemeSection());
    expect(screen.getByRole("heading", { name: "Theme" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Light" })).toHaveAttribute("aria-checked", "true");
  });

  it("shows the saved choice", async () => {
    cookieJar.set("theme", "dark");
    render(await ThemeSection());
    expect(screen.getByRole("radio", { name: "Dark" })).toHaveAttribute("aria-checked", "true");
  });

  it("treats an invalid cookie as Light", async () => {
    cookieJar.set("theme", "neon");
    render(await ThemeSection());
    expect(screen.getByRole("radio", { name: "Light" })).toHaveAttribute("aria-checked", "true");
  });
});

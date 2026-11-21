import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ThemeChooser } from "./ThemeChooser";

afterEach(() => {
  document.cookie = "theme=; path=/; max-age=0";
  document.documentElement.removeAttribute("data-theme");
});

describe("ThemeChooser", () => {
  it("offers Light, Dark and Match device as a radiogroup showing the current choice", () => {
    render(<ThemeChooser initial="system" />);
    expect(screen.getByRole("radiogroup", { name: "Theme" })).toBeInTheDocument();
    expect(screen.getAllByRole("radio").map((r) => r.textContent)).toEqual(["Light", "Dark", "Match device"]);
    expect(screen.getByRole("radio", { name: "Match device" })).toHaveAttribute("aria-checked", "true");
  });

  it("selecting Dark switches <html> to dark and writes the cookie, without a reload", () => {
    render(<ThemeChooser initial="light" />);
    fireEvent.click(screen.getByRole("radio", { name: "Dark" }));
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    expect(document.cookie).toContain("theme=dark");
    expect(screen.getByRole("radio", { name: "Dark" })).toHaveAttribute("aria-checked", "true");
  });
});

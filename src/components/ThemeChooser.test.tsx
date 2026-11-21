import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ThemeChooser } from "./ThemeChooser";

afterEach(() => {
  document.cookie = "theme=; path=/; max-age=0";
  document.documentElement.removeAttribute("data-theme");
});

describe("ThemeChooser", () => {
  it("offers Light, Dark and Match device as a radiogroup showing the current choice", () => {
    document.documentElement.dataset.theme = "system";
    render(<ThemeChooser initial="system" />);
    expect(screen.getByRole("radiogroup", { name: "Theme" })).toBeInTheDocument();
    expect(screen.getAllByRole("radio").map((r) => r.textContent)).toEqual(["Light", "Dark", "Match device"]);
    expect(screen.getByRole("radio", { name: "Match device" })).toHaveAttribute("aria-checked", "true");
  });

  it("selecting Dark switches <html> to dark and writes the cookie, without a reload", async () => {
    document.documentElement.dataset.theme = "light";
    render(<ThemeChooser initial="light" />);
    fireEvent.click(screen.getByRole("radio", { name: "Dark" }));
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    expect(document.cookie).toContain("theme=dark");
    await waitFor(() => expect(screen.getByRole("radio", { name: "Dark" })).toHaveAttribute("aria-checked", "true"));
  });

  it("shows the theme the page actually has when the server's value is stale (back/forward)", () => {
    document.documentElement.dataset.theme = "dark";
    render(<ThemeChooser initial="light" />);
    expect(screen.getByRole("radio", { name: "Dark" })).toHaveAttribute("aria-checked", "true");
  });

  it("follows a change made elsewhere (another chooser on the page)", async () => {
    document.documentElement.dataset.theme = "light";
    render(<ThemeChooser initial="light" />);
    act(() => {
      document.documentElement.dataset.theme = "system";
    });
    await waitFor(() =>
      expect(screen.getByRole("radio", { name: "Match device" })).toHaveAttribute("aria-checked", "true"),
    );
  });
});

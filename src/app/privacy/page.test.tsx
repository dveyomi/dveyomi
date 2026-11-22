import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import PrivacyPage from "./page";

describe("Privacy page", () => {
  it("covers what is stored, where, who can see it, sharing, tracking, your rights and contact", async () => {
    render(await PrivacyPage());
    for (const name of [
      "What we store",
      "Where it's kept",
      "Who can see it",
      "No selling, no sharing",
      "No tracking or ads",
      "Take it with you, or delete it",
      "Questions",
    ]) {
      expect(screen.getByRole("heading", { name })).toBeInTheDocument();
    }
    expect(screen.getByText(/Supabase/)).toBeInTheDocument();
    expect(screen.getByText(/Contact the person who invited you/)).toBeInTheDocument();
  });

  it("says exactly what is kept: Google sign-in details, imported expenses but not the file, provider backups", async () => {
    render(await PrivacyPage());
    expect(screen.getByText(/your email address, name and profile picture/)).toBeInTheDocument();
    expect(screen.getByText(/we keep the file's name, not the file/)).toBeInTheDocument();
    expect(screen.getByText(/Backups are kept by our database provider/)).toBeInTheDocument();
    expect(screen.getByText(/everything you've entered/)).toBeInTheDocument();
  });

  it("names no personal email address", async () => {
    const { container } = render(await PrivacyPage());
    expect(container.textContent).not.toMatch(/@/);
  });
});

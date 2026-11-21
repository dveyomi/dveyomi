import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import PrivacyPage from "./page";

describe("Privacy page", () => {
  it("covers what is stored, where, who can see it, sharing, tracking, your rights and contact", () => {
    render(<PrivacyPage />);
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

  it("names no personal email address", () => {
    const { container } = render(<PrivacyPage />);
    expect(container.textContent).not.toMatch(/@/);
  });
});

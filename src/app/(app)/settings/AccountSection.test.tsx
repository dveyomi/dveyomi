import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("./actions", () => ({ signOut: vi.fn() }));

import { AccountCard } from "./AccountSection";

describe("AccountCard", () => {
  it("shows the signed-in email under an Account heading", () => {
    render(<AccountCard email="me@example.com" />);
    expect(screen.getByRole("heading", { name: "Account" })).toBeInTheDocument();
    expect(screen.getByText("me@example.com")).toBeInTheDocument();
  });

  it("puts a Sign out button inside a form", () => {
    render(<AccountCard email="me@example.com" />);
    const button = screen.getByRole("button", { name: "Sign out" });
    expect(button).toHaveAttribute("type", "submit");
    expect(button.closest("form")).not.toBeNull();
  });

  it("copes with a missing email", () => {
    render(<AccountCard email={null} />);
    expect(screen.getByRole("button", { name: "Sign out" })).toBeInTheDocument();
  });
});

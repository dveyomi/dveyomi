import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { GoogleSignIn } from "./GoogleSignIn";

let query = "";
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(query) }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ auth: { signInWithOAuth: vi.fn() } }) }));

describe("GoogleSignIn", () => {
  it("explains a failed sign-in", () => {
    query = "error=signin";
    render(<GoogleSignIn />);
    expect(screen.getByRole("alert")).toHaveTextContent("Sign-in didn't finish. Please try again.");
  });

  it("explains being signed out because the account could not load", () => {
    query = "error=account";
    render(<GoogleSignIn />);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "We couldn't load your account, so you've been signed out. Please sign in again.",
    );
  });

  it("shows no alert without an error", () => {
    query = "";
    render(<GoogleSignIn />);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByRole("button", { name: "Continue with Google" })).toBeEnabled();
  });
});

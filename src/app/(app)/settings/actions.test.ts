import { beforeEach, describe, expect, it, vi } from "vitest";

const { signOut, redirect } = vi.hoisted(() => ({
  signOut: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { signOut } }) }));
vi.mock("next/navigation", () => ({ redirect }));

import { signOut as signOutAction } from "./actions";

describe("signOut action", () => {
  beforeEach(() => {
    signOut.mockReset().mockResolvedValue({ error: null });
    redirect.mockClear();
  });

  it("signs out locally on the server, then redirects to /login", async () => {
    await expect(signOutAction()).rejects.toThrow("NEXT_REDIRECT:/login");
    expect(signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(redirect).toHaveBeenCalledWith("/login");
    expect(signOut.mock.invocationCallOrder[0]).toBeLessThan(redirect.mock.invocationCallOrder[0]);
  });
});

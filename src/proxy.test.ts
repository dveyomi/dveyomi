// @vitest-environment node
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getClaims } = vi.hoisted(() => ({ getClaims: vi.fn() }));
vi.mock("@supabase/ssr", () => ({ createServerClient: () => ({ auth: { getClaims } }) }));

import { proxy } from "./proxy";

const call = (path: string) => proxy(new NextRequest(`http://localhost:3000${path}`));

beforeEach(() => getClaims.mockReset().mockResolvedValue({ data: null }));

describe("proxy, signed out", () => {
  it("sends pages to /login with the way back", async () => {
    const res = await call("/settings");
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost:3000/login?next=%2Fsettings");
  });

  it.each(["/api/export", "/api/account/delete", "/api/cron/recurring"])("lets %s through so the route answers 401 itself", async (path) => {
    const res = await call(path);
    expect(res.headers.get("location")).toBeNull();
    expect(res.headers.get("x-middleware-next")).toBe("1");
  });
});

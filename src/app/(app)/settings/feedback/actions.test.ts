import { beforeEach, describe, expect, it, vi } from "vitest";

const { getUserId, redirect, revalidatePath, sendFeedback } = vi.hoisted(() => ({
  getUserId: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
  revalidatePath: vi.fn(),
  sendFeedback: vi.fn(),
}));
const db = { tag: "db" };
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => db, getUserId }));
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/lib/data/feedback", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/data/feedback")>()),
  sendFeedback,
}));

import { FeedbackLimitError } from "@/lib/data/feedback";
import { APP_VERSION } from "@/lib/appVersion";
import { sendFeedbackAction } from "./actions";

const device = { from: "/budget", viewport: "desktop", browser: "Mozilla/5.0", theme: "light", timeZone: "Europe/London" };
const bug = { kind: "bug", message: " Export button does nothing. ", includeDevice: true, device };

beforeEach(() => {
  getUserId.mockReset().mockResolvedValue("user-1");
  sendFeedback.mockReset().mockResolvedValue({ id: "f1", createdAt: "2026-11-22T10:00:00+00:00" });
  revalidatePath.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("sendFeedbackAction", () => {
  it("sends a signed-out caller to /login", async () => {
    getUserId.mockResolvedValue(null);
    await expect(sendFeedbackAction(bug)).rejects.toThrow("NEXT_REDIRECT:/login");
    expect(sendFeedback).not.toHaveBeenCalled();
  });

  it("sends the trimmed message with the checked device details and the app version from the server", async () => {
    expect(await sendFeedbackAction({ ...bug, device: { ...device, appVersion: "9.9.9-fake", userId: "someone-else" } })).toEqual({
      ok: true,
    });
    expect(sendFeedback).toHaveBeenCalledWith(db, {
      kind: "bug",
      message: "Export button does nothing.",
      context: { ...device, appVersion: APP_VERSION, language: "en-GB", currency: "GBP" },
    });
    expect(revalidatePath).toHaveBeenCalledWith("/settings/feedback");
  });

  it("drops a from path that leaves the app", async () => {
    await sendFeedbackAction({ ...bug, device: { ...device, from: "https://evil.test/x" } });
    expect(sendFeedback.mock.calls[0][1].context.from).toBeNull();
  });

  it("sends no context for an idea, or when device details are off", async () => {
    await sendFeedbackAction({ ...bug, kind: "idea" });
    await sendFeedbackAction({ ...bug, includeDevice: false });
    expect(sendFeedback.mock.calls.map((c) => c[1].context)).toEqual([null, null]);
  });

  it("refuses a short message with the field's error, sending nothing", async () => {
    expect(await sendFeedbackAction({ ...bug, message: "hi" })).toEqual({
      field: "message",
      error: "Tell us a little more: at least 10 characters.",
    });
    expect(sendFeedback).not.toHaveBeenCalled();
  });

  it("passes on the daily limit's message", async () => {
    sendFeedback.mockRejectedValue(new FeedbackLimitError());
    expect(await sendFeedbackAction(bug)).toEqual({
      error: "You've sent 20 messages today, the most we take in a day. Please try again tomorrow.",
    });
  });

  it("reports a failed send", async () => {
    sendFeedback.mockRejectedValue(new Error("down"));
    expect(await sendFeedbackAction(bug)).toEqual({ error: "We couldn't send that. Check your connection and try again." });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

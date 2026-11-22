import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { admin, createSignedInUser, deleteUser, queryAsPostgres, type TestUser } from "@/db/testClients";
import { deleteAccount, exportUserData } from "./account";
import { FeedbackLimitError, listFeedback, sendFeedback } from "./feedback";
import type { Db } from "./types";

let a: TestUser;
let b: TestUser;
let limited: TestUser;

const db = (u: TestUser) => u.client as unknown as Db;
const MESSAGE = "The calendar skips a day in March.";

beforeAll(async () => {
  a = await createSignedInUser("feedback-a");
  b = await createSignedInUser("feedback-b");
  limited = await createSignedInUser("feedback-limit");
});

afterAll(async () => {
  await deleteUser(a);
  await deleteUser(b);
  await deleteUser(limited);
});

describe("sendFeedback", () => {
  it("stores the user's own row as new, with its context", async () => {
    const context = { from: "/budget", viewport: "phone", theme: "dark", timeZone: "Europe/London", appVersion: "0.1.0" };
    const sent = await sendFeedback(db(a), { kind: "bug", message: MESSAGE, context });
    const { data, error } = await admin.from("feedback").select("*").eq("id", sent.id).single();
    expect(error).toBeNull();
    expect(data).toMatchObject({
      user_id: a.id,
      kind: "bug",
      message: MESSAGE,
      context,
      status: "new",
      triaged_at: null,
      issue_url: null,
    });
  });

  it("stores an idea without context", async () => {
    const sent = await sendFeedback(db(a), { kind: "idea", message: "Let me pin a category to the top.", context: null });
    const { data } = await admin.from("feedback").select("kind, context").eq("id", sent.id).single();
    expect(data).toEqual({ kind: "idea", context: null });
  });

  it("refuses a message under 10 or over 2,000 characters, and an unknown kind", async () => {
    await expect(sendFeedback(db(a), { kind: "bug", message: "Too short", context: null })).rejects.toMatchObject({ code: "23514" });
    await expect(sendFeedback(db(a), { kind: "bug", message: "x".repeat(2001), context: null })).rejects.toMatchObject({
      code: "23514",
    });
    await expect(
      sendFeedback(db(a), { kind: "praise" as "bug", message: MESSAGE, context: null }),
    ).rejects.toMatchObject({ code: "23514" });
    // The bounds themselves are fine.
    await expect(sendFeedback(db(a), { kind: "idea", message: "x".repeat(10), context: null })).resolves.toBeDefined();
    await expect(sendFeedback(db(a), { kind: "idea", message: "x".repeat(2000), context: null })).resolves.toBeDefined();
  });

  it("refuses a context over 4 KB or that isn't an object", async () => {
    await expect(sendFeedback(db(a), { kind: "bug", message: MESSAGE, context: { note: "x".repeat(4100) } })).rejects.toMatchObject({
      code: "23514",
    });
    const { error } = await a.client.rpc("send_feedback", { p_kind: "bug", p_message: MESSAGE, p_context: ["a"] });
    expect(error?.code).toBe("23514");
  });
});

describe("feedback row-level security", () => {
  let bRow: string;
  let aRow: string;

  beforeAll(async () => {
    bRow = (await sendFeedback(db(b), { kind: "idea", message: "B's idea about budgets.", context: null })).id;
    aRow = (await sendFeedback(db(a), { kind: "bug", message: "A's own bug report here.", context: null })).id;
  });

  it("A reads only their own feedback", async () => {
    const { data, error } = await a.client.from("feedback").select("id, user_id");
    expect(error).toBeNull();
    expect(data!.length).toBeGreaterThan(0);
    expect(data!.every((r) => r.user_id === a.id)).toBe(true);
    const other = await a.client.from("feedback").select("id").eq("id", bRow);
    expect(other.data).toEqual([]);
  });

  it("A can't insert a row for B", async () => {
    const { error } = await a.client.from("feedback").insert({ user_id: b.id, kind: "bug", message: MESSAGE });
    expect(error?.code).toBe("42501");
  });

  it("an insert must be new, untriaged and without an issue link", async () => {
    for (const extra of [
      { status: "done" },
      { status: "triaged" },
      { triaged_at: "2026-11-22T10:00:00Z" },
      { issue_url: "https://github.com/dveyomi/dveyomi/issues/1" },
    ]) {
      const { error } = await a.client.from("feedback").insert({ kind: "bug", message: MESSAGE, ...extra });
      expect(error?.code, JSON.stringify(extra)).toBe("42501");
    }
  });

  it("A can't update or delete their feedback (no privilege)", async () => {
    const update = await a.client.from("feedback").update({ status: "done" }).eq("id", aRow);
    expect(update.error?.code).toBe("42501");
    const del = await a.client.from("feedback").delete().eq("id", aRow);
    expect(del.error?.code).toBe("42501");
    const { data } = await admin.from("feedback").select("status").eq("id", aRow).single();
    expect(data).toEqual({ status: "new" });
  });

  it("the service role triages: status, triaged_at and a GitHub issue link", async () => {
    const { error } = await admin
      .from("feedback")
      .update({ status: "triaged", triaged_at: new Date().toISOString(), issue_url: "https://github.com/dveyomi/dveyomi/issues/7" })
      .eq("id", aRow);
    expect(error).toBeNull();
  });

  it("issue_url must be a GitHub https link of at most 300 characters", async () => {
    for (const url of ["http://github.com/x/y/issues/1", "https://evil.test/issues/1", `https://github.com/${"x".repeat(290)}`]) {
      const { error } = await admin.from("feedback").update({ issue_url: url }).eq("id", aRow);
      expect(error?.code, url).toBe("23514");
    }
  });

  it("anon has no access", async () => {
    const rows = queryAsPostgres<{ privilege_type: string }>(
      `select privilege_type from information_schema.role_table_grants
        where table_schema = 'public' and table_name = 'feedback' and grantee = 'anon'`,
    );
    expect(rows).toEqual([]);
  });
});

describe("listFeedback", () => {
  it("lists the user's feedback newest first with the first line and status", async () => {
    const u = await createSignedInUser("feedback-list");
    try {
      const seeded = await admin.from("feedback").insert([
        { user_id: u.id, kind: "bug", message: "Old bug report\nwith more detail", created_at: "2026-11-01T09:00:00Z", status: "new" },
        { user_id: u.id, kind: "idea", message: "Newer idea to try", created_at: "2026-11-20T09:00:00Z", status: "done" },
      ]);
      expect(seeded.error).toBeNull();
      const items = await listFeedback(db(u));
      expect(items).toEqual([
        { id: expect.any(String), kind: "idea", firstLine: "Newer idea to try", status: "done", createdAt: "2026-11-20T09:00:00+00:00" },
        { id: expect.any(String), kind: "bug", firstLine: "Old bug report", status: "new", createdAt: "2026-11-01T09:00:00+00:00" },
      ]);
    } finally {
      await deleteUser(u);
    }
  });
});

describe("rate limit", () => {
  it("refuses the 21st message in a day with a clear error, not counting older ones", async () => {
    const day = Date.now();
    await admin.from("feedback").insert(
      Array.from({ length: 3 }, (_, i) => ({
        user_id: limited.id,
        kind: "idea",
        message: `An old idea number ${i}`,
        created_at: new Date(day - 25 * 3600_000).toISOString(),
      })),
    );
    for (let i = 0; i < 20; i++) {
      await sendFeedback(db(limited), { kind: "idea", message: `Idea number ${i} for today`, context: null });
    }
    const refused = sendFeedback(db(limited), { kind: "idea", message: "One idea too many today", context: null });
    await expect(refused).rejects.toBeInstanceOf(FeedbackLimitError);
    await expect(refused).rejects.toThrow("You've sent 20 messages today, the most we take in a day. Please try again tomorrow.");
    // A direct insert is held to the same limit.
    const direct = await limited.client.from("feedback").insert({ kind: "idea", message: "Straight into the table" });
    expect(direct.error?.code).toBe("PT429");
    // Other users aren't affected.
    await expect(sendFeedback(db(b), { kind: "idea", message: "B is still fine to send", context: null })).resolves.toBeDefined();
  });
});

describe("export and account deletion", () => {
  it("export includes the user's feedback", async () => {
    const exported = await exportUserData(db(a));
    expect(exported.feedback.length).toBeGreaterThan(0);
    expect(exported.feedback.every((r) => r.user_id === a.id)).toBe(true);
    expect(exported.feedback.map((r) => r.message)).toContain(MESSAGE);
  });

  it("deleting the account removes the user's feedback (cascade)", async () => {
    const u = await createSignedInUser("feedback-delete");
    await sendFeedback(db(u), { kind: "bug", message: "Delete me with the account", context: null });
    await deleteAccount(admin as unknown as Db, u.id);
    const { count } = await admin.from("feedback").select("id", { count: "exact", head: true }).eq("user_id", u.id);
    expect(count).toBe(0);
  });
});

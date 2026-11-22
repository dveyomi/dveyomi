/** Help & feedback input checks, shared by the form and the server action. Client-safe. */
import { safeNext } from "@/lib/safeNext";
import { isTimeZone } from "@/lib/timezone";

export const FEEDBACK_KINDS = ["bug", "idea"] as const;
export type FeedbackKindInput = (typeof FEEDBACK_KINDS)[number];

/** Message length after trimming (the feedback table's check). */
export const MESSAGE_MIN = 10;
export const MESSAGE_MAX = 2000;
const FROM_MAX = 200;
const BROWSER_MAX = 300;

/**
 * The device details a bug report may include, each checked on its own (null
 * when missing or unusable). Nothing financial: the page's path only (no
 * query, which can hold a search), the viewport class, the browser's user
 * agent, the theme and the time zone. The server adds the app version.
 */
export type DeviceDetails = {
  from: string | null;
  viewport: "phone" | "desktop" | null;
  browser: string | null;
  theme: "light" | "dark" | null;
  timeZone: string | null;
};

export type CheckedFeedback = { kind: FeedbackKindInput; message: string; device: DeviceDetails | null };
export type FeedbackCheck = { ok: true; value: CheckedFeedback } | { ok: false; field: "kind" | "message"; error: string };

/** The in-app page a report came from: a same-origin path without its query or hash, else null. */
export function checkFromPath(raw: unknown): string | null {
  if (typeof raw !== "string" || raw.length > FROM_MAX) return null;
  const safe = safeNext(raw, "");
  if (!safe) return null;
  return new URL(safe, "http://in-app.invalid").pathname;
}

const oneOf = <T extends string>(raw: unknown, values: readonly T[]): T | null =>
  values.find((v) => v === raw) ?? null;

function checkDevice(raw: unknown): DeviceDetails {
  const d = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
  const browser = typeof d.browser === "string" ? d.browser.trim().slice(0, BROWSER_MAX) : "";
  return {
    from: checkFromPath(d.from),
    viewport: oneOf(d.viewport, ["phone", "desktop"] as const),
    browser: browser || null,
    theme: oneOf(d.theme, ["light", "dark"] as const),
    timeZone: typeof d.timeZone === "string" && isTimeZone(d.timeZone) ? d.timeZone : null,
  };
}

/** The message's own check, for the form to show as you type and the server to enforce. */
export function checkMessage(raw: unknown): string | null {
  const length = typeof raw === "string" ? raw.trim().length : 0;
  if (length < MESSAGE_MIN) return `Tell us a little more: at least ${MESSAGE_MIN} characters.`;
  if (length > MESSAGE_MAX) return "That's over 2,000 characters. Please shorten it.";
  return null;
}

/**
 * Checks a feedback form's raw input: `{ kind, message, includeDevice, device }`.
 * The message is trimmed; device details are kept only for a bug with
 * includeDevice true, and then only the known fields, each checked.
 */
export function checkFeedback(raw: unknown): FeedbackCheck {
  const input = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
  const kind = oneOf(input.kind, FEEDBACK_KINDS);
  if (!kind) return { ok: false, field: "kind", error: "Choose Bug or Idea." };
  const messageError = checkMessage(input.message);
  if (messageError) return { ok: false, field: "message", error: messageError };
  const device = kind === "bug" && input.includeDevice === true ? checkDevice(input.device) : null;
  return { ok: true, value: { kind, message: (input.message as string).trim(), device } };
}

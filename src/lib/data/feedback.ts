import type { Json } from "@/db/database.types";
import type { Db } from "./types";

export type FeedbackKind = "bug" | "idea";
export type FeedbackStatus = "new" | "triaged" | "done";

/** What a user sends: already checked by validation/feedback (trimmed, bounded, context shaped). */
export type FeedbackInput = { kind: FeedbackKind; message: string; context: Record<string, Json> | null };

/** One line of "What you've sent". `createdAt` is the stored timestamp; the screen shows its date in the user's zone. */
export type FeedbackItem = { id: string; kind: FeedbackKind; firstLine: string; status: FeedbackStatus; createdAt: string };

/** How many messages a user may send in any 24 hours (enforced in the database). */
export const FEEDBACK_DAILY_LIMIT = 20;

/** The daily limit was reached (PT429 from the database). */
export class FeedbackLimitError extends Error {
  constructor() {
    super(`You've sent ${FEEDBACK_DAILY_LIMIT} messages today, the most we take in a day. Please try again tomorrow.`);
    this.name = "FeedbackLimitError";
  }
}

/**
 * Sends one message as the signed-in user (`send_feedback`): stored as new,
 * untriaged, theirs. Throws FeedbackLimitError over the daily limit, or the
 * database error (23514 for out-of-bounds input).
 */
export async function sendFeedback(supabase: Db, input: FeedbackInput): Promise<{ id: string; createdAt: string }> {
  const { data, error } = await supabase.rpc("send_feedback", {
    p_kind: input.kind,
    p_message: input.message,
    ...(input.context ? { p_context: input.context } : {}),
  });
  if (error?.code === "PT429") throw new FeedbackLimitError();
  if (error) throw error;
  return { id: data.id, createdAt: data.created_at };
}

/** The user's latest messages, newest first (RLS limits them to their own). */
export async function listFeedback(supabase: Db, limit = 10): Promise<FeedbackItem[]> {
  const { data, error } = await supabase
    .from("feedback")
    .select("id, kind, message, status, created_at")
    .order("created_at", { ascending: false })
    .order("id")
    .limit(limit);
  if (error) throw error;
  return data.map((r) => ({
    id: r.id,
    kind: r.kind as FeedbackKind,
    firstLine: r.message.split("\n", 1)[0].trim(),
    status: r.status as FeedbackStatus,
    createdAt: r.created_at,
  }));
}

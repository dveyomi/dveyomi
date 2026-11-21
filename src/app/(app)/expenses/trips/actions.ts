"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { MissingReferenceError, TransactionNotFoundError } from "@/lib/data/transactions";
import {
  createTrip,
  deleteTrip,
  resetTripOverride,
  setTripOverride,
  TripNotFoundError,
  TripOverlapError,
  updateTrip,
} from "@/lib/data/trips";
import { createClient, getUserId } from "@/lib/supabase/server";
import { isId } from "@/lib/validation/budgetEdit";
import { validateTrip, type TripField } from "@/lib/validation/trip";

/**
 * The trip screens' actions. Every input is untrusted: it is checked here, and
 * RLS and the composite foreign keys keep each change to the signed-in
 * user's own trips and expenses. A trip only labels expenses; none of these
 * changes a budget figure.
 */

export type TripActionResult = { error: string; field?: TripField } | void;
export type TripChangeResult = { error?: string };

async function signedIn() {
  if (!(await getUserId())) redirect("/login");
}

const known = (e: unknown) =>
  e instanceof TripNotFoundError || e instanceof TransactionNotFoundError || e instanceof MissingReferenceError ? e.message : null;

/** Creates a trip from the form, then opens it. An overlap is shown on the start date. */
export async function createTripAction(raw: unknown): Promise<TripActionResult> {
  await signedIn();
  const checked = validateTrip(raw);
  if (!checked.ok) return { error: checked.error, ...(checked.field ? { field: checked.field } : {}) };
  let id: string;
  try {
    id = await createTrip(await createClient(), checked.input);
  } catch (e) {
    if (e instanceof TripOverlapError) return { error: e.message, field: "startDate" };
    console.error("trips: create failed", e);
    return { error: "We couldn't create this trip. Check your connection and try again." };
  }
  revalidatePath("/", "layout");
  redirect(`/expenses/trips/${id}`);
}

/** Saves the edit sheet. The page refreshes in place. */
export async function updateTripAction(id: unknown, raw: unknown): Promise<TripActionResult> {
  await signedIn();
  if (!isId(id)) return { error: "This trip wasn't recognised." };
  const checked = validateTrip(raw);
  if (!checked.ok) return { error: checked.error, ...(checked.field ? { field: checked.field } : {}) };
  try {
    await updateTrip(await createClient(), id, checked.input);
  } catch (e) {
    if (e instanceof TripOverlapError) return { error: e.message, field: "startDate" };
    const message = known(e);
    if (message) return { error: message };
    console.error("trips: update failed", e);
    return { error: "We couldn't save this trip. Check your connection and try again." };
  }
  revalidatePath("/", "layout");
}

/** Deletes a trip (its expenses stay), then goes back to the trips list. */
export async function deleteTripAction(id: unknown): Promise<TripChangeResult> {
  await signedIn();
  if (!isId(id)) return { error: "This trip wasn't recognised." };
  try {
    await deleteTrip(await createClient(), id);
  } catch (e) {
    const message = known(e);
    if (message) return { error: message };
    console.error("trips: delete failed", e);
    return { error: "We couldn't delete this trip. Check your connection and try again." };
  }
  revalidatePath("/", "layout");
  redirect("/expenses/trips");
}

async function change(what: string, run: () => Promise<void>): Promise<TripChangeResult> {
  try {
    await run();
  } catch (e) {
    const message = known(e);
    if (message) return { error: message };
    console.error(`trips: ${what} failed`, e);
    return { error: "We couldn't change this expense's trip. Check your connection and try again." };
  }
  revalidatePath("/", "layout");
  return {};
}

/** "Take out of this trip": the expense is in no trip, whatever its date. */
export async function removeFromTripAction(txnId: unknown): Promise<TripChangeResult> {
  await signedIn();
  if (!isId(txnId)) return { error: "This expense wasn't recognised." };
  return change("remove", async () => setTripOverride(await createClient(), txnId, null));
}

/** "Reset to automatic" / "Add back": the expense's date decides its trip again. */
export async function resetToAutomaticAction(txnId: unknown): Promise<TripChangeResult> {
  await signedIn();
  if (!isId(txnId)) return { error: "This expense wasn't recognised." };
  return change("reset", async () => resetTripOverride(await createClient(), txnId));
}

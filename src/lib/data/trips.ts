import { formatTripRange, type IsoDate } from "@/lib/calc";
import { isId, type Kind } from "@/lib/validation/budgetEdit";
import type { TripInput } from "@/lib/validation/trip";
import type { ExpenseTxn } from "./expenses";
import { MissingReferenceError, TransactionNotFoundError } from "./transactions";
import type { Db } from "./types";

/**
 * Trips (§5.12): a label on expenses, never a budget. Expenses keep counting
 * in their budget (or fund) exactly as before. An expense belongs to trip T
 * when its trip_override is false and its date is within T's dates
 * (automatic), or its trip_override is true and trip_id = T (added by hand).
 * trip_override with no trip_id means "not in any trip". Trips never overlap
 * (0009_trips.sql), so an expense's date falls in at most one.
 */

export type Trip = { id: string; name: string; place: string | null; startDate: IsoDate; endDate: IsoDate };

/** An expense on the trip screen: as the Expenses tab lists it, plus whether it was added or removed by hand. */
export type TripTxn = ExpenseTxn & { tripOverride: boolean };

/** The expense form's Trip row: automatic (by date), not in a trip, or a trip's id. */
export type TripChoice = "auto" | "none" | string;

/** The dates overlap another of the user's trips. */
export class TripOverlapError extends Error {
  constructor(other: Pick<Trip, "name" | "startDate" | "endDate"> | null) {
    super(
      other
        ? `These dates overlap your trip “${other.name}” (${formatTripRange(other.startDate, other.endDate)}). Trips can't overlap.`
        : "These dates overlap another trip. Trips can't overlap.",
    );
    this.name = "TripOverlapError";
  }
}

/** The trip isn't one of the user's (or has been deleted). */
export class TripNotFoundError extends Error {
  constructor() {
    super("This trip no longer exists. It may have been deleted in another tab.");
    this.name = "TripNotFoundError";
  }
}

/** "End trip" on a trip whose dates don't include today. */
export class TripNotCurrentError extends Error {
  constructor() {
    super("This trip isn't on today, so it can't end today.");
    this.name = "TripNotCurrentError";
  }
}

const TRIP_COLUMNS = "id, name, place, start_date, end_date";
type TripRow = { id: string; name: string; place: string | null; start_date: string; end_date: string };
const toTrip = (r: TripRow): Trip => ({ id: r.id, name: r.name, place: r.place, startDate: r.start_date, endDate: r.end_date });
const columns = (input: TripInput) => ({
  name: input.name,
  place: input.place,
  start_date: input.startDate,
  end_date: input.endDate,
});

/** The user's trip that overlaps `input`'s dates (other than `exceptId`), to name it in TripOverlapError. */
async function overlapError(supabase: Db, input: TripInput, exceptId: string | null): Promise<TripOverlapError> {
  let query = supabase.from("trips").select(TRIP_COLUMNS).lte("start_date", input.endDate).gte("end_date", input.startDate);
  if (exceptId) query = query.neq("id", exceptId);
  const { data } = await query.limit(1);
  return new TripOverlapError(data?.[0] ? toTrip(data[0]) : null);
}

/** The user's trips, latest first. */
export async function listTrips(supabase: Db): Promise<Trip[]> {
  const { data, error } = await supabase.from("trips").select(TRIP_COLUMNS).order("start_date", { ascending: false });
  if (error) throw error;
  return data.map(toTrip);
}

/** One of the user's trips, or null for an unknown id or another user's. */
export async function loadTrip(supabase: Db, id: string): Promise<Trip | null> {
  if (!isId(id)) return null;
  const { data, error } = await supabase.from("trips").select(TRIP_COLUMNS).eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? toTrip(data) : null;
}

/** The trip whose dates include `date`, or null. */
export async function tripCovering(supabase: Db, date: IsoDate): Promise<Trip | null> {
  const { data, error } = await supabase
    .from("trips")
    .select(TRIP_COLUMNS)
    .lte("start_date", date)
    .gte("end_date", date)
    .maybeSingle();
  if (error) throw error;
  return data ? toTrip(data) : null;
}

/** Creates a trip and returns its id. Throws TripOverlapError when its dates overlap another trip. */
export async function createTrip(supabase: Db, input: TripInput): Promise<string> {
  const { data, error } = await supabase.from("trips").insert(columns(input)).select("id").single();
  if (error?.code === "23P01") throw await overlapError(supabase, input, null);
  if (error) throw error;
  return data.id;
}

/** Replaces a trip's name, place and dates. Which expenses join follows the new dates. */
export async function updateTrip(supabase: Db, id: string, input: TripInput): Promise<void> {
  if (!isId(id)) throw new TripNotFoundError();
  const { data, error } = await supabase.from("trips").update(columns(input)).eq("id", id).select("id");
  if (error?.code === "23P01") throw await overlapError(supabase, input, id);
  if (error) throw error;
  if (data.length === 0) throw new TripNotFoundError();
}

/**
 * "Back home? End your trip?": the trip covering `today` now ends today.
 * Throws TripNotCurrentError when its dates don't include today (nothing
 * changes) and TripNotFoundError for an unknown trip or another user's.
 */
export async function endTrip(supabase: Db, id: string, today: IsoDate): Promise<void> {
  if (!isId(id)) throw new TripNotFoundError();
  const { data, error } = await supabase
    .from("trips")
    .update({ end_date: today })
    .eq("id", id)
    .lte("start_date", today)
    .gte("end_date", today)
    .select("id");
  if (error) throw error;
  if (data.length === 0) throw (await loadTrip(supabase, id)) ? new TripNotCurrentError() : new TripNotFoundError();
}

/** The start of the user's next trip after `date`, or null: "Start a trip" ends its suggestion before it. */
export async function nextTripStart(supabase: Db, date: IsoDate): Promise<IsoDate | null> {
  const { data, error } = await supabase
    .from("trips")
    .select("start_date")
    .gt("start_date", date)
    .order("start_date")
    .limit(1);
  if (error) throw error;
  return data[0]?.start_date ?? null;
}

/** Deletes a trip. Expenses stay; those added to it by hand become automatic again (a trigger, in the same statement). */
export async function deleteTrip(supabase: Db, id: string): Promise<void> {
  if (!isId(id)) throw new TripNotFoundError();
  const { data, error } = await supabase.from("trips").delete().eq("id", id).select("id");
  if (error) throw error;
  if (data.length === 0) throw new TripNotFoundError();
}

const TXN_COLUMNS = "id, name, amount_pence, date, category_id, fund_id, unchecked, trip_override, categories(name, kind), funds(name)";

async function selectTxns(supabase: Db, filter: string): Promise<TripTxn[]> {
  const { data, error } = await supabase
    .from("transactions")
    .select(TXN_COLUMNS)
    .or(filter)
    .order("date", { ascending: false })
    .order("id", { ascending: false });
  if (error) throw error;
  return data.map((t) => ({
    id: t.id,
    name: t.name,
    amountPence: t.amount_pence,
    date: t.date,
    categoryId: t.category_id,
    categoryName: t.categories?.name ?? "",
    categoryKind: (t.categories?.kind ?? "want") as Kind,
    fundId: t.fund_id,
    fundName: t.funds?.name ?? null,
    unchecked: t.unchecked,
    tripOverride: t.trip_override,
  }));
}

async function requireTrip(supabase: Db, tripId: string): Promise<Trip> {
  const trip = await loadTrip(supabase, tripId);
  if (!trip) throw new TripNotFoundError();
  return trip;
}

/**
 * The trip's expenses, newest first: those dated inside it unless taken out
 * by hand, plus any added by hand. Fund-paid expenses are included.
 */
export async function tripTransactions(supabase: Db, tripId: string): Promise<TripTxn[]> {
  const trip = await requireTrip(supabase, tripId);
  return selectTxns(
    supabase,
    `and(trip_override.is.false,date.gte.${trip.startDate},date.lte.${trip.endDate}),and(trip_override.is.true,trip_id.eq.${trip.id})`,
  );
}

/** Expenses dated inside the trip that were taken out of it by hand (or added to another trip), newest first. */
export async function removedFromTrip(supabase: Db, tripId: string): Promise<TripTxn[]> {
  const trip = await requireTrip(supabase, tripId);
  return selectTxns(
    supabase,
    `and(trip_override.is.true,date.gte.${trip.startDate},date.lte.${trip.endDate},or(trip_id.is.null,trip_id.neq.${trip.id}))`,
  );
}

async function setOverride(supabase: Db, txnId: string, patch: { trip_override: boolean; trip_id: string | null }) {
  if (!isId(txnId)) throw new TransactionNotFoundError();
  const { data, error } = await supabase.from("transactions").update(patch).eq("id", txnId).select("id");
  if (error?.code === "23503") throw new MissingReferenceError();
  if (error) throw error;
  if (data.length === 0) throw new TransactionNotFoundError();
}

/**
 * Overrides the dates for one expense: adds it to trip `tripId`, or (null)
 * takes it out of every trip. Throws TransactionNotFoundError for an expense
 * that isn't the user's and MissingReferenceError for a trip that isn't.
 */
export function setTripOverride(supabase: Db, txnId: string, tripId: string | null): Promise<void> {
  return setOverride(supabase, txnId, { trip_override: true, trip_id: tripId });
}

/** "Reset to automatic": the expense's date decides its trip again. */
export function resetTripOverride(supabase: Db, txnId: string): Promise<void> {
  return setOverride(supabase, txnId, { trip_override: false, trip_id: null });
}

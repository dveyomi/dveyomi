import type { IsoDate } from "@/lib/calc";
import { daysBetween } from "@/lib/calc";
import { isRecord, MAX_NAME_LENGTH } from "./common";
import { isIsoDate } from "./expense";

/** A trip's fields and their checks, shared by the trip form and the server. Client-safe. */

export const MAX_PLACE_LENGTH = 100;
/** A trip can be up to a year long (366 days with a leap day). */
export const MAX_TRIP_DAYS = 366;

/** A checked trip. The place is typed text (null when left empty), never coordinates. */
export type TripInput = { name: string; place: string | null; startDate: IsoDate; endDate: IsoDate };
export type TripField = "name" | "place" | "startDate" | "endDate";
export type TripValidation = { ok: true; input: TripInput } | { ok: false; error: string; field?: TripField };

/** Checks untrusted trip input: a name (trimmed, 1–50), an optional place (≤100), real dates, the end on or after the start, at most a year. */
export function validateTrip(raw: unknown): TripValidation {
  const fail = (error: string, field?: TripField): TripValidation => ({ ok: false, error, ...(field ? { field } : {}) });
  if (!isRecord(raw)) return fail("Something was missing from this trip. Check it and try again.");

  const name = typeof raw.name === "string" ? raw.name.trim() : "";
  if (!name) return fail("Give the trip a name, e.g. Taiwan.", "name");
  if (name.length > MAX_NAME_LENGTH) return fail(`Trip names can be up to ${MAX_NAME_LENGTH} characters.`, "name");

  if (raw.place !== undefined && raw.place !== null && typeof raw.place !== "string") return fail("Type the place, e.g. Taipei.", "place");
  const place = typeof raw.place === "string" ? raw.place.trim() : "";
  if (place.length > MAX_PLACE_LENGTH) return fail(`Places can be up to ${MAX_PLACE_LENGTH} characters.`, "place");

  if (!isIsoDate(raw.startDate)) return fail("Enter the date the trip starts.", "startDate");
  if (!isIsoDate(raw.endDate)) return fail("Enter the date the trip ends.", "endDate");
  if (raw.endDate < raw.startDate) return fail("The trip can't end before it starts.", "endDate");
  if (daysBetween(raw.startDate, raw.endDate) + 1 > MAX_TRIP_DAYS) return fail("A trip can be up to a year long.", "endDate");

  return { ok: true, input: { name, place: place || null, startDate: raw.startDate, endDate: raw.endDate } };
}

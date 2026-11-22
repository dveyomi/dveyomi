import { DEFAULT_I18N, type I18n } from "@/i18n/format";
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
export function validateTrip(raw: unknown, i18n: I18n = DEFAULT_I18N): TripValidation {
  const fail = (error: string, field?: TripField): TripValidation => ({ ok: false, error, ...(field ? { field } : {}) });
  if (!isRecord(raw)) return fail(i18n.m.tripChecks.missing);

  const name = typeof raw.name === "string" ? raw.name.trim() : "";
  if (!name) return fail(i18n.m.tripChecks.name, "name");
  if (name.length > MAX_NAME_LENGTH) return fail(i18n.m.tripChecks.nameLength(MAX_NAME_LENGTH), "name");

  if (raw.place !== undefined && raw.place !== null && typeof raw.place !== "string") return fail(i18n.m.tripChecks.place, "place");
  const place = typeof raw.place === "string" ? raw.place.trim() : "";
  if (place.length > MAX_PLACE_LENGTH) return fail(i18n.m.tripChecks.placeLength(MAX_PLACE_LENGTH), "place");

  if (!isIsoDate(raw.startDate)) return fail(i18n.m.tripChecks.start, "startDate");
  if (!isIsoDate(raw.endDate)) return fail(i18n.m.tripChecks.end, "endDate");
  if (raw.endDate < raw.startDate) return fail(i18n.m.tripChecks.endBeforeStart, "endDate");
  if (daysBetween(raw.startDate, raw.endDate) + 1 > MAX_TRIP_DAYS) return fail("A trip can be up to a year long.", "endDate");

  return { ok: true, input: { name, place: place || null, startDate: raw.startDate, endDate: raw.endDate } };
}

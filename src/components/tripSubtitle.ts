import type { Messages } from "@/i18n/messages";
import { formatTripRange } from "@/lib/calc";
import type { Trip } from "@/lib/data/trips";
import type { Locale } from "@/lib/locale";

/**
 * "Taipei · 1–15 Dec 2026", or just the dates without a place. Kept out of
 * the "use client" TripList so server pages can call it too.
 */
export function tripSubtitle(m: Messages, locale: Locale, trip: Trip): string {
  const dates = formatTripRange(trip.startDate, trip.endDate, locale);
  return trip.place ? m.trips.subtitle(trip.place, dates) : dates;
}

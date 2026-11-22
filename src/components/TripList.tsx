"use client";

import { useI18n } from "@/i18n/client";
import type { Messages } from "@/i18n/messages";
import type { Locale } from "@/lib/locale";
import { Badge, ListRow } from "@/components/ui";
import { formatTripRange, tripLength, type IsoDate } from "@/lib/calc";
import type { Trip } from "@/lib/data/trips";

/** "Taipei · 1–15 Dec 2026", or just the dates without a place. */
export function tripSubtitle(m: Messages, locale: Locale, trip: Trip): string {
  const dates = formatTripRange(trip.startDate, trip.endDate, locale);
  return trip.place ? m.trips.subtitle(trip.place, dates) : dates;
}

/** Trips as rows that open the trip; the one covering today is marked "Now". */
export function TripList({ trips, today, label }: { trips: Trip[]; today: IsoDate; label: string }) {
  const { m, locale } = useI18n();
  return (
    <ul aria-label={label} className="flex flex-col divide-y divide-border">
      {trips.map((t) => {
        const now = t.startDate <= today && today <= t.endDate;
        const days = tripLength({ start: t.startDate, end: t.endDate });
        return (
          <li key={t.id}>
            <ListRow
              href={`/expenses/trips/${t.id}`}
              icon="plane"
              title={t.name}
              subtitle={tripSubtitle(m, locale, t)}
              trailing={now ? <Badge tone="positive">{m.trips.now}</Badge> : <span className="text-caption text-muted">{m.trips.days(days)}</span>}
            />
          </li>
        );
      })}
    </ul>
  );
}

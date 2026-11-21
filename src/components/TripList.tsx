import { Badge, ListRow } from "@/components/ui";
import { formatTripRange, tripLength, type IsoDate } from "@/lib/calc";
import type { Trip } from "@/lib/data/trips";

/** "Taipei · 1–15 Dec 2026", or just the dates without a place. */
export function tripSubtitle(trip: Trip): string {
  const dates = formatTripRange(trip.startDate, trip.endDate);
  return trip.place ? `${trip.place} · ${dates}` : dates;
}

/** Trips as rows that open the trip; the one covering today is marked "Now". */
export function TripList({ trips, today, label }: { trips: Trip[]; today: IsoDate; label: string }) {
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
              subtitle={tripSubtitle(t)}
              trailing={now ? <Badge tone="positive">Now</Badge> : <span className="text-caption text-muted">{days === 1 ? "1 day" : `${days} days`}</span>}
            />
          </li>
        );
      })}
    </ul>
  );
}

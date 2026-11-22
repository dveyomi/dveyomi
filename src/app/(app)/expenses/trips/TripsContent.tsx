import { getServerI18n } from "@/i18n/server";
import { redirect } from "next/navigation";
import { TripList } from "@/components/TripList";
import { ButtonLink, Card, EmptyState } from "@/components/ui";
import { listTrips } from "@/lib/data/trips";
import { createClient, getUserId } from "@/lib/supabase/server";
import { getToday } from "@/lib/today";

/** The user's trips in three groups (now, upcoming, past), with how trips work beside them on desktop. */
export async function TripsContent() {
  if (!(await getUserId())) redirect("/login");
  const [supabase, today] = await Promise.all([createClient(), getToday()]);
  const trips = await listTrips(supabase);
  const { m } = await getServerI18n();
  const groups = [
    { label: m.trips.now, trips: trips.filter((t) => t.startDate <= today && today <= t.endDate) },
    // listTrips is latest first; upcoming reads soonest first.
    { label: m.trips.upcoming, trips: trips.filter((t) => t.startDate > today).reverse() },
    { label: m.trips.past, trips: trips.filter((t) => t.endDate < today) },
  ].filter((g) => g.trips.length > 0);

  return (
    <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-3 lg:gap-6">
      <div className="flex flex-col gap-4 lg:col-span-2">
        {groups.length === 0 ? (
          <Card>
            <EmptyState
              icon="plane"
              title={m.trips.emptyTitle}
              body={m.trips.emptyBody}
              action={
                <ButtonLink href="/expenses/trips/new" variant="primary" icon="plus">
                  {m.trips.newTrip}
                </ButtonLink>
              }
            />
          </Card>
        ) : (
          groups.map((g) => (
            <Card key={g.label} as="section" className="flex flex-col gap-2 px-2">
              <h2 className="px-2 text-caption font-semibold text-muted">{g.label}</h2>
              <TripList trips={g.trips} today={today} label={m.trips.groupLabel(g.label)} />
            </Card>
          ))
        )}
      </div>
      <Card as="section" className="flex flex-col gap-3">
        <h2 className="text-caption font-semibold text-muted">{m.trips.howTitle}</h2>
        <p className="text-body text-text">{m.trips.howJoin}</p>
        <p className="text-body text-muted">{m.trips.howLabel}</p>
      </Card>
    </div>
  );
}

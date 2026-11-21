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
  const groups = [
    { label: "Now", trips: trips.filter((t) => t.startDate <= today && today <= t.endDate) },
    // listTrips is latest first; upcoming reads soonest first.
    { label: "Upcoming", trips: trips.filter((t) => t.startDate > today).reverse() },
    { label: "Past", trips: trips.filter((t) => t.endDate < today) },
  ].filter((g) => g.trips.length > 0);

  return (
    <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-3 lg:gap-6">
      <div className="flex flex-col gap-4 lg:col-span-2">
        {groups.length === 0 ? (
          <Card>
            <EmptyState
              icon="plane"
              title="No trips yet"
              body="A trip groups what you spend while away, so you can see what it cost. Your budget stays the same."
              action={
                <ButtonLink href="/expenses/trips/new" variant="primary" icon="plus">
                  New trip
                </ButtonLink>
              }
            />
          </Card>
        ) : (
          groups.map((g) => (
            <Card key={g.label} as="section" className="flex flex-col gap-2 px-2">
              <h2 className="px-2 text-caption font-semibold text-muted">{g.label}</h2>
              <TripList trips={g.trips} today={today} label={`${g.label} trips`} />
            </Card>
          ))
        )}
      </div>
      <Card as="section" className="flex flex-col gap-3">
        <h2 className="text-caption font-semibold text-muted">How trips work</h2>
        <p className="text-body text-text">
          Expenses dated in a trip join it automatically. You can take one out, or add one from another day, such as
          flights booked earlier.
        </p>
        <p className="text-body text-muted">
          A trip is a label: its expenses still count in your budget, or in the fund they were paid from, exactly as
          before.
        </p>
      </Card>
    </div>
  );
}

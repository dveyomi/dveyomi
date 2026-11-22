import { getServerI18n } from "@/i18n/server";
import { notFound, redirect } from "next/navigation";
import { TripEditor } from "@/components/TripEditor";
import { tripSubtitle } from "@/components/TripList";
import { TripSummary } from "@/components/TripSummary";
import { ButtonLink } from "@/components/ui";
import { tripLength } from "@/lib/calc";
import { loadExpenseOptions } from "@/lib/data/transactions";
import { loadTrip, removedFromTrip, tripTransactions } from "@/lib/data/trips";
import { createClient, getUserId } from "@/lib/supabase/server";
import { getToday } from "@/lib/today";
import { removeFromTripAction, resetToAutomaticAction } from "../actions";

/** One trip (§5.12): the user's own only (another user's or an unknown id is a 404). */
export async function TripContent({ params }: { params: Promise<{ id: string }> }) {
  if (!(await getUserId())) redirect("/login");
  const [supabase, today, { id }] = await Promise.all([createClient(), getToday(), params]);
  const trip = await loadTrip(supabase, id);
  if (!trip) notFound();
  const [txns, removed, { categories }] = await Promise.all([
    tripTransactions(supabase, trip.id),
    removedFromTrip(supabase, trip.id),
    loadExpenseOptions(supabase),
  ]);
  const days = tripLength({ start: trip.startDate, end: trip.endDate });
  const { m, locale } = await getServerI18n();

  return (
    <>
      <div className="flex flex-col items-start gap-2">
        <ButtonLink href="/expenses/trips" variant="ghost" icon="chevron-left">
          {m.trips.title}
        </ButtonLink>
        <div className="flex w-full flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="flex min-w-0 flex-col gap-1">
            <h1 className="text-title font-semibold break-words text-text">{trip.name}</h1>
            <p className="text-body text-muted">
              {tripSubtitle(m, locale, trip)} · {m.trips.days(days)}
            </p>
          </div>
          <TripEditor trip={trip} />
        </div>
      </div>
      <TripSummary
        trip={trip}
        txns={txns}
        removed={removed}
        categories={categories}
        today={today}
        removeFromTrip={removeFromTripAction}
        resetToAutomatic={resetToAutomaticAction}
      />
    </>
  );
}

import { redirect } from "next/navigation";
import { ExpensesOverview } from "@/components/ExpensesOverview";
import { RecurringSuggestions } from "@/components/RecurringSuggestions";
import { isYearMonth } from "@/lib/calc";
import { loadExpensesView } from "@/lib/data/expenses";
import { loadDetections } from "@/lib/data/recurring";
import { listTrips } from "@/lib/data/trips";
import { createClient, getUserId } from "@/lib/supabase/server";
import { getToday } from "@/lib/today";

type Param = string | string[] | undefined;
type ExpensesContentProps = { searchParams: Promise<{ view?: Param; month?: Param; range?: Param }> };

/**
 * ?view=analytics, ?month=YYYY-MM and ?range=period; anything else falls back
 * to the calendar, this month. Payments that look recurring are asked about
 * above it (§5.8).
 */
export async function ExpensesContent({ searchParams }: ExpensesContentProps) {
  if (!(await getUserId())) redirect("/login");
  const [supabase, today, params] = await Promise.all([createClient(), getToday(), searchParams]);
  const range = params.range === "period" ? "period" : "month";
  const month = isYearMonth(params.month) ? params.month : null;
  const [data, suggestions, trips] = await Promise.all([
    loadExpensesView(supabase, today, { range, month }),
    loadDetections(supabase, today),
    listTrips(supabase),
  ]);
  return (
    <>
      <RecurringSuggestions suggestions={suggestions} />
      <ExpensesOverview
        data={data}
        today={today}
        initialView={params.view === "analytics" ? "analytics" : "calendar"}
        trips={trips}
      />
    </>
  );
}

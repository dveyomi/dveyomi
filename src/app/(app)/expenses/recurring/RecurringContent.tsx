import { getServerI18n } from "@/i18n/server";
import { redirect } from "next/navigation";
import { RecurringList } from "@/components/RecurringList";
import { ButtonLink, Card } from "@/components/ui";
import { loadRecurringView } from "@/lib/data/recurring";
import { createClient, getUserId } from "@/lib/supabase/server";
import { getToday } from "@/lib/today";

/** The recurring payments list, with a note on how they work beside it on desktop. */
export async function RecurringContent() {
  if (!(await getUserId())) redirect("/login");
  const [supabase, today] = await Promise.all([createClient(), getToday()]);
  const { rules, period } = await loadRecurringView(supabase, today);
  const { m } = await getServerI18n();

  return (
    <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-3 lg:gap-6">
      <div className="flex flex-col gap-4 lg:col-span-2">
        <RecurringList rules={rules} period={period} today={today} />
      </div>
      <Card as="section" className="flex flex-col gap-3">
        <h2 className="text-caption font-semibold text-muted">{m.overview.howItWorks}</h2>
        <p className="text-body text-text">{m.overview.recurringAdded}</p>
        <p className="text-body text-muted">{m.overview.recurringHow}</p>
        <div>
          <ButtonLink href="/expenses/new?returnTo=%2Fexpenses%2Frecurring" variant="secondary" icon="plus">
            {m.overview.addExpense}
          </ButtonLink>
        </div>
      </Card>
    </div>
  );
}

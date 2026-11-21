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

  return (
    <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-3 lg:gap-6">
      <div className="flex flex-col gap-4 lg:col-span-2">
        <RecurringList rules={rules} period={period} today={today} />
      </div>
      <Card as="section" className="flex flex-col gap-3">
        <h2 className="text-caption font-semibold text-muted">How it works</h2>
        <p className="text-body text-text">
          Each payment is added to your expenses on the day it&rsquo;s due, marked unchecked until you check it.
        </p>
        <p className="text-body text-muted">
          To add one, switch on Repeat when you add an expense. Paying the same thing three times? We&rsquo;ll ask on the
          Expenses tab.
        </p>
        <div>
          <ButtonLink href="/expenses/new?returnTo=%2Fexpenses%2Frecurring" variant="secondary" icon="plus">
            Add expense
          </ButtonLink>
        </div>
      </Card>
    </div>
  );
}

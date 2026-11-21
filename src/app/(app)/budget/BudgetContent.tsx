import { redirect } from "next/navigation";
import { Card, EmptyState } from "@/components/ui";
import { ensureCurrentPeriod } from "@/lib/data/ensurePeriod";
import { createClient, getUserId } from "@/lib/supabase/server";
import { getToday } from "@/lib/today";

/** Renews the current period if due; a user with no budget yet is sent to onboarding. */
export async function BudgetContent() {
  if (!(await getUserId())) redirect("/login");
  const period = await ensureCurrentPeriod(await createClient(), await getToday());
  if (!period) redirect("/onboarding");
  // Placeholder until the Budget screen is built.
  return (
    <Card>
      <EmptyState icon="chart" title="Your budget is set" body="The budget screen is coming next." />
    </Card>
  );
}

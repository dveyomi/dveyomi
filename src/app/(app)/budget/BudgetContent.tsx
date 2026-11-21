import { redirect } from "next/navigation";
import { BudgetOverview } from "@/components/BudgetOverview";
import { loadBudgetView } from "@/lib/data/budget";
import { loadSavingView } from "@/lib/data/funds";
import { loadReviewStatus } from "@/lib/data/review";
import { createClient, getUserId } from "@/lib/supabase/server";
import { getToday } from "@/lib/today";

type BudgetContentProps = {
  searchParams: Promise<{
    tab?: string | string[];
    saved?: string | string[];
    deleted?: string | string[];
    reviewed?: string | string[];
  }>;
};

/** Renews the current period if due; a user with no budget yet is sent to onboarding. */
export async function BudgetContent({ searchParams }: BudgetContentProps) {
  if (!(await getUserId())) redirect("/login");
  const [supabase, today, { tab, saved, deleted, reviewed }] = await Promise.all([createClient(), getToday(), searchParams]);
  const view = await loadBudgetView(supabase, today);
  if (!view.summary) redirect("/onboarding");
  // After loadBudgetView: it renews the period if due, which can create this period's savings prompt
  // and is the period carried leftovers are read for.
  const [saving, review] = await Promise.all([loadSavingView(supabase, today), loadReviewStatus(supabase, today)]);
  return (
    <BudgetOverview
      {...view}
      saving={saving}
      today={today}
      tab={tab === "saving" ? "saving" : "spending"}
      review={review}
      notice={saved === "1" ? "saved" : deleted === "1" ? "deleted" : reviewed === "1" ? "reviewed" : undefined}
    />
  );
}

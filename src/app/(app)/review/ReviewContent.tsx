import { redirect } from "next/navigation";
import { LeftoverBreakdown, LeftoverPrompt } from "@/components/LeftoverPrompt";
import { OverspendReview } from "@/components/OverspendReview";
import { ButtonLink, Card, EmptyState } from "@/components/ui";
import { loadReview } from "@/lib/data/review";
import { createClient, getUserId } from "@/lib/supabase/server";
import { getToday } from "@/lib/today";
import { applyRaiseAction, recordLeftoverAction } from "./actions";

/**
 * The oldest ended budget not yet reviewed: its leftover and where it came
 * from, what went over (with raise suggestions), and where the leftover goes.
 * Phone: one column in that order. Desktop: the leftover and its destination
 * on the left, overspending and suggestions on the right.
 */
export async function ReviewContent() {
  if (!(await getUserId())) redirect("/login");
  const [supabase, today] = await Promise.all([createClient(), getToday()]);
  const review = await loadReview(supabase, today);

  if (!review) {
    return (
      <>
        <Header title="Review" />
        <Card>
          <EmptyState
            icon="check"
            title="Nothing to review"
            body="When a budget ends, you'll review what was left over here."
            action={
              <ButtonLink href="/budget" variant="primary">
                Back to budget
              </ButtonLink>
            }
          />
        </Card>
      </>
    );
  }

  return (
    <>
      <Header
        title={`Your ${review.monthLabel} review`}
        subtitle={
          review.laterCount > 0
            ? `Then ${review.laterCount} more ended ${review.laterCount === 1 ? "budget" : "budgets"} to review.`
            : undefined
        }
      />
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <div className="lg:col-start-1 lg:row-start-1">
          <LeftoverBreakdown monthLabel={review.monthLabel} period={review.period} breakdown={review.breakdown} />
        </div>
        <div className="lg:col-start-2 lg:row-span-2 lg:row-start-1">
          <OverspendReview
            monthLabel={review.monthLabel}
            overspent={review.overspent}
            suggestions={review.suggestions}
            current={review.current}
            apply={applyRaiseAction}
          />
        </div>
        <div className="lg:col-start-1 lg:row-start-2">
          <LeftoverPrompt
            monthLabel={review.monthLabel}
            totalPence={review.breakdown.totalPence}
            funds={review.funds}
            record={recordLeftoverAction.bind(null, review.periodId)}
          />
        </div>
      </div>
    </>
  );
}

function Header({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="flex flex-col gap-3">
      <div>
        <ButtonLink href="/budget" variant="ghost" icon="chevron-left">
          Budget
        </ButtonLink>
      </div>
      <h1 className="text-title font-semibold text-text md:text-display">{title}</h1>
      {subtitle ? <p className="text-body text-muted">{subtitle}</p> : null}
    </div>
  );
}

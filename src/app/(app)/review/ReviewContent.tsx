import { getServerI18n } from "@/i18n/server";
import { redirect } from "next/navigation";
import { LeftoverBreakdown, LeftoverPrompt, OverspendPrompt } from "@/components/LeftoverPrompt";
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
  const i18n = await getServerI18n();
  const r = i18n.m.review;
  const review = await loadReview(supabase, today, i18n);

  if (!review) {
    return (
      <>
        <Header title={r.title} back={r.budget} />
        <Card>
          <EmptyState
            icon="check"
            title={r.nothingTitle}
            body={r.nothingBody}
            action={
              <ButtonLink href="/budget" variant="primary">
                {r.backToBudget}
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
        title={r.yourReview(review.monthLabel)}
        back={r.budget}
        subtitle={review.laterCount > 0 ? r.thenMore(review.laterCount) : undefined}
      />
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <div className="lg:col-start-1 lg:row-start-1">
          <LeftoverBreakdown
            monthLabel={review.monthLabel}
            period={review.period}
            breakdown={review.breakdown}
            overspendPence={review.overspendPence}
          />
        </div>
        <div className="lg:col-start-2 lg:row-span-2 lg:row-start-1">
          <OverspendReview
            monthLabel={review.monthLabel}
            raiseApplies={review.raiseApplies}
            overspent={review.overspent}
            suggestions={review.suggestions}
            current={review.current}
            apply={applyRaiseAction}
          />
        </div>
        <div className="lg:col-start-1 lg:row-start-2">
          {review.overspendPence > 0 ? (
            <OverspendPrompt
              monthLabel={review.monthLabel}
              currentLabel={review.raiseApplies.currentLabel}
              overspendPence={review.overspendPence}
              funds={review.funds}
              record={recordLeftoverAction.bind(null, review.periodId)}
            />
          ) : (
            <LeftoverPrompt
              monthLabel={review.monthLabel}
              currentLabel={review.raiseApplies.currentLabel}
              totalPence={review.breakdown.totalPence}
              funds={review.funds}
              record={recordLeftoverAction.bind(null, review.periodId)}
            />
          )}
        </div>
      </div>
    </>
  );
}

function Header({ title, back, subtitle }: { title: string; back: string; subtitle?: string }) {
  return (
    <div className="flex flex-col gap-3">
      <div>
        <ButtonLink href="/budget" variant="ghost" icon="chevron-left">
          {back}
        </ButtonLink>
      </div>
      <h1 className="text-title font-semibold text-text md:text-display">{title}</h1>
      {subtitle ? <p className="text-body text-muted">{subtitle}</p> : null}
    </div>
  );
}

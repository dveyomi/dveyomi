"use client";

import { useI18n } from "@/i18n/client";
import { AllocationCard } from "@/components/AllocationCard";
import { BudgetTabs, type BudgetTab } from "@/components/BudgetTabs";
import { categoryIcon } from "@/components/categoryIcon";
import { SafeToSpendInfo } from "@/components/SafeToSpendInfo";
import { SavedNotice, type SavedNoticeKind } from "@/components/SavedNotice";
import { SavingTab } from "@/components/SavingTab";
import { UnassignedNudge } from "@/components/UnassignedNudge";
import { ButtonLink, Card, EmptyState, Gauge, Money, Notice, StatusBadge } from "@/components/ui";
import {
  displaySafeToSpend,
  formatDaysLeft,
  formatPeriodRange,
  formatShortDate,
  leftToSpendPercent,
  overBudgetPence,
  type BudgetSummary,
  type IsoDate,
  type Period,
} from "@/lib/calc";
import type { SavingView } from "@/lib/data/funds";
import type { ReviewStatus } from "@/lib/data/review";
import type { CategoryRow } from "@/lib/data/types";

type BudgetOverviewProps = {
  period: Period;
  summary: BudgetSummary | null;
  categories: CategoryRow[];
  tab: BudgetTab;
  /** The Saving tab's funds and waiting savings. */
  saving: SavingView;
  /** The user's today, for dating money added to a fund. */
  today: IsoDate;
  /** A confirmation after returning from the editor, the ⋯ menu or the review. */
  notice?: SavedNoticeKind;
  /** An ended period waiting for review, leftovers carried in, and the unassigned nudge. */
  review?: ReviewStatus;
};

const groups = [
  { title: "Needs", kind: "need" },
  { title: "Wants", kind: "want" },
  { title: "No budget yet", kind: null },
] as const;

/** The Budget tab (§5.4). Every figure is read from `summary`; nothing is worked out here. */
export function BudgetOverview({ period, summary, categories, tab, saving, today, notice, review }: BudgetOverviewProps) {
  const { fmt } = useI18n();
  if (!summary) {
    return (
      <Card>
        <EmptyState
          icon="chart"
          title="Set up your budget"
          body="Tell us your income and what it's for, and your budget will show here."
          action={
            <ButtonLink href="/onboarding" variant="primary">
              Set up your budget
            </ButtonLink>
          }
        />
      </Card>
    );
  }

  const over = overBudgetPence(summary);
  const safe = displaySafeToSpend(summary);
  return (
    <div className="grid items-start gap-6 lg:grid-cols-5">
      <section aria-label="This period" className="flex flex-col gap-4 lg:sticky lg:top-8 lg:col-span-2">
        <SavedNotice notice={notice} />
        {review?.pending ? (
          <Notice tone="neutral">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p>Your {review.pending.monthLabel} budget has ended.</p>
              <ButtonLink href="/review" variant="primary">
                Review it
              </ButtonLink>
            </div>
          </Notice>
        ) : null}
        {review?.nudgePence ? <UnassignedNudge amountPence={review.nudgePence} /> : null}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <StatusBadge status={summary.status} />
            <span className="text-body text-muted">
              {formatPeriodRange(period.start, period.end)}
            </span>
          </div>
          <ButtonLink href="/budget/edit" variant="secondary" icon="edit">
            Set new budget
          </ButtonLink>
        </div>

        <Card className="flex flex-col gap-4">
          <Gauge
            percent={leftToSpendPercent(summary)}
            state={over > 0 ? "over" : "normal"}
            label="Left to spend"
            valueText={
              over > 0
                ? `Over budget by ${fmt.money(over)}`
                : `${fmt.money(summary.leftToSpendPence)} left`
            }
          >
            {over > 0 ? (
              <p className="flex flex-col items-center text-danger-fg">
                <span className="text-caption">Over budget by </span>
                <Money pence={over} size="fit" tone="neutral" />
              </p>
            ) : (
              <>
                <span className="text-caption text-muted">Left to spend</span>
                <Money pence={summary.leftToSpendPence} size="fit" />
              </>
            )}
            <span className="text-caption text-muted">
              {formatDaysLeft(summary.daysLeft)}
            </span>
          </Gauge>

          <dl className="grid grid-cols-2 gap-3">
            <Card raised className="flex flex-col gap-1">
              <dt className="text-caption text-muted">Safe to spend per day</dt>
              <dd className="flex items-center justify-between gap-2 text-title font-semibold text-text">
                <Money pence={safe.perDayPence} />
                <SafeToSpendInfo
                  leftToSpendPence={summary.leftToSpendPence}
                  needsLeftPence={summary.needsLeftPence}
                  daysLeft={summary.daysLeft}
                  safeToSpendPerDayPence={safe.perDayPence}
                  belowZero={safe.belowZero}
                />
              </dd>
            </Card>
            <Card raised className="flex flex-col gap-1">
              <dt className="text-caption text-muted">Next budget</dt>
              <dd className="text-body font-semibold text-text">{formatShortDate(period.nextStart)}</dd>
            </Card>
          </dl>
          {review && (review.carried.length > 0 || review.adjustments.length > 0) ? (
            <div className="flex flex-col gap-1">
              {review.carried.map((c, i) => (
                <p key={i} className="text-caption text-muted">
                  Includes <Money pence={c.amountPence} tone="neutral" /> carried from {c.fromLabel}
                </p>
              ))}
              {review.adjustments.map((a) => (
                <p key={`${a.kind}-${a.label}`} className="text-caption text-muted">
                  {a.kind === "late_change"
                    ? `${a.label}: ${fmt.signedMoney(a.amountPence)}`
                    : a.kind === "overspend"
                      ? `${a.label} ${fmt.signedMoney(a.amountPence)}`
                      : `${fmt.signedMoney(a.amountPence)} ${a.label}`}
                </p>
              ))}
            </div>
          ) : null}
        </Card>

        {summary.overAllocatedPence > 0 ? (
          <Notice tone="danger">
            <p>
              Your allocations are <Money pence={summary.overAllocatedPence} tone="neutral" /> more than your
              spending money.
            </p>
          </Notice>
        ) : null}
      </section>

      <div className="lg:col-span-3">
        <BudgetTabs
          initial={tab}
          spending={<SpendingPanel summary={summary} categories={categories} />}
          saving={<SavingTab view={saving} today={today} />}
        />
      </div>
    </div>
  );
}

function SpendingPanel({ summary, categories }: { summary: BudgetSummary; categories: CategoryRow[] }) {
  if (summary.categories.length === 0) {
    return (
      <Card>
        <EmptyState
          icon="pie"
          title="Nothing allocated yet"
          body="Give each part of your spending money a job in Set new budget."
        />
      </Card>
    );
  }
  // Show figures in category-name order (categories arrive sorted by name).
  const order = new Map(categories.map((c, i) => [c.id, i]));
  const sorted = summary.categories
    .filter((f) => order.has(f.categoryId))
    .toSorted((a, b) => order.get(a.categoryId)! - order.get(b.categoryId)!);
  const byId = new Map(categories.map((c) => [c.id, c]));

  return (
    <div className="flex flex-col gap-6">
      {groups.map(({ title, kind }) => {
        const figures = sorted.filter((f) => f.kind === kind);
        if (figures.length === 0) return null;
        return (
          <section key={title} aria-labelledby={`group-${kind ?? "none"}`} className="flex flex-col gap-3">
            <h2 id={`group-${kind ?? "none"}`} className="text-caption font-semibold tracking-wide text-muted uppercase">
              {title}
            </h2>
            <ul className="grid gap-3 xl:grid-cols-2">
              {figures.map((f) => {
                const c = byId.get(f.categoryId)!;
                return (
                  <li key={f.categoryId}>
                    <AllocationCard figure={f} name={c.name} icon={categoryIcon(c)} />
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

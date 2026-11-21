import { AllocationCard } from "@/components/AllocationCard";
import { BudgetTabs, type BudgetTab } from "@/components/BudgetTabs";
import { categoryIcon } from "@/components/categoryIcon";
import { SafeToSpendInfo } from "@/components/SafeToSpendInfo";
import { ButtonLink, Card, EmptyState, Gauge, Money, Notice, StatusBadge } from "@/components/ui";
import {
  formatDayMonth,
  formatGBP,
  formatShortDate,
  leftToSpendPercent,
  overBudgetPence,
  type BudgetSummary,
  type Period,
} from "@/lib/calc";
import type { CategoryRow } from "@/lib/data/types";

type BudgetOverviewProps = {
  period: Period;
  summary: BudgetSummary | null;
  categories: CategoryRow[];
  tab: BudgetTab;
  /** A confirmation after returning from the editor or the ⋯ menu. */
  notice?: "saved" | "deleted";
};

const notices = { saved: "Budget saved.", deleted: "Category deleted." } as const;

const groups = [
  { title: "Needs", kind: "need" },
  { title: "Wants", kind: "want" },
  { title: "No budget yet", kind: null },
] as const;

/** The Budget tab (§5.4). Every figure is read from `summary`; nothing is worked out here. */
export function BudgetOverview({ period, summary, categories, tab, notice }: BudgetOverviewProps) {
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
  return (
    <div className="grid items-start gap-6 lg:grid-cols-5">
      <section aria-label="This period" className="flex flex-col gap-4 lg:sticky lg:top-8 lg:col-span-2">
        <div role="status">
          {notice ? (
            <Notice tone="neutral">
              <p>{notices[notice]}</p>
            </Notice>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <StatusBadge status={summary.status} />
            <span className="text-body text-muted">
              {formatDayMonth(period.start)} – {formatDayMonth(period.end)}
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
                ? `Over budget by ${formatGBP(over)}`
                : `${formatGBP(summary.leftToSpendPence)} left`
            }
          >
            {over > 0 ? (
              <p className="flex flex-col items-center text-danger-fg">
                <span className="text-caption">Over budget by </span>
                <Money pence={over} size="display" tone="neutral" />
              </p>
            ) : (
              <>
                <span className="text-caption text-muted">Left to spend</span>
                <Money pence={summary.leftToSpendPence} size="display" />
              </>
            )}
            <span className="text-caption text-muted">
              {summary.daysLeft} {summary.daysLeft === 1 ? "day" : "days"} left
            </span>
          </Gauge>

          <dl className="grid grid-cols-2 gap-3">
            <Card raised className="flex flex-col gap-1">
              <dt className="text-caption text-muted">Safe to spend per day</dt>
              <dd className="flex items-center justify-between gap-2 text-title font-semibold text-text">
                <Money pence={summary.safeToSpendPerDayPence} />
                <SafeToSpendInfo
                  leftToSpendPence={summary.leftToSpendPence}
                  needsLeftPence={summary.needsLeftPence}
                  daysLeft={summary.daysLeft}
                  safeToSpendPerDayPence={summary.safeToSpendPerDayPence}
                />
              </dd>
            </Card>
            <Card raised className="flex flex-col gap-1">
              <dt className="text-caption text-muted">Next budget</dt>
              <dd className="text-body font-semibold text-text">{formatShortDate(period.nextStart)}</dd>
            </Card>
          </dl>
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
          saving={
            <Card>
              <EmptyState
                icon="savings"
                title="Savings funds"
                body="Your funds and the savings waiting to be moved will show here."
              />
            </Card>
          }
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

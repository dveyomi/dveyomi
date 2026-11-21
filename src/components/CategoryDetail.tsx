import { categoryIcon } from "@/components/categoryIcon";
import { CategoryMenu } from "@/components/CategoryMenu";
import { ButtonLink, Card, EmptyState, Icon, ListRow, Money, ProgressBar } from "@/components/ui";
import { formatDaysLeft, formatPeriodRange, formatShortDate, percentLeft, type CategoryFigure, type Period } from "@/lib/calc";
import type { CategoryUse } from "@/lib/data/budgetEdit";
import type { CategoryTxn } from "@/lib/data/category";
import type { CategoryRow } from "@/lib/data/types";

type CategoryDetailProps = {
  period: Period;
  category: CategoryRow;
  /** From the Budget tab's summary; null when the category has no allocation and no spending. */
  figure: CategoryFigure | null;
  daysLeft: number;
  /** Newest first. */
  transactions: CategoryTxn[];
  /** Why it can't be deleted, or null when it can. */
  inUse: CategoryUse | null;
};

/** One category's budget and its expenses this period (§5.4). Figures are read, never worked out. */
export function CategoryDetail({ period, category, figure, daysLeft, transactions, inUse }: CategoryDetailProps) {
  const pct = figure ? percentLeft(figure) : null;
  const over = figure !== null && figure.overPence > 0;
  const fundPaid = transactions.some((t) => t.fundName !== null);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <ButtonLink href="/budget" variant="ghost" icon="chevron-left">
          Budget
        </ButtonLink>
        <span className="text-body text-muted">
          {formatPeriodRange(period.start, period.end)}
        </span>
        <CategoryMenu categoryId={category.id} name={category.name} inUse={inUse} inBudget={pct !== null} />
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-5">
        <Card as="section" className="flex flex-col gap-5 lg:sticky lg:top-8 lg:col-span-2">
          <div className="flex items-center gap-3">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-pill bg-card-raised text-text">
              <Icon name={categoryIcon(category)} size="lg" />
            </span>
            <div className="min-w-0">
              <h1 className="truncate text-title font-semibold text-text">{category.name}</h1>
              <p className="text-caption text-muted">{category.kind === "need" ? "Need" : "Want"}</p>
            </div>
          </div>

          <dl className="grid grid-cols-3 gap-2">
            <Card raised className="flex flex-col gap-1 px-3">
              <dt className="text-caption text-muted">Budget</dt>
              <dd className="text-body font-semibold text-text">
                {pct === null ? "None" : <Money pence={figure!.allocatedPence} />}
              </dd>
            </Card>
            <Card raised className="flex flex-col gap-1 px-3">
              <dt className="text-caption text-muted">Spent</dt>
              <dd className="text-body font-semibold text-text">
                <Money pence={figure?.spentPence ?? 0} />
              </dd>
            </Card>
            <Card raised className="flex flex-col gap-1 px-3">
              <dt className="text-caption text-muted">Next budget</dt>
              <dd className="text-body font-semibold text-text">{formatShortDate(period.nextStart)}</dd>
            </Card>
          </dl>

          {pct === null ? (
            <div className="flex flex-col gap-3">
              <p className="text-body text-muted">No budget yet for this category this period.</p>
              <ButtonLink href={`/budget/edit?category=${category.id}`} variant="secondary" icon="edit">
                Set a budget
              </ButtonLink>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="flex items-baseline justify-between gap-3">
                {over ? (
                  <p className="text-title font-semibold text-danger-fg">
                    <Money pence={figure!.overPence} tone="neutral" /> over
                  </p>
                ) : (
                  <p className="text-title font-semibold text-text">
                    <Money pence={figure!.leftPence} tone="neutral" /> left
                  </p>
                )}
                {over ? null : <span className="text-caption font-semibold text-accent-fg">{pct}% left</span>}
              </div>
              <ProgressBar percent={pct} state={over ? "over" : "normal"} label={`${category.name} budget left`} />
              <p className="text-caption text-muted">
                {formatDaysLeft(daysLeft)}
              </p>
            </div>
          )}
        </Card>

        <section aria-labelledby="category-expenses" className="flex flex-col gap-3 lg:col-span-3">
          <div className="flex items-center justify-between gap-3">
            <h2 id="category-expenses" className="text-title font-semibold text-text">
              Expenses
            </h2>
            <ButtonLink href={`/expenses/new?category=${category.id}`} variant="primary" icon="plus">
              Log expense
            </ButtonLink>
          </div>
          <Card className="px-2 py-1">
            {transactions.length === 0 ? (
              <EmptyState icon="wallet" title="No expenses yet" body="No expenses in this category this period." />
            ) : (
              <ul aria-label="Expenses this period" className="flex flex-col divide-y divide-border">
                {transactions.map((t) => (
                  <li key={t.id}>
                    <ListRow
                      title={t.name}
                      subtitle={t.fundName ? `${formatShortDate(t.date)} · from ${t.fundName}` : formatShortDate(t.date)}
                      trailing={<Money pence={t.amountPence} />}
                    />
                  </li>
                ))}
              </ul>
            )}
          </Card>
          {fundPaid ? (
            <p className="text-caption text-muted">
              Expenses paid from a savings fund are listed here but don&apos;t count toward this budget.
            </p>
          ) : null}
        </section>
      </div>
    </div>
  );
}

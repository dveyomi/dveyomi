"use client";

import { useI18n } from "@/i18n/client";
import { categoryIcon } from "@/components/categoryIcon";
import { editHref } from "@/components/TransactionList";
import { CategoryMenu } from "@/components/CategoryMenu";
import { ButtonLink, Card, EmptyState, Icon, ListRow, Money, ProgressBar } from "@/components/ui";
import { percentLeft, type CategoryFigure, type Period } from "@/lib/calc";
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
  const { m, fmt } = useI18n();
  const c = m.category;
  const pct = figure ? percentLeft(figure) : null;
  const over = figure !== null && figure.overPence > 0;
  const fundPaid = transactions.some((t) => t.fundName !== null);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <ButtonLink href="/budget" variant="ghost" icon="chevron-left">
          {c.back}
        </ButtonLink>
        <span className="text-body text-muted">
          {fmt.periodRange(period.start, period.end)}
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
              <p className="text-caption text-muted">{c.kind[category.kind]}</p>
            </div>
          </div>

          <dl className="grid grid-cols-3 gap-2">
            <Card raised className="flex flex-col gap-1 px-3">
              <dt className="text-caption text-muted">{c.budget}</dt>
              <dd className="text-body font-semibold text-text">
                {pct === null ? c.none : <Money pence={figure!.allocatedPence} />}
              </dd>
            </Card>
            <Card raised className="flex flex-col gap-1 px-3">
              <dt className="text-caption text-muted">{c.spent}</dt>
              <dd className="text-body font-semibold text-text">
                <Money pence={figure?.spentPence ?? 0} />
              </dd>
            </Card>
            <Card raised className="flex flex-col gap-1 px-3">
              <dt className="text-caption text-muted">{c.nextBudget}</dt>
              <dd className="text-body font-semibold text-text">{fmt.shortDate(period.nextStart)}</dd>
            </Card>
          </dl>

          {pct === null ? (
            <div className="flex flex-col gap-3">
              <p className="text-body text-muted">{c.noBudget}</p>
              <ButtonLink href={`/budget/edit?category=${category.id}`} variant="secondary" icon="edit">
                {c.setBudget}
              </ButtonLink>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="flex items-baseline justify-between gap-3">
                {over ? (
                  <p className="text-title font-semibold text-danger-fg">
                    {c.over(fmt.money(figure!.overPence))}
                  </p>
                ) : (
                  <p className="text-title font-semibold text-text">
                    {c.left(fmt.money(figure!.leftPence))}
                  </p>
                )}
                {over ? null : <span className="text-caption font-semibold text-accent-fg">{c.percentLeft(pct)}</span>}
              </div>
              <ProgressBar percent={pct} state={over ? "over" : "normal"} label={c.budgetLeft(category.name)} />
              <p className="text-caption text-muted">
                {fmt.daysLeft(daysLeft)}
              </p>
            </div>
          )}
        </Card>

        <section aria-labelledby="category-expenses" className="flex flex-col gap-3 lg:col-span-3">
          <div className="flex items-center justify-between gap-3">
            <h2 id="category-expenses" className="text-title font-semibold text-text">
              {c.expenses}
            </h2>
            <ButtonLink href={`/expenses/new?category=${category.id}&returnTo=/budget/${category.id}`} variant="primary" icon="plus">
              {c.logExpense}
            </ButtonLink>
          </div>
          <Card className="px-2 py-1">
            {transactions.length === 0 ? (
              <EmptyState icon="wallet" title={c.noExpensesTitle} body={c.noExpensesBody} />
            ) : (
              <ul aria-label={c.expensesThisPeriod} className="flex flex-col divide-y divide-border">
                {transactions.map((t) => (
                  <li key={t.id}>
                    <ListRow
                      href={editHref(t.id, `/budget/${category.id}`)}
                      title={t.name}
                      subtitle={t.fundName ? c.fromFund(fmt.shortDate(t.date), t.fundName) : fmt.shortDate(t.date)}
                      trailing={<Money pence={t.amountPence} />}
                    />
                  </li>
                ))}
              </ul>
            )}
          </Card>
          {fundPaid ? (
            <p className="text-caption text-muted">
              {c.fundPaidNote}
            </p>
          ) : null}
        </section>
      </div>
    </div>
  );
}

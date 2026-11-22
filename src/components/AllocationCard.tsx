"use client";

import { useI18n } from "@/i18n/client";
import Link from "next/link";
import { Card, Icon, ProgressBar, type IconName } from "@/components/ui";
import { focusRing } from "@/components/ui/focus";
import { percentLeft, type CategoryFigure } from "@/lib/calc";

type AllocationCardProps = { figure: CategoryFigure; name: string; icon: IconName };

/** One category on the Budget tab: its bar and what is left (or over), linking to its detail. */
export function AllocationCard({ figure, name, icon }: AllocationCardProps) {
  const { m, fmt } = useI18n();
  const b = m.budget;
  const pct = percentLeft(figure);
  const over = figure.overPence > 0;
  return (
    <Link href={`/budget/${figure.categoryId}`} className={`group block rounded-md transition-shadow hover:shadow-float ${focusRing}`}>
      <Card className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-pill bg-card-raised text-text">
            <Icon name={icon} />
          </span>
          <span className="min-w-0 flex-1 truncate text-body font-semibold text-text">{name}</span>
          <span className="text-muted transition-colors group-hover:text-text">
            <Icon name="chevron-right" size="sm" />
          </span>
        </div>
        {pct === null ? (
          <p className="text-caption text-muted">
            {b.noBudgetSpent(fmt.money(figure.spentPence))}
          </p>
        ) : (
          <>
            <ProgressBar percent={pct} state={over ? "over" : "normal"} label={b.budgetLeft(name)} />
            {over ? (
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-body font-semibold text-danger-fg">
                  {b.over(fmt.money(figure.overPence))}
                </p>
                <p className="text-caption text-muted">
                  {b.budgetAmount(fmt.money(figure.allocatedPence))}
                </p>
              </div>
            ) : (
              <p className="text-body text-muted">
                <span className="font-semibold text-text">{b.leftOf(fmt.money(figure.leftPence), fmt.money(figure.allocatedPence))[0]}</span>
                {b.leftOf(fmt.money(figure.leftPence), fmt.money(figure.allocatedPence))[1]}
              </p>
            )}
          </>
        )}
      </Card>
    </Link>
  );
}

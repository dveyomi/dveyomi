import Link from "next/link";
import { Card, Icon, Money, ProgressBar, type IconName } from "@/components/ui";
import { focusRing } from "@/components/ui/focus";
import { percentLeft, type CategoryFigure } from "@/lib/calc";

type AllocationCardProps = { figure: CategoryFigure; name: string; icon: IconName };

/** One category on the Budget tab: its bar and what is left (or over), linking to its detail. */
export function AllocationCard({ figure, name, icon }: AllocationCardProps) {
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
            No budget yet · <Money pence={figure.spentPence} tone="neutral" /> spent
          </p>
        ) : (
          <>
            <ProgressBar percent={pct} state={over ? "over" : "normal"} label={`${name} budget left`} />
            {over ? (
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-body font-semibold text-danger-fg">
                  <Money pence={figure.overPence} tone="neutral" /> over
                </p>
                <p className="text-caption text-muted">
                  <Money pence={figure.allocatedPence} tone="neutral" /> budget
                </p>
              </div>
            ) : (
              <p className="text-body text-muted">
                <span className="font-semibold text-text">
                  <Money pence={figure.leftPence} tone="neutral" /> left
                </span>{" "}
                of <Money pence={figure.allocatedPence} tone="neutral" />
              </p>
            )}
          </>
        )}
      </Card>
    </Link>
  );
}

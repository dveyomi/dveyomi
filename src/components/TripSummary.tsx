"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { Badge, BottomSheet, Button, ButtonLink, Card, EmptyState, IconButton, ListRow, Money, Notice } from "@/components/ui";
import { formatShortDate, summariseTrip, type IsoDate } from "@/lib/calc";
import type { Trip, TripTxn } from "@/lib/data/trips";
import { CategoryBreakdown } from "./Analytics";
import { editHref, expenseSubtitle } from "./TransactionList";

type Change = (txnId: string) => Promise<{ error?: string }>;

type TripSummaryProps = {
  trip: Trip;
  /** The trip's expenses (dated in it unless taken out, plus any added by hand), newest first. */
  txns: TripTxn[];
  /** Expenses dated in the trip but taken out of it by hand. */
  removed: TripTxn[];
  categories: { id: string; name: string }[];
  today: IsoDate;
  removeFromTrip: Change;
  resetToAutomatic: Change;
};

/**
 * A trip's screen body (§5.12): the total with each category's share (the
 * Expenses tab's donut and legend), the spend per day, and the expenses, each
 * with its trip options. Figures come from calc's summariseTrip and include
 * fund-paid expenses. A trip is a label: nothing here changes a budget.
 */
export function TripSummary({ trip, txns, removed, categories, today, removeFromTrip, resetToAutomatic }: TripSummaryProps) {
  const router = useRouter();
  const ids = { total: useId(), days: useId(), list: useId(), removed: useId() };
  const [open, setOpen] = useState<TripTxn | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, startChange] = useTransition();
  const summary = summariseTrip(txns, { start: trip.startDate, end: trip.endDate });
  const names = new Map(categories.map((c) => [c.id, c.name]));
  const returnTo = `/expenses/trips/${trip.id}`;
  const inDates = (t: TripTxn) => t.date >= trip.startDate && t.date <= trip.endDate;

  function run(change: Change, txnId: string) {
    setOpen(null);
    startChange(async () => {
      const result = await change(txnId);
      setError(result.error ?? null);
      if (!result.error) router.refresh();
    });
  }

  return (
    <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-3 lg:gap-6">
      {error ? (
        <div role="alert" className="lg:col-span-3">
          <Notice tone="danger">{error}</Notice>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-col gap-4 lg:col-span-2">
        <Card as="section" className="flex flex-col gap-4">
          <h2 id={ids.total} className="text-caption font-semibold text-muted">
            Total
          </h2>
          <div role="region" aria-labelledby={ids.total}>
            <CategoryBreakdown summary={summary} names={names} caption="Spent on this trip" />
          </div>
        </Card>

        <Card as="section" className="flex flex-col gap-2 px-2">
          <h2 id={ids.list} className="px-2 text-caption font-semibold text-muted">
            Expenses
          </h2>
          <div role="region" aria-labelledby={ids.list}>
            {txns.length === 0 ? (
              <EmptyState
                icon="plane"
                title="No expenses on this trip yet"
                body="Expenses dated in the trip join it. You can also add one from another day on its edit form."
              />
            ) : (
              <ul className="flex flex-col divide-y divide-border">
                {txns.map((t) => (
                  <li key={t.id} className="flex items-center gap-1">
                    <div className="min-w-0 flex-1">
                      <ListRow
                        href={editHref(t.id, returnTo)}
                        title={t.name}
                        subtitle={
                          <>
                            {/* Badges first, so the truncated line never hides them on a phone. */}
                            {t.tripOverride ? (
                              <>
                                <Badge tone="neutral">added by hand</Badge>{" "}
                              </>
                            ) : null}
                            {t.unchecked ? (
                              <>
                                <Badge tone="warning">unchecked</Badge>{" "}
                              </>
                            ) : null}
                            <span>
                              {formatShortDate(t.date)} · {expenseSubtitle(t)}
                            </span>
                          </>
                        }
                        trailing={<Money pence={t.amountPence} />}
                      />
                    </div>
                    <IconButton icon="more" label={`Trip options for ${t.name}`} onClick={() => setOpen(t)} disabled={busy} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>
      </div>

      <div className="flex min-w-0 flex-col gap-4">
        <Card as="section" className="flex flex-col gap-2">
          <h2 id={ids.days} className="text-caption font-semibold text-muted">
            Per day
          </h2>
          <ul aria-label="Spending per day" className="flex flex-col divide-y divide-border">
            {summary.days.map((d) => (
              <li key={d.date} className="flex items-center justify-between gap-3 py-2 text-body">
                <span className={d.date === today ? "font-semibold text-text" : "text-text"}>
                  {formatShortDate(d.date)}
                  {d.date === today ? <span className="sr-only"> (today)</span> : null}
                </span>
                <span className={d.pence === 0 ? "text-muted" : "text-text"}>
                  <Money pence={d.pence} />
                </span>
              </li>
            ))}
          </ul>
        </Card>

        {removed.length > 0 ? (
          <Card as="section" className="flex flex-col gap-2 px-2">
            <div role="region" aria-labelledby={ids.removed} className="flex flex-col gap-2">
            <h2 id={ids.removed} className="px-2 text-caption font-semibold text-muted">
              Taken out of this trip
            </h2>
            <ul className="flex flex-col divide-y divide-border">
              {removed.map((t) => (
                <li key={t.id} className="flex items-center gap-2 pr-2">
                  <div className="min-w-0 flex-1">
                    <ListRow
                      href={editHref(t.id, returnTo)}
                      title={t.name}
                      subtitle={`${formatShortDate(t.date)} · ${expenseSubtitle(t)}`}
                      trailing={<Money pence={t.amountPence} />}
                    />
                  </div>
                  <Button variant="secondary" onClick={() => run(resetToAutomatic, t.id)} disabled={busy}>
                    {"Add back "}
                    <span className="sr-only">{t.name}</span>
                  </Button>
                </li>
              ))}
            </ul>
            </div>
          </Card>
        ) : null}
      </div>

      <BottomSheet open={open !== null} onClose={() => setOpen(null)} title={open?.name ?? "Expense"}>
        {open ? (
          <div className="flex flex-col gap-4">
            <p className="text-body text-muted">
              {open.tripOverride
                ? `Added to this trip by hand. Reset it and its date decides: ${inDates(open) ? "it stays in this trip" : "it leaves this trip"}.`
                : "In this trip because of its date. Taking it out keeps it in your budget as before."}
            </p>
            <div className="flex flex-col gap-3">
              {open.tripOverride ? (
                <Button variant="primary" onClick={() => run(resetToAutomatic, open.id)}>
                  Reset to automatic
                </Button>
              ) : (
                <Button variant="primary" onClick={() => run(removeFromTrip, open.id)}>
                  Take out of this trip
                </Button>
              )}
              <ButtonLink href={editHref(open.id, returnTo)} variant="secondary">
                Edit expense
              </ButtonLink>
            </div>
          </div>
        ) : null}
      </BottomSheet>
    </div>
  );
}

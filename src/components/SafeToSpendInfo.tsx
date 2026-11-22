"use client";

import { useState } from "react";
import { BottomSheet, IconButton, Money } from "@/components/ui";

type SafeToSpendInfoProps = {
  leftToSpendPence: number;
  needsLeftPence: number;
  daysLeft: number;
  /** As shown: never below £0.00 (displaySafeToSpend). */
  safeToSpendPerDayPence: number;
  /** The worked-out figure is below zero, so £0.00 is shown. */
  belowZero?: boolean;
};

/** The info button beside Safe to spend: the formula, with this period's figures. */
export function SafeToSpendInfo({ leftToSpendPence, needsLeftPence, daysLeft, safeToSpendPerDayPence, belowZero = false }: SafeToSpendInfoProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <IconButton icon="info" label="How safe to spend is worked out" onClick={() => setOpen(true)} />
      <BottomSheet open={open} onClose={() => setOpen(false)} title="Safe to spend per day">
        <div className="flex flex-col gap-4 text-body text-text">
          <p>
            <span className="font-semibold">(total left − Needs left) ÷ days left, counting today.</span> Unspent
            Needs stay reserved, so they never count as safe to spend. Money paid from a savings fund doesn&apos;t
            count either.
          </p>
          {belowZero ? (
            <p>
              Your Needs left is more than your total left, so nothing is safe to spend: it shows £0.00 a day and
              your budget is Out of Budget until you spend less or change your budget.
            </p>
          ) : null}
          <dl className="flex flex-col gap-2 rounded-md bg-card-raised p-4">
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Total left</dt>
              <dd>
                <Money pence={leftToSpendPence} />
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Needs left</dt>
              <dd>
                <Money pence={needsLeftPence} />
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Days left, counting today</dt>
              <dd className="tabular-nums">{daysLeft}</dd>
            </div>
            <div className="flex justify-between gap-4 border-t border-border pt-2 font-semibold">
              <dt>Safe to spend per day</dt>
              <dd>
                <Money pence={safeToSpendPerDayPence} />
              </dd>
            </div>
          </dl>
        </div>
      </BottomSheet>
    </>
  );
}

"use client";

import { useI18n } from "@/i18n/client";
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
  const { m, fmt } = useI18n();
  const b = m.budget;
  const [open, setOpen] = useState(false);
  return (
    <>
      <IconButton icon="info" label={b.safeInfo} onClick={() => setOpen(true)} />
      <BottomSheet open={open} onClose={() => setOpen(false)} title={b.safePerDay}>
        <div className="flex flex-col gap-4 text-body text-text">
          <p>
            <span className="font-semibold">{b.safeFormula}</span>
            {b.safeExplain}
          </p>
          {belowZero ? (
            <p>{b.safeBelowZero(fmt.money(0))}</p>
          ) : null}
          <dl className="flex flex-col gap-2 rounded-md bg-card-raised p-4">
            <div className="flex justify-between gap-4">
              <dt className="text-muted">{b.totalLeft}</dt>
              <dd>
                <Money pence={leftToSpendPence} />
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">{b.needsLeft}</dt>
              <dd>
                <Money pence={needsLeftPence} />
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">{b.daysLeftToday}</dt>
              <dd className="tabular-nums">{daysLeft}</dd>
            </div>
            <div className="flex justify-between gap-4 border-t border-border pt-2 font-semibold">
              <dt>{b.safePerDay}</dt>
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

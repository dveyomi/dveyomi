"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { removeExpenseAction } from "@/app/(app)/expenses/actions";
import { BottomSheet, ButtonLink, ConfirmDialog, IconButton, Money, Notice } from "@/components/ui";
import { formatGBP, formatWeekdayDate, type IsoDate } from "@/lib/calc";
import type { ExpenseTxn } from "@/lib/data/expenses";
import { ExpenseRow } from "./TransactionList";

type DaySheetProps = {
  /** The day open, or null when closed. */
  day: IsoDate | null;
  /** That day's expenses. */
  txns: ExpenseTxn[];
  /** The day's total, from calc's totalsByDay. */
  totalPence: number;
  /** This view's URL, to come back to after adding or editing. */
  returnTo: string;
  onClose: () => void;
};

/** A calendar day's expenses (§5.6): add one on that day, tap one to edit it, or delete it. */
export function DaySheet({ day, txns, totalPence, returnTo, onClose }: DaySheetProps) {
  const router = useRouter();
  const [confirming, setConfirming] = useState<ExpenseTxn | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Announced politely after a delete, since the row simply disappears. */
  const [status, setStatus] = useState("");

  function close() {
    setError(null);
    setStatus("");
    onClose();
  }

  async function remove() {
    if (!confirming || deleting) return;
    setDeleting(true);
    const result = await removeExpenseAction(confirming.id);
    setDeleting(false);
    setConfirming(null);
    if (result.error) {
      setError(result.error);
      return;
    }
    setError(null);
    setStatus(`${confirming.name} deleted`);
    router.refresh();
  }

  if (!day) return null;
  const addHref = `/expenses/new?date=${day}&returnTo=${encodeURIComponent(returnTo)}`;

  return (
    <>
      <BottomSheet open onClose={close} title={formatWeekdayDate(day)}>
        <div className="flex flex-col gap-4">
          <p role="status" className="sr-only">
            {status}
          </p>
          {error ? (
            <div role="alert">
              <Notice tone="danger">{error}</Notice>
            </div>
          ) : null}
          {txns.length === 0 ? (
            <p className="py-4 text-center text-body text-muted">No expenses on this day</p>
          ) : (
            <>
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-body text-muted">
                  {txns.length} {txns.length === 1 ? "expense" : "expenses"}
                </span>
                <span className="text-title font-semibold text-text">
                  <Money pence={totalPence} />
                </span>
              </div>
              <ul aria-label="Expenses on this day" className="flex flex-col divide-y divide-border">
                {txns.map((t) => (
                  <li key={t.id} className="flex items-center gap-1">
                    <div className="min-w-0 flex-1">
                      <ExpenseRow txn={t} returnTo={returnTo} />
                    </div>
                    <IconButton icon="trash" label={`Delete ${t.name}`} onClick={() => setConfirming(t)} />
                  </li>
                ))}
              </ul>
            </>
          )}
          <ButtonLink href={addHref} variant="primary" icon="plus" fullWidth>
            Add expense
          </ButtonLink>
        </div>
      </BottomSheet>
      <ConfirmDialog
        open={confirming !== null}
        title="Delete this expense?"
        body={
          confirming
            ? `${confirming.name} (${formatGBP(confirming.amountPence)}) will be removed from your expenses. This can't be undone.`
            : ""
        }
        confirmLabel={deleting ? "Deleting…" : "Delete"}
        tone="danger"
        onConfirm={() => void remove()}
        onCancel={() => setConfirming(null)}
      />
    </>
  );
}

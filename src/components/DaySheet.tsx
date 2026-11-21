"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { removeExpenseAction } from "@/app/(app)/expenses/actions";
import { confirmOccurrenceAction } from "@/app/(app)/expenses/recurring/actions";
import { BottomSheet, ButtonLink, ConfirmDialog, IconButton, Money, Notice } from "@/components/ui";
import { formatGBP, formatWeekdayDate, totalsByDay, type IsoDate } from "@/lib/calc";
import type { ExpenseTxn } from "@/lib/data/expenses";
import { ExpenseRow } from "./TransactionList";

type DaySheetProps = {
  /** The day open, or null when closed. */
  day: IsoDate | null;
  /** That day's expenses. */
  txns: ExpenseTxn[];
  /** This view's URL, to come back to after adding or editing. */
  returnTo: string;
  onClose: () => void;
};

/** A calendar day's expenses (§5.6): add one on that day, tap one to edit it, delete it, or mark an auto-added one as checked (§5.8). */
export function DaySheet({ day, txns: allTxns, returnTo, onClose }: DaySheetProps) {
  const router = useRouter();
  const [confirming, setConfirming] = useState<ExpenseTxn | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Announced politely after a delete, since the row simply disappears. */
  const [status, setStatus] = useState("");
  /** Deleted here: hidden at once, before the refreshed page data arrives. */
  const [removed, setRemoved] = useState<ReadonlySet<string>>(new Set());
  /** Where focus goes after a delete: a row's delete button (by expense id), or "add". */
  const focusAfter = useRef<string | null>(null);
  const body = useRef<HTMLDivElement>(null);
  /** Marked as checked here: shown checked at once, before the refreshed page data arrives. */
  const [checked, setChecked] = useState<ReadonlySet<string>>(new Set());
  const txns = allTxns
    .filter((t) => !removed.has(t.id))
    .map((t) => (checked.has(t.id) ? { ...t, unchecked: false } : t));

  // After a delete hides its row: focus stays in the sheet, on a neighbour or on "Add expense".
  useEffect(() => {
    const id = focusAfter.current;
    if (!id) return;
    focusAfter.current = null;
    const target =
      id === "add"
        ? body.current?.querySelector<HTMLElement>("[data-add-expense] a")
        : body.current?.querySelector<HTMLElement>(`[data-delete-for="${id}"]`);
    target?.focus();
  }, [removed]);

  function close() {
    setError(null);
    setStatus("");
    onClose();
  }

  async function remove() {
    if (!confirming || deleting) return;
    const txn = confirming;
    const at = txns.findIndex((t) => t.id === txn.id);
    const next = txns[at + 1] ?? txns[at - 1] ?? null;
    setDeleting(true);
    try {
      const result = await removeExpenseAction(txn.id);
      if (result.error) {
        setError(result.error);
        return;
      }
      setError(null);
      setRemoved((r) => new Set(r).add(txn.id));
      setStatus(`${txn.name} deleted`);
      focusAfter.current = next ? next.id : "add";
      router.refresh();
    } catch {
      setError("We couldn't delete this expense. Check your connection and try again.");
    } finally {
      setDeleting(false);
      setConfirming(null);
    }
  }

  async function markChecked(txn: ExpenseTxn) {
    try {
      const result = await confirmOccurrenceAction(txn.id);
      if (result.error) return setError(result.error);
      setError(null);
      setChecked((c) => new Set(c).add(txn.id));
      setStatus(`${txn.name} marked as checked`);
      router.refresh();
    } catch {
      setError("We couldn't mark this as checked. Check your connection and try again.");
    }
  }

  if (!day) return null;
  const addHref = `/expenses/new?date=${day}&returnTo=${encodeURIComponent(returnTo)}`;

  return (
    <>
      <BottomSheet open onClose={close} title={formatWeekdayDate(day)}>
        <div ref={body} className="flex flex-col gap-4">
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
                  <Money pence={totalsByDay(txns).get(day) ?? 0} />
                </span>
              </div>
              <ul aria-label="Expenses on this day" className="flex flex-col divide-y divide-border">
                {txns.map((t) => (
                  <li key={t.id} className="flex items-center gap-1">
                    <div className="min-w-0 flex-1">
                      <ExpenseRow txn={t} returnTo={returnTo} />
                    </div>
                    {t.unchecked ? (
                      <IconButton icon="check" label={`Mark ${t.name} as checked`} onClick={() => void markChecked(t)} />
                    ) : null}
                    <IconButton
                      icon="trash"
                      label={`Delete ${t.name}`}
                      data-delete-for={t.id}
                      onClick={() => setConfirming(t)}
                    />
                  </li>
                ))}
              </ul>
            </>
          )}
          <div data-add-expense>
            <ButtonLink href={addHref} variant="primary" icon="plus" fullWidth>
              Add expense
            </ButtonLink>
          </div>
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

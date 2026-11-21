"use client";

import { useId, useState } from "react";
import { confirmSavingsAction } from "@/app/(app)/budget/fundActions";
import { AmountInput, BottomSheet, Button, Money, Notice, TextField } from "@/components/ui";
import { formatGBP, formatPeriodRange, parseOptionalPence, penceToInputText, splitDifference } from "@/lib/calc";
import type { FundView, WaitingPrompt } from "@/lib/data/funds";
import { MAX_NAME_LENGTH } from "@/lib/validation/common";
import type { SplitInputLine } from "@/lib/validation/funds";

type MoveSavingsSheetProps = {
  prompt: WaitingPrompt;
  funds: FundView[];
  onClose: () => void;
  /** After the split was confirmed; the parent refreshes and says so. */
  onDone: () => void;
};

type NewFund = { name: string; target: string; amount: string };

const PREFILL_NOTE = {
  last_period: "Pre-filled with last period's split.",
  setup: "Pre-filled with the split you chose at setup.",
  none: null,
} as const;

/**
 * "Move your savings" (§5.4): the period's savings split across funds,
 * pre-filled from last period. The user confirms it, edits it, or sends part
 * of it to a new fund. Confirm stays off until the split adds up exactly.
 */
export function MoveSavingsSheet({ prompt, funds, onClose, onDone }: MoveSavingsSheetProps) {
  const [amounts, setAmounts] = useState<Record<string, string>>(() =>
    Object.fromEntries(prompt.prefill.map((l) => [l.fundId, penceToInputText(l.amountPence)])),
  );
  const [newFund, setNewFund] = useState<NewFund | null>(() =>
    funds.length === 0 ? { name: "", target: "", amount: "" } : null,
  );
  const statusId = useId();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fundPence = funds.map((f) => ({ fundId: f.id, amountPence: parseOptionalPence(amounts[f.id] ?? "") }));
  const newPence = newFund ? parseOptionalPence(newFund.amount) : 0;
  const newTarget = newFund ? parseOptionalPence(newFund.target) : 0;
  const allValid = fundPence.every((l) => l.amountPence !== null) && newPence !== null && newTarget !== null;
  const diff = splitDifference(prompt.savingsPence, [...fundPence.map((l) => l.amountPence ?? 0), newPence ?? 0]);
  const newNameOk = !newFund || (newFund.name.trim().length > 0 && newFund.name.trim().length <= MAX_NAME_LENGTH);
  const canConfirm = allValid && diff.state === "exact" && newNameOk && !busy;

  async function confirm() {
    if (!canConfirm) return;
    const lines: SplitInputLine[] = fundPence
      .filter((l) => (l.amountPence ?? 0) > 0)
      .map((l) => ({ fundId: l.fundId, amountPence: l.amountPence! }));
    if (newFund) {
      lines.push({
        newFund: { name: newFund.name.trim(), targetPence: newTarget || null },
        amountPence: newPence!,
      });
    }
    setBusy(true);
    try {
      const result = await confirmSavingsAction(prompt.periodId, lines);
      if (result.error) {
        setError(result.error);
        return;
      }
      onDone();
    } catch {
      setError("We couldn't move your savings. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  const note = PREFILL_NOTE[prompt.prefillFrom];
  return (
    <BottomSheet open onClose={onClose} title="Move your savings">
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-1">
          <p className="text-title font-semibold text-text">
            <Money pence={prompt.savingsPence} /> to move
          </p>
          <p className="text-caption text-muted">Savings for {formatPeriodRange(prompt.start, prompt.end)}.</p>
          {note ? <p className="text-caption text-muted">{note}</p> : null}
        </div>

        {error ? (
          <div role="alert">
            <Notice tone="danger">{error}</Notice>
          </div>
        ) : null}

        {funds.length > 0 ? (
          <div className="flex flex-col gap-3">
            {funds.map((f) => (
              <AmountInput
                key={f.id}
                label={f.name}
                hint={`Balance ${formatGBP(f.balancePence)}`}
                value={amounts[f.id] ?? ""}
                onChange={(t) => setAmounts((a) => ({ ...a, [f.id]: t }))}
                allowZero
              />
            ))}
          </div>
        ) : null}

        {newFund ? (
          <fieldset className="flex flex-col gap-4 rounded-md border border-border p-4">
            <legend className="px-1 text-caption font-medium text-muted">New fund</legend>
            <TextField
              label="New fund name"
              value={newFund.name}
              onChange={(e) => setNewFund({ ...newFund, name: e.target.value })}
              maxLength={MAX_NAME_LENGTH}
              autoComplete="off"
              placeholder="e.g. New car…"
              hint={`Required, up to ${MAX_NAME_LENGTH} characters.`}
            />
            <AmountInput
              label="Target (optional)"
              value={newFund.target}
              onChange={(target) => setNewFund({ ...newFund, target })}
              allowZero
            />
            <AmountInput
              label="Amount for the new fund"
              value={newFund.amount}
              onChange={(amount) => setNewFund({ ...newFund, amount })}
              allowZero
            />
            {funds.length > 0 ? (
              <Button variant="ghost" onClick={() => setNewFund(null)}>
                Remove the new fund
              </Button>
            ) : null}
          </fieldset>
        ) : (
          <Button variant="secondary" onClick={() => setNewFund({ name: "", target: "", amount: "" })}>
            Send to a new fund
          </Button>
        )}

        <p
          id={statusId}
          role="status"
          className={`text-body font-semibold ${diff.state === "exact" ? "text-positive-fg" : diff.state === "over" ? "text-danger-fg" : "text-warning-fg"}`}
        >
          {diff.state === "exact"
            ? `All ${formatGBP(prompt.savingsPence)} placed`
            : diff.state === "over"
              ? `${formatGBP(diff.pence)} over`
              : `${formatGBP(diff.pence)} left to place`}
        </p>

        <Button variant="primary" size="lg" fullWidth disabled={!canConfirm} aria-describedby={statusId} onClick={() => void confirm()}>
          {busy ? "Moving…" : "Confirm"}
        </Button>
      </div>
    </BottomSheet>
  );
}

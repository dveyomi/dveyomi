"use client";

import { useI18n } from "@/i18n/client";
import { useId, useState } from "react";
import { confirmSavingsAction } from "@/app/(app)/budget/fundActions";
import { AmountInput, BottomSheet, Button, Notice, TextField } from "@/components/ui";
import { splitDifference } from "@/lib/calc";
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


/**
 * "Move your savings" (§5.4): the period's savings split across funds,
 * pre-filled from last period. The user confirms it, edits it, or sends part
 * of it to a new fund. Confirm stays off until the split adds up exactly.
 */
export function MoveSavingsSheet({ prompt, funds, onClose, onDone }: MoveSavingsSheetProps) {
  const { fmt, m } = useI18n();
  const sv = m.saving;
  const [amounts, setAmounts] = useState<Record<string, string>>(() =>
    Object.fromEntries(prompt.prefill.map((l) => [l.fundId, fmt.inputText(l.amountPence)])),
  );
  const [newFund, setNewFund] = useState<NewFund | null>(() =>
    funds.length === 0 ? { name: "", target: "", amount: "" } : null,
  );
  const statusId = useId();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fundPence = funds.map((f) => ({ fundId: f.id, amountPence: fmt.parseOptional(amounts[f.id] ?? "") }));
  const newPence = newFund ? fmt.parseOptional(newFund.amount) : 0;
  const newTarget = newFund ? fmt.parseOptional(newFund.target) : 0;
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
      setError(sv.moveFailed);
    } finally {
      setBusy(false);
    }
  }

  const note = prompt.prefillFrom === "none" ? null : sv.prefill[prompt.prefillFrom];
  return (
    <BottomSheet open onClose={onClose} title={sv.moveYourSavings}>
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-1">
          <p className="text-title font-semibold text-text">
            {sv.toMove(fmt.money(prompt.savingsPence))}
          </p>
          <p className="text-caption text-muted">{sv.savingsFor(fmt.periodRange(prompt.start, prompt.end))}</p>
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
                hint={sv.balanceHint(fmt.money(f.balancePence))}
                value={amounts[f.id] ?? ""}
                onChange={(t) => setAmounts((a) => ({ ...a, [f.id]: t }))}
                allowZero
              />
            ))}
          </div>
        ) : null}

        {newFund ? (
          <fieldset className="flex flex-col gap-4 rounded-md border border-border p-4">
            <legend className="px-1 text-caption font-medium text-muted">{sv.newFund}</legend>
            <TextField
              label={sv.newFundName}
              value={newFund.name}
              onChange={(e) => setNewFund({ ...newFund, name: e.target.value })}
              maxLength={MAX_NAME_LENGTH}
              autoComplete="off"
              placeholder={sv.newFundPlaceholder}
              hint={sv.newFundHint(MAX_NAME_LENGTH)}
            />
            <AmountInput
              label={sv.targetOptional}
              value={newFund.target}
              onChange={(target) => setNewFund({ ...newFund, target })}
              allowZero
            />
            <AmountInput
              label={sv.newFundAmount}
              value={newFund.amount}
              onChange={(amount) => setNewFund({ ...newFund, amount })}
              allowZero
            />
            {funds.length > 0 ? (
              <Button variant="ghost" onClick={() => setNewFund(null)}>
                {sv.removeNewFund}
              </Button>
            ) : null}
          </fieldset>
        ) : (
          <Button variant="secondary" onClick={() => setNewFund({ name: "", target: "", amount: "" })}>
            {sv.sendToNewFund}
          </Button>
        )}

        <p
          id={statusId}
          role="status"
          className={`text-body font-semibold ${diff.state === "exact" ? "text-positive-fg" : diff.state === "over" ? "text-danger-fg" : "text-warning-fg"}`}
        >
          {diff.state === "exact"
            ? sv.allPlaced(fmt.money(prompt.savingsPence))
            : diff.state === "over"
              ? sv.over(fmt.money(diff.pence))
              : sv.leftToPlace(fmt.money(diff.pence))}
        </p>

        <Button variant="primary" size="lg" fullWidth disabled={!canConfirm} aria-describedby={statusId} onClick={() => void confirm()}>
          {busy ? sv.moving : sv.confirm}
        </Button>
      </div>
    </BottomSheet>
  );
}

"use client";

import { useState, type FormEvent } from "react";
import { addFundMovementAction, saveFundAction } from "@/app/(app)/budget/fundActions";
import { AmountInput, BottomSheet, Button, Notice, TextField } from "@/components/ui";
import { parseOptionalPence, parsePence, penceToInputText, type IsoDate } from "@/lib/calc";
import type { FundView } from "@/lib/data/funds";
import { MAX_NAME_LENGTH } from "@/lib/validation/common";
import { expenseDateRange } from "@/lib/validation/expense";
import { MAX_FUND_NOTE_LENGTH, type FundField, type MovementField } from "@/lib/validation/funds";

const FAILED = "We couldn't save that. Check your connection and try again.";

type Problem<F> = { message: string; field?: F } | null;

function FormError<F>({ problem }: { problem: Problem<F> }) {
  if (!problem || problem.field) return null;
  return (
    <div role="alert">
      <Notice tone="danger">{problem.message}</Notice>
    </div>
  );
}

type MovementSheetProps = {
  fund: FundView;
  kind: "contribution" | "withdrawal";
  today: IsoDate;
  onClose: () => void;
  /** After it was saved; the parent refreshes and says so. */
  onDone: (message: string) => void;
};

/** Add money to a fund, or take some out: a dated record with an optional note. Fund-only: the budget is untouched. */
export function FundMovementSheet({ fund, kind, today, onClose, onDone }: MovementSheetProps) {
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(today);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<Problem<MovementField>>(null);
  const adding = kind === "contribution";
  const label = adding ? "Add money" : "Withdraw";
  const error = (f: MovementField) => (problem?.field === f ? problem.message : null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    const amountPence = parsePence(amount);
    if (amountPence === null) {
      setProblem({ message: "Enter an amount greater than £0.00, e.g. 25.00", field: "amount" });
      return;
    }
    setBusy(true);
    try {
      const result = await addFundMovementAction(fund.id, { kind, amountPence, date, note });
      if (result.error) {
        setProblem({ message: result.error, field: result.field });
        return;
      }
      onDone(adding ? `Added to ${fund.name}` : `Withdrawn from ${fund.name}`);
    } catch {
      setProblem({ message: FAILED });
    } finally {
      setBusy(false);
    }
  }

  return (
    <BottomSheet open onClose={onClose} title={adding ? `Add money to ${fund.name}` : `Withdraw from ${fund.name}`}>
      <form onSubmit={(e) => void submit(e)} noValidate className="flex flex-col gap-4">
        <FormError problem={problem} />
        <AmountInput
          label="Amount"
          value={amount}
          onChange={(t) => {
            setAmount(t);
            if (problem?.field === "amount") setProblem(null);
          }}
          error={error("amount")}
          autoFocus
          required
        />
        <TextField
          label="Date"
          type="date"
          value={date}
          min={expenseDateRange(today).min}
          max={today}
          onChange={(e) => setDate(e.target.value)}
          error={error("date")}
          required
        />
        <TextField
          label="Note (optional)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          error={error("note")}
          maxLength={MAX_FUND_NOTE_LENGTH}
          autoComplete="off"
          placeholder={adding ? "e.g. Birthday money…" : "e.g. Deposit for flights…"}
        />
        <p className="text-caption text-muted">
          {adding
            ? "This records money you put in the fund yourself. Your budget doesn't change."
            : "This records money you took out of the fund. Your budget doesn't change."}
        </p>
        <Button type="submit" variant="primary" fullWidth disabled={busy}>
          {busy ? "Saving…" : label}
        </Button>
      </form>
    </BottomSheet>
  );
}

type EditSheetProps = {
  /** The fund to edit, or null for a new one. */
  fund: FundView | null;
  onClose: () => void;
  onDone: (message: string) => void;
};

/** A fund's name, optional target and optional target date (new or existing). */
export function FundEditSheet({ fund, onClose, onDone }: EditSheetProps) {
  const [name, setName] = useState(fund?.name ?? "");
  const [target, setTarget] = useState(fund?.targetPence ? penceToInputText(fund.targetPence) : "");
  const [targetDate, setTargetDate] = useState(fund?.targetDate ?? "");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<Problem<FundField>>(null);
  const error = (f: FundField) => (problem?.field === f ? problem.message : null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    const targetPence = parseOptionalPence(target);
    if (targetPence === null) {
      setProblem({ message: "Enter a target of £0.00 or more, or leave it empty.", field: "target" });
      return;
    }
    setBusy(true);
    try {
      const result = await saveFundAction(fund?.id ?? null, { name, targetPence, targetDate });
      if (result.error) {
        setProblem({ message: result.error, field: result.field });
        return;
      }
      onDone(fund ? `${name.trim()} saved` : `${name.trim()} created`);
    } catch {
      setProblem({ message: FAILED });
    } finally {
      setBusy(false);
    }
  }

  return (
    <BottomSheet open onClose={onClose} title={fund ? "Edit fund" : "New fund"}>
      <form onSubmit={(e) => void submit(e)} noValidate className="flex flex-col gap-4">
        <FormError problem={problem} />
        <TextField
          label="Name"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (problem?.field === "name") setProblem(null);
          }}
          error={error("name")}
          maxLength={MAX_NAME_LENGTH}
          autoComplete="off"
          placeholder="e.g. Holiday…"
          required
        />
        <AmountInput label="Target (optional)" value={target} onChange={setTarget} allowZero error={error("target")} />
        <TextField
          label="Target date (optional)"
          type="date"
          value={targetDate}
          onChange={(e) => setTargetDate(e.target.value)}
          error={error("targetDate")}
        />
        <Button type="submit" variant="primary" fullWidth disabled={busy}>
          {busy ? "Saving…" : "Save"}
        </Button>
      </form>
    </BottomSheet>
  );
}

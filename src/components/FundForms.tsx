"use client";

import { useI18n } from "@/i18n/client";
import { amountRequiredError } from "@/lib/validation/common";
import { useState, type FormEvent } from "react";
import { addFundMovementAction, moveBetweenFundsAction, saveFundAction, withdrawFromFundAction } from "@/app/(app)/budget/fundActions";
import { AmountInput, BottomSheet, Button, Money, Notice, RadioCards, Select, TextField } from "@/components/ui";
import { type IsoDate } from "@/lib/calc";
import type { FundView } from "@/lib/data/funds";
import { MAX_NAME_LENGTH } from "@/lib/validation/common";
import { expenseDateRange } from "@/lib/validation/expense";
import {
  MAX_FUND_NOTE_LENGTH,
  type FundField,
  type FundMoveField,
  type MovementField,
  type WithdrawDestination,
} from "@/lib/validation/funds";

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

const destinations = [
  {
    value: "spending" as const,
    title: "Add to this month's spending money",
    description: "It goes into Left to spend for this budget.",
  },
  { value: "out" as const, title: "Just take it out", description: "Only the fund changes. Your budget doesn't change." },
];

/**
 * Add money to a fund, or take some out: a dated record with an optional
 * note. Adding is fund-only. Taking out asks where the money goes: into this
 * month's spending money (the default, which raises Left to spend) or just
 * out of the fund.
 */
export function FundMovementSheet({ fund, kind, today, onClose, onDone }: MovementSheetProps) {
  const i18n = useI18n();
  const { fmt } = i18n;
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(today);
  const [note, setNote] = useState("");
  const [destination, setDestination] = useState<WithdrawDestination>("spending");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<Problem<MovementField>>(null);
  const adding = kind === "contribution";
  const label = adding ? "Add money" : "Withdraw";
  const error = (f: MovementField) => (problem?.field === f ? problem.message : null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    const amountPence = fmt.parse(amount);
    if (amountPence === null) {
      setProblem({ message: amountRequiredError(i18n, "25.00"), field: "amount" });
      return;
    }
    setBusy(true);
    try {
      const result = adding
        ? await addFundMovementAction(fund.id, { kind, amountPence, date, note })
        : await withdrawFromFundAction(fund.id, { amountPence, date, note, destination });
      if (result.error) {
        setProblem({ message: result.error, field: result.field });
        return;
      }
      onDone(
        adding
          ? `Added to ${fund.name}`
          : destination === "spending"
            ? `${fmt.money(amountPence)} from ${fund.name} added to this month's spending money`
            : `Withdrawn from ${fund.name}`,
      );
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
        {adding ? null : (
          <RadioCards label="Where the money goes" options={destinations} value={destination} onChange={setDestination} />
        )}
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
        {adding ? (
          <p className="text-caption text-muted">This records money you put in the fund yourself. Your budget doesn&apos;t change.</p>
        ) : null}
        <Button type="submit" variant="primary" fullWidth disabled={busy}>
          {busy ? "Saving…" : label}
        </Button>
      </form>
    </BottomSheet>
  );
}

type MoveSheetProps = {
  fund: FundView;
  /** The user's other funds, by name. */
  others: FundView[];
  today: IsoDate;
  onClose: () => void;
  onDone: (message: string) => void;
};

/** Move money from one fund to another: a withdrawal here and a contribution there, same date. Fund-only: the budget is untouched. */
export function FundMoveSheet({ fund, others, today, onClose, onDone }: MoveSheetProps) {
  const i18n = useI18n();
  const { fmt } = i18n;
  const [to, setTo] = useState(others[0]?.id ?? "");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(today);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<Problem<FundMoveField>>(null);
  const error = (f: FundMoveField) => (problem?.field === f ? problem.message : null);
  const target = others.find((f) => f.id === to);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    const amountPence = fmt.parse(amount);
    if (amountPence === null) {
      setProblem({ message: amountRequiredError(i18n, "25.00"), field: "amount" });
      return;
    }
    setBusy(true);
    try {
      const result = await moveBetweenFundsAction(fund.id, to, { amountPence, date, note });
      if (result.error) {
        setProblem({ message: result.error, field: result.field });
        return;
      }
      onDone(`${fmt.money(amountPence)} moved from ${fund.name} to ${target?.name ?? "your other fund"}`);
    } catch {
      setProblem({ message: FAILED });
    } finally {
      setBusy(false);
    }
  }

  return (
    <BottomSheet open onClose={onClose} title={`Move money from ${fund.name}`}>
      <form onSubmit={(e) => void submit(e)} noValidate className="flex flex-col gap-4">
        <FormError problem={problem} />
        <p className="text-body text-muted">
          {fund.name} holds <Money pence={fund.balancePence} tone="neutral" />
        </p>
        <Select
          label="To"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          options={others.map((f) => ({ value: f.id, label: f.name }))}
          error={error("to")}
          required
        />
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
          placeholder="e.g. Topping up the holiday…"
        />
        <p className="text-caption text-muted">Both funds&apos; histories show the move. Your budget doesn&apos;t change.</p>
        <Button type="submit" variant="primary" fullWidth disabled={busy || !target}>
          {busy ? "Moving…" : "Move money"}
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
  const i18n = useI18n();
  const { fmt } = i18n;
  const [name, setName] = useState(fund?.name ?? "");
  const [target, setTarget] = useState(fund?.targetPence ? fmt.inputText(fund.targetPence) : "");
  const [targetDate, setTargetDate] = useState(fund?.targetDate ?? "");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<Problem<FundField>>(null);
  const error = (f: FundField) => (problem?.field === f ? problem.message : null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    const targetPence = fmt.parseOptional(target);
    if (targetPence === null) {
      setProblem({ message: i18n.m.validation.targetOptional(fmt.money(0)), field: "target" });
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

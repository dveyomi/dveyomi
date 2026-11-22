"use client";

import { useI18n } from "@/i18n/client";
import type { Messages } from "@/i18n/messages";
import { amountRequiredError } from "@/lib/validation/common";
import { useState, type FormEvent } from "react";
import { addFundMovementAction, moveBetweenFundsAction, saveFundAction, withdrawFromFundAction } from "@/app/(app)/budget/fundActions";
import { AmountInput, BottomSheet, Button, Notice, RadioCards, Select, TextField } from "@/components/ui";
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

function destinations(m: Messages) {
  return [
    { value: "spending" as const, title: m.saving.toSpendingTitle, description: m.saving.toSpendingBody },
    { value: "out" as const, title: m.saving.takeOutTitle, description: m.saving.takeOutBody },
  ];
}

/**
 * Add money to a fund, or take some out: a dated record with an optional
 * note. Adding is fund-only. Taking out asks where the money goes: into this
 * month's spending money (the default, which raises Left to spend) or just
 * out of the fund.
 */
export function FundMovementSheet({ fund, kind, today, onClose, onDone }: MovementSheetProps) {
  const i18n = useI18n();
  const { fmt, m } = i18n;
  const sv = m.saving;
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(today);
  const [note, setNote] = useState("");
  const [destination, setDestination] = useState<WithdrawDestination>("spending");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<Problem<MovementField>>(null);
  const adding = kind === "contribution";
  const label = adding ? sv.addMoney : sv.withdraw;
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
          ? sv.addedTo(fund.name)
          : destination === "spending"
            ? sv.addedToSpending(fmt.money(amountPence), fund.name)
            : sv.withdrawnFrom(fund.name),
      );
    } catch {
      setProblem({ message: sv.failed });
    } finally {
      setBusy(false);
    }
  }

  return (
    <BottomSheet open onClose={onClose} title={adding ? sv.addMoneyTo(fund.name) : sv.withdrawFrom(fund.name)}>
      <form onSubmit={(e) => void submit(e)} noValidate className="flex flex-col gap-4">
        <FormError problem={problem} />
        <AmountInput
          label={sv.amount}
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
          <RadioCards label={sv.whereMoneyGoes} options={destinations(m)} value={destination} onChange={setDestination} />
        )}
        <TextField
          label={sv.date}
          type="date"
          value={date}
          min={expenseDateRange(today).min}
          max={today}
          onChange={(e) => setDate(e.target.value)}
          error={error("date")}
          required
        />
        <TextField
          label={sv.noteOptional}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          error={error("note")}
          maxLength={MAX_FUND_NOTE_LENGTH}
          autoComplete="off"
          placeholder={adding ? sv.notePlaceholderAdd : sv.notePlaceholderWithdraw}
        />
        {adding ? (
          <p className="text-caption text-muted">{sv.addNote}</p>
        ) : null}
        <Button type="submit" variant="primary" fullWidth disabled={busy}>
          {busy ? m.common.saving : label}
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
  const { fmt, m } = i18n;
  const sv = m.saving;
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
      onDone(sv.movedBetween(fmt.money(amountPence), fund.name, target?.name ?? sv.otherFund));
    } catch {
      setProblem({ message: sv.failed });
    } finally {
      setBusy(false);
    }
  }

  return (
    <BottomSheet open onClose={onClose} title={sv.moveFrom(fund.name)}>
      <form onSubmit={(e) => void submit(e)} noValidate className="flex flex-col gap-4">
        <FormError problem={problem} />
        <p className="text-body text-muted">
          {sv.holds(fund.name, fmt.money(fund.balancePence))}
        </p>
        <Select
          label={sv.to}
          value={to}
          onChange={(e) => setTo(e.target.value)}
          options={others.map((f) => ({ value: f.id, label: f.name }))}
          error={error("to")}
          required
        />
        <AmountInput
          label={sv.amount}
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
          label={sv.date}
          type="date"
          value={date}
          min={expenseDateRange(today).min}
          max={today}
          onChange={(e) => setDate(e.target.value)}
          error={error("date")}
          required
        />
        <TextField
          label={sv.noteOptional}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          error={error("note")}
          maxLength={MAX_FUND_NOTE_LENGTH}
          autoComplete="off"
          placeholder={sv.movePlaceholder}
        />
        <p className="text-caption text-muted">{sv.moveNote}</p>
        <Button type="submit" variant="primary" fullWidth disabled={busy || !target}>
          {busy ? sv.moving : sv.moveMoney}
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
  const { fmt, m } = i18n;
  const sv = m.saving;
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
      onDone(fund ? sv.fundSaved(name.trim()) : sv.fundCreated(name.trim()));
    } catch {
      setProblem({ message: sv.failed });
    } finally {
      setBusy(false);
    }
  }

  return (
    <BottomSheet open onClose={onClose} title={fund ? sv.editFund : sv.newFund}>
      <form onSubmit={(e) => void submit(e)} noValidate className="flex flex-col gap-4">
        <FormError problem={problem} />
        <TextField
          label={sv.name}
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (problem?.field === "name") setProblem(null);
          }}
          error={error("name")}
          maxLength={MAX_NAME_LENGTH}
          autoComplete="off"
          placeholder={sv.fundPlaceholder}
          required
        />
        <AmountInput label={sv.targetOptional} value={target} onChange={setTarget} allowZero error={error("target")} />
        <TextField
          label={sv.targetDateOptional}
          type="date"
          value={targetDate}
          onChange={(e) => setTargetDate(e.target.value)}
          error={error("targetDate")}
        />
        <Button type="submit" variant="primary" fullWidth disabled={busy}>
          {busy ? m.common.saving : m.common.save}
        </Button>
      </form>
    </BottomSheet>
  );
}

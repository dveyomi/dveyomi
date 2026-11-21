"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import {
  AmountInput,
  Button,
  ConfirmDialog,
  IconButton,
  Notice,
  RadioSegments,
  Select,
  TextField,
} from "@/components/ui";
import { formatRelativeDay, parsePence, type IsoDate } from "@/lib/calc";
import type { Kind } from "@/lib/validation/budgetEdit";
import { MAX_NAME_LENGTH } from "@/lib/validation/common";
import {
  expenseDateRange,
  isIsoDate,
  MAX_ACCOUNT_LABEL_LENGTH,
  MAX_EXPENSE_NAME_LENGTH,
  MAX_NOTES_LENGTH,
  validateExpense,
  type ExpenseField,
  type ExpenseFormValues,
} from "@/lib/validation/expense";

/** What saving or deleting returns when it fails; on success it navigates away instead. */
type ActionResult = { error: string; field?: ExpenseField } | void;

type ExpenseFormProps = {
  categories: { id: string; name: string; kind: Kind }[];
  /** The user's funds; with none, the "Paid from fund" row is left out. */
  funds: { id: string; name: string }[];
  today: IsoDate;
  initial: ExpenseFormValues;
  /** Where Close goes (and where saving returns to). */
  returnTo: string;
  /** Saves the entered values (the server checks them again). */
  save: (input: unknown) => Promise<ActionResult>;
  /** Given when editing: deletes the expense, after confirming. */
  remove?: () => Promise<ActionResult>;
};

/** The Category select's value for "New category". Category ids are UUIDs, so it can't clash. */
const NEW_CATEGORY = "new";
const KINDS = [
  { value: "need" as const, label: "Need" },
  { value: "want" as const, label: "Want" },
];
const FUND_HINT = "Pay with money you saved in a fund. It won't count toward your budget.";

/**
 * Add or edit an expense (§5.7): a large amount at the top, then name,
 * category (or a new one), date, the fund it was paid from, account and
 * notes. Close and save sit at the top; editing adds a red Delete Expense at
 * the bottom. A fund-paid expense keeps its category.
 */
export function ExpenseForm({ categories, funds, today, initial, returnTo, save, remove }: ExpenseFormProps) {
  const router = useRouter();
  const editing = remove !== undefined;
  const [values, setValues] = useState(initial);
  const [newCategory, setNewCategory] = useState<{ name: string; kind: Kind } | null>(null);
  const [error, setError] = useState<{ message: string; field?: ExpenseField } | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [saving, startSaving] = useTransition();
  const [deleting, startDeleting] = useTransition();
  const busy = saving || deleting;
  const formRef = useRef<HTMLFormElement>(null);

  // Move focus to the field a failed save points at.
  useEffect(() => {
    if (error?.field) formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [error]);

  const fieldError = (field: ExpenseField) => (error?.field === field ? error.message : null);
  function update(patch: Partial<ExpenseFormValues>, field: ExpenseField) {
    setValues((v) => ({ ...v, ...patch }));
    if (error?.field === field) setError(null);
  }

  function chooseCategory(value: string) {
    if (value === NEW_CATEGORY) {
      setNewCategory((c) => c ?? { name: "", kind: "need" });
      update({ categoryId: null }, "category");
    } else {
      setNewCategory(null);
      update({ categoryId: value }, "category");
    }
    if (error?.field === "newCategory") setError(null);
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    const raw = {
      name: values.name,
      amountPence: parsePence(values.amountText) ?? Number.NaN,
      date: values.date,
      category: newCategory ?? (values.categoryId ? { id: values.categoryId } : null),
      fundId: values.fundId,
      accountLabel: values.accountLabel,
      notes: values.notes,
    };
    const checked = validateExpense(raw, today);
    if (!checked.ok) return setError({ message: checked.error, field: checked.field });
    setError(null);
    startSaving(async () => {
      const result = await save(raw);
      if (result) setError({ message: result.error, field: result.field });
    });
  }

  function confirmDelete() {
    setConfirmingDelete(false);
    if (!remove) return;
    startDeleting(async () => {
      const result = await remove();
      if (result) setError({ message: result.error });
    });
  }

  const byKind = (kind: Kind) => categories.filter((c) => c.kind === kind).map((c) => ({ value: c.id, label: c.name }));
  const title = editing ? "Edit expense" : "Add expense";
  const dateRange = expenseDateRange(today);

  return (
    <form
      ref={formRef}
      onSubmit={submit}
      noValidate
      aria-labelledby="expense-form-title"
      className="mx-auto flex w-full max-w-phone flex-col gap-6 px-4 py-4 md:my-10 md:max-w-xl md:rounded-md md:bg-card md:p-8 md:shadow-float"
    >
      <div className="flex items-center justify-between gap-3">
        <IconButton icon="close" label="Close" onClick={() => router.push(returnTo)} />
        <h1 id="expense-form-title" className="text-body font-semibold text-text md:text-title">
          {title}
        </h1>
        <div className="md:invisible">
          <IconButton icon="check" label="Save expense" type="submit" variant="primary" disabled={busy} />
        </div>
      </div>

      {error && !error.field ? (
        <div role="alert">
          <Notice tone="danger">{error.message}</Notice>
        </div>
      ) : null}

      <AmountInput
        label="Amount"
        size="lg"
        value={values.amountText}
        onChange={(amountText) => update({ amountText }, "amount")}
        error={fieldError("amount")}
        autoFocus={!editing}
      />

      <div className="flex flex-col gap-4">
        <TextField
          label="Name"
          value={values.name}
          onChange={(e) => update({ name: e.target.value }, "name")}
          error={fieldError("name")}
          maxLength={MAX_EXPENSE_NAME_LENGTH}
          autoComplete="off"
          placeholder="e.g. Tesco…"
        />

        <div className="grid gap-4 md:grid-cols-2 md:items-start">
          <Select
            label="Category"
            value={newCategory ? NEW_CATEGORY : (values.categoryId ?? "")}
            onChange={(e) => chooseCategory(e.target.value)}
            placeholder="Choose a category"
            groups={[
              { label: "Needs", options: byKind("need") },
              { label: "Wants", options: byKind("want") },
            ]}
            options={[{ value: NEW_CATEGORY, label: "New category…" }]}
            error={fieldError("category")}
          />
          <TextField
            label="Date"
            type="date"
            value={values.date}
            onChange={(e) => update({ date: e.target.value }, "date")}
            hint={isIsoDate(values.date) ? formatRelativeDay(values.date, today) : undefined}
            error={fieldError("date")}
            min={dateRange.min}
            max={dateRange.max}
            required
          />
        </div>

        {newCategory ? (
          <fieldset className="flex flex-col gap-4 rounded-md border border-border p-4">
            <legend className="px-1 text-caption font-medium text-muted">New category</legend>
            <TextField
              label="Category name"
              value={newCategory.name}
              onChange={(e) => {
                setNewCategory({ ...newCategory, name: e.target.value });
                if (error?.field === "newCategory") setError(null);
              }}
              error={fieldError("newCategory")}
              maxLength={MAX_NAME_LENGTH}
              autoComplete="off"
              hint="It starts with no budget. You can give it one in Edit budget."
            />
            <RadioSegments
              label="Need or want"
              options={KINDS}
              value={newCategory.kind}
              onChange={(kind) => setNewCategory({ ...newCategory, kind })}
            />
          </fieldset>
        ) : null}

        {funds.length > 0 ? (
          <Select
            label="Paid from fund"
            value={values.fundId ?? ""}
            onChange={(e) => update({ fundId: e.target.value || null }, "fund")}
            options={[{ value: "", label: "None" }, ...funds.map((f) => ({ value: f.id, label: f.name }))]}
            hint={FUND_HINT}
            error={fieldError("fund")}
          />
        ) : null}

        <TextField
          label="Account (optional)"
          value={values.accountLabel}
          onChange={(e) => update({ accountLabel: e.target.value }, "accountLabel")}
          error={fieldError("accountLabel")}
          maxLength={MAX_ACCOUNT_LABEL_LENGTH}
          autoComplete="off"
          placeholder="e.g. Monzo or Amex…"
        />
        <TextField
          label="Notes (optional)"
          value={values.notes}
          onChange={(e) => update({ notes: e.target.value }, "notes")}
          error={fieldError("notes")}
          maxLength={MAX_NOTES_LENGTH}
          autoComplete="off"
        />
      </div>

      <div className="flex flex-col-reverse gap-3 md:flex-row md:items-center md:border-t md:border-border md:pt-6">
        {editing ? (
          <div className="md:mr-auto">
            <Button variant="danger" fullWidth onClick={() => setConfirmingDelete(true)} disabled={busy}>
              {deleting ? "Deleting…" : "Delete Expense"}
            </Button>
          </div>
        ) : null}
        <div className="hidden gap-3 md:ml-auto md:flex">
          <Button variant="secondary" onClick={() => router.push(returnTo)}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" disabled={busy}>
            {saving ? "Saving…" : "Save expense"}
          </Button>
        </div>
      </div>

      {editing ? (
        <ConfirmDialog
          open={confirmingDelete}
          title="Delete this expense?"
          body="It will be removed from your spending and budget. This can't be undone."
          confirmLabel="Delete"
          cancelLabel="Keep it"
          tone="danger"
          onConfirm={confirmDelete}
          onCancel={() => setConfirmingDelete(false)}
        />
      ) : null}
    </form>
  );
}

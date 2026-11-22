"use client";

import { useI18n } from "@/i18n/client";
import { amountRequiredError } from "@/lib/validation/common";
import { useState, type FormEvent } from "react";
import { AmountInput, Button, Card, EmptyState, IconButton, Money, TextField } from "@/components/ui";
import { type AllocationTotals } from "@/lib/calc";
import { MAX_CATEGORIES, MAX_NAME_LENGTH } from "@/lib/validation/common";

/**
 * The pieces of a category-allocation editor, shared by onboarding's spending
 * step and the Edit budget screen: the live figures, the Needs / Wants rows
 * and the "Add category" row. Figures come from calc's allocationTotals.
 */

export type Kind = "need" | "want";

export const KIND_TABS = [
  { value: "need" as const, label: "Needs" },
  { value: "want" as const, label: "Wants" },
];

/** A name already used by another category, ignoring case; undefined when free. */
export function nameClash(name: string, taken: string[]): string | undefined {
  return taken.find((t) => t.toLowerCase() === name.toLowerCase());
}

type SummaryProps = {
  totals: AllocationTotals;
  /** Shown under "To spend each month", e.g. "Before savings". */
  caption?: string;
  /** Whether any category exists; with none, no "every pound has a job" line. */
  hasCategories: boolean;
};

/** To spend each month, allocated, and how much is left to allocate or "£X over" in red. */
export function AllocationSummary({ totals, caption, hasCategories }: SummaryProps) {
  const { fmt } = useI18n();
  return (
    <Card className="grid grid-cols-2 gap-4" as="div">
      <Figure label="To spend each month" pence={totals.poolPence} caption={caption} />
      <Figure label="Allocated" pence={totals.allocatedPence} />
      <p aria-live="polite" className="col-span-2 text-body font-semibold">
        {totals.overAllocatedPence > 0 ? (
          <span className="text-danger-fg">{fmt.money(totals.overAllocatedPence)} over</span>
        ) : totals.unallocatedPence > 0 ? (
          <span className="text-muted">{fmt.money(totals.unallocatedPence)} left to allocate</span>
        ) : hasCategories ? (
          <span className="text-positive-fg">Every pound has a job</span>
        ) : null}
      </p>
    </Card>
  );
}

function Figure({ label, pence, caption }: { label: string; pence: number; caption?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-caption text-muted">{label}</span>
      <Money pence={pence} size="title" />
      {caption ? <span className="text-caption text-muted">{caption}</span> : null}
    </div>
  );
}

export type AllocationRow = { key: string | number; name: string; amountText: string };

type RowsProps = {
  kind: Kind;
  rows: AllocationRow[];
  onAmount: (key: AllocationRow["key"], amountText: string) => void;
  onRemove: (key: AllocationRow["key"]) => void;
  /** Adds an edit button per row (rename, need or want). */
  onEdit?: (key: AllocationRow["key"]) => void;
  /** Amounts may be £0 (an existing category kept with nothing this period). */
  allowZero?: boolean;
  /** The row whose amount takes focus on mount. */
  focusKey?: AllocationRow["key"];
  /** Per-row errors, by key. */
  errors?: Partial<Record<string, string>>;
};

/** One kind's categories, each an amount with its remove (and optional edit) button. */
export function AllocationRows({ kind, rows, onAmount, onRemove, onEdit, allowZero, focusKey, errors }: RowsProps) {
  if (rows.length === 0) {
    return (
      <EmptyState
        icon="pie"
        title={kind === "need" ? "No needs yet" : "No wants yet"}
        body={kind === "need" ? "Rent, bills, groceries, travel to work." : "Eating out, shopping, hobbies, treats."}
      />
    );
  }
  return (
    <ul className="flex flex-col gap-4">
      {rows.map((r) => {
        const error = errors?.[String(r.key)];
        return (
          <li key={r.key} className={`flex gap-1 ${error ? "items-center" : "items-end"}`}>
            <div className="min-w-0 flex-1">
              <AmountInput
                label={r.name}
                value={r.amountText}
                onChange={(text) => onAmount(r.key, text)}
                allowZero={allowZero}
                autoFocus={r.key === focusKey}
                error={error}
              />
            </div>
            <div className={`flex ${error ? "" : "pb-2.5"}`}>
              {onEdit ? <IconButton icon="edit" label={`Edit ${r.name}`} onClick={() => onEdit(r.key)} /> : null}
              <IconButton icon="trash" label={`Remove ${r.name}`} onClick={() => onRemove(r.key)} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** The "Add category" row: a name and an amount. Names are unique across both kinds, ignoring case. */
export function AddCategoryForm({
  kind,
  taken,
  onAdd,
}: {
  kind: Kind;
  /** Every category name already in the list, both kinds. */
  taken: string[];
  onAdd: (name: string, amountText: string) => void;
}) {
  const i18n = useI18n();
  const { fmt } = i18n;
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [amountError, setAmountError] = useState<string | null>(null);

  function submit(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    const clash = nameClash(trimmed, taken);
    setAmountError(null);
    if (!trimmed) return setNameError("Enter a name for the category.");
    if (clash) return setNameError(`You already have a category called ${clash}.`);
    if (trimmed.length > MAX_NAME_LENGTH) return setNameError(`Use up to ${MAX_NAME_LENGTH} characters.`);
    if (taken.length >= MAX_CATEGORIES) return setNameError(`You can add up to ${MAX_CATEGORIES} categories.`);
    setNameError(null);
    if (fmt.parse(amount) === null) return setAmountError(amountRequiredError(i18n));
    onAdd(trimmed, amount);
    setName("");
    setAmount("");
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 border-t border-border pt-4" aria-label={`Add a ${kind}`}>
      <TextField
        label="Category name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={kind === "need" ? "e.g. Rent…" : "e.g. Eating out…"}
        autoComplete="off"
        maxLength={MAX_NAME_LENGTH}
        error={nameError}
      />
      <AmountInput label="Amount" value={amount} onChange={setAmount} error={amountError} />
      <Button type="submit" variant="secondary">
        Add category
      </Button>
    </form>
  );
}

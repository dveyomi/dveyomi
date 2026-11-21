"use client";

import { useState, type FormEvent } from "react";
import { AmountInput, Button, Card, EmptyState, IconButton, Money, SegmentedTabs, TextField } from "@/components/ui";
import { AMOUNT_ERROR } from "@/components/ui/AmountInput";
import { allocationTotals, formatGBP, parsePence } from "@/lib/calc";
import { MAX_CATEGORIES, MAX_NAME_LENGTH } from "@/lib/data/onboarding";
import { livePence, type CategoryDraft } from "./draft";
import { StepHeading } from "./StepHeading";

type Kind = CategoryDraft["kind"];
const tabs = [
  { value: "need" as const, label: "Needs" },
  { value: "want" as const, label: "Wants" },
];

type SpendingProps = {
  incomePence: number;
  savingsPence: number;
  /** Until savings are entered (step 3), the amount to spend is the whole income. */
  savingsEntered: boolean;
  categories: CategoryDraft[];
  tab: Kind;
  onTab: (kind: Kind) => void;
  onAdd: (name: string, kind: Kind, amountText: string) => void;
  onAmount: (id: number, amountText: string) => void;
  onRemove: (id: number) => void;
};

/** Step 2: categories with an amount each, on Needs and Wants tabs, against what there is to spend. */
export function Spending({ incomePence, savingsPence, savingsEntered, categories, tab, onTab, onAdd, onAmount, onRemove }: SpendingProps) {
  const totals = allocationTotals(
    incomePence,
    savingsPence,
    categories.map((c) => ({ kind: c.kind, amountPence: livePence(c.amountText) })),
  );
  const shown = categories.filter((c) => c.kind === tab);

  return (
    <section aria-labelledby="step-heading" className="flex flex-col gap-6">
      <StepHeading
        title="Your spending budget"
        body="Give each category an amount. Needs are the bills and essentials; wants are everything else."
      />

      <Card className="grid grid-cols-2 gap-4" as="div">
        <Figure
          label="To spend each month"
          pence={totals.poolPence}
          caption={savingsEntered ? undefined : "Before savings"}
        />
        <Figure label="Allocated" pence={totals.allocatedPence} />
        <p aria-live="polite" className="col-span-2 text-body font-semibold">
          {totals.overAllocatedPence > 0 ? (
            <span className="text-danger-fg">{formatGBP(totals.overAllocatedPence)} over</span>
          ) : totals.unallocatedPence > 0 ? (
            <span className="text-muted">{formatGBP(totals.unallocatedPence)} left to allocate</span>
          ) : categories.length > 0 ? (
            <span className="text-positive-fg">Every pound has a job</span>
          ) : null}
        </p>
      </Card>

      <SegmentedTabs label="Category type" options={tabs} value={tab} onChange={onTab} />

      <Card className="flex flex-col gap-4">
        {shown.length === 0 ? (
          <EmptyState
            icon="pie"
            title={tab === "need" ? "No needs yet" : "No wants yet"}
            body={tab === "need" ? "Rent, bills, groceries, travel to work." : "Eating out, shopping, hobbies, treats."}
          />
        ) : (
          <ul className="flex flex-col gap-4">
            {shown.map((c) => (
              <li key={c.id} className="flex items-end gap-2">
                <div className="min-w-0 flex-1">
                  <AmountInput label={c.name} value={c.amountText} onChange={(text) => onAmount(c.id, text)} />
                </div>
                <div className="pb-2.5">
                  <IconButton icon="trash" label={`Remove ${c.name}`} onClick={() => onRemove(c.id)} />
                </div>
              </li>
            ))}
          </ul>
        )}
        <AddCategory
          key={tab}
          kind={tab}
          taken={categories.map((c) => c.name)}
          onAdd={(name, amountText) => onAdd(name, tab, amountText)}
        />
      </Card>
    </section>
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

/** The "Add category" row: a name and an amount. Names are unique across both tabs, ignoring case. */
function AddCategory({
  kind,
  taken,
  onAdd,
}: {
  kind: Kind;
  taken: string[];
  onAdd: (name: string, amountText: string) => void;
}) {
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [amountError, setAmountError] = useState<string | null>(null);

  function submit(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    const clash = taken.find((t) => t.toLowerCase() === trimmed.toLowerCase());
    setAmountError(null);
    if (!trimmed) return setNameError("Enter a name for the category.");
    if (clash) return setNameError(`You already have a category called ${clash}.`);
    if (trimmed.length > MAX_NAME_LENGTH) return setNameError(`Use up to ${MAX_NAME_LENGTH} characters.`);
    if (taken.length >= MAX_CATEGORIES) return setNameError(`You can add up to ${MAX_CATEGORIES} categories.`);
    setNameError(null);
    if (parsePence(amount) === null) return setAmountError(AMOUNT_ERROR);
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

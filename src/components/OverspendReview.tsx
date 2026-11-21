"use client";

import { useState } from "react";
import { AmountInput, Button, Card, Money, Notice } from "@/components/ui";
import { allocationTotals, formatGBP, parsePence, penceToInputText } from "@/lib/calc";
import type { CurrentFigures, Overspend, RaiseSuggestion } from "@/lib/data/review";

type OverspendReviewProps = {
  monthLabel: string;
  overspent: Overspend[];
  suggestions: RaiseSuggestion[];
  /** The current budget's figures, for each raise's effect on the total. */
  current: CurrentFigures;
  /** Raises a category's budget from the current period on. Resolves with an error to show, if any. */
  apply: (categoryId: string, amountPence: number) => Promise<{ error?: string }>;
};

/** The ended period's overspent categories (never carried forward), and budgets worth raising. */
export function OverspendReview({ monthLabel, overspent, suggestions, current, apply }: OverspendReviewProps) {
  // The suggestions as first shown: once one is applied the refreshed page stops suggesting it,
  // but its confirmation stays for this visit.
  const [shown] = useState(suggestions);
  return (
    <div className="flex flex-col gap-4">
      <Card as="section" className="flex flex-col gap-3">
        <h2 id="overspent-title" className="text-title font-semibold text-text">
          Over budget
        </h2>
        {overspent.length === 0 ? (
          <p className="text-body text-muted">Nothing went over budget in {monthLabel}.</p>
        ) : (
          <>
            <ul aria-label={`Over budget in ${monthLabel}`} className="flex flex-col divide-y divide-border">
              {overspent.map((o) => (
                <li key={o.categoryId} className="flex items-center justify-between gap-3 py-3 text-body">
                  <span className="min-w-0 truncate text-text">{o.name}</span>
                  <span className="flex items-baseline gap-1 text-danger-fg">
                    <Money pence={o.overPence} tone="neutral" />
                    <span className="text-caption">over</span>
                  </span>
                </li>
              ))}
            </ul>
            <p className="text-caption text-muted">Overspending isn&apos;t carried forward.</p>
          </>
        )}
      </Card>

      {shown.length > 0 ? (
        <Card as="section" className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <h2 id="raise-title" className="text-title font-semibold text-text">
              Raise a budget?
            </h2>
            <p className="text-caption text-muted">
              {shown.length === 1 ? "This category" : "These categories"} went over in two of your last three budgets.
            </p>
          </div>
          {shown.map((s) => (
            <RaiseRow key={s.categoryId} suggestion={s} current={current} apply={apply} />
          ))}
        </Card>
      ) : null}
    </div>
  );
}

function RaiseRow({
  suggestion,
  current,
  apply,
}: {
  suggestion: RaiseSuggestion;
  current: CurrentFigures;
  apply: OverspendReviewProps["apply"];
}) {
  const [text, setText] = useState(() => penceToInputText(suggestion.suggestedPence));
  const [applied, setApplied] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const pence = parsePence(text);

  const allocationsWith = (amountPence: number) => {
    const others = current.allocations.filter((a) => a.categoryId !== suggestion.categoryId);
    return [...others, { kind: suggestion.kind, amountPence }];
  };
  const before = allocationTotals(current.incomePence, current.savingsPence, current.allocations);
  const after = pence === null ? null : allocationTotals(current.incomePence, current.savingsPence, allocationsWith(pence));

  async function onApply() {
    if (pence === null) return;
    setBusy(true);
    setError(null);
    try {
      const result = await apply(suggestion.categoryId, pence);
      if (result?.error) setError(result.error);
      else setApplied(pence);
    } finally {
      setBusy(false);
    }
  }

  if (applied !== null) {
    return (
      <div role="status">
        <Notice tone="neutral">
          <p>
            {suggestion.name} is now {formatGBP(applied)} from this budget on.
          </p>
        </Notice>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-md border border-border p-4">
      <AmountInput
        label={`New ${suggestion.name} budget`}
        value={text}
        onChange={(t) => {
          setText(t);
          setError(null);
        }}
        hint={`Now ${formatGBP(suggestion.currentPence)}. Suggested from your average spending.`}
      />
      {after ? (
        after.overAllocatedPence > 0 ? (
          <p className="text-caption text-danger-fg">
            Your budget would be over-allocated by <Money pence={after.overAllocatedPence} tone="neutral" />
          </p>
        ) : (
          <p className="text-caption text-muted">
            Unallocated money: <Money pence={before.unallocatedPence} tone="neutral" /> →{" "}
            <Money pence={after.unallocatedPence} tone="neutral" />
          </p>
        )
      ) : null}
      {error ? (
        <div role="alert">
          <Notice tone="danger">{error}</Notice>
        </div>
      ) : null}
      <Button variant="secondary" onClick={onApply} disabled={busy || pence === null}>
        {busy ? "Saving…" : `Raise ${suggestion.name} to ${pence === null ? "…" : formatGBP(pence)}`}
      </Button>
      <p className="text-caption text-muted">Applies from this budget on. Past budgets don&apos;t change.</p>
    </div>
  );
}

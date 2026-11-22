"use client";

import { useI18n } from "@/i18n/client";
import { useState } from "react";
import { AmountInput, Button, Card, Money, Notice } from "@/components/ui";
import { allocationTotals } from "@/lib/calc";
import type { CurrentFigures, Overspend, RaiseSuggestion } from "@/lib/data/review";

type OverspendReviewProps = {
  monthLabel: string;
  /** The budgets a raise changes: the current one, and the next when it is already planned. */
  raiseApplies: { currentLabel: string; nextLabel: string | null };
  overspent: Overspend[];
  suggestions: RaiseSuggestion[];
  /** The current budget's figures, for each raise's effect on the total. */
  current: CurrentFigures;
  /** Raises a category's budget from the current period on. Resolves with an error to show, if any. */
  apply: (categoryId: string, amountPence: number) => Promise<{ error?: string }>;
};

/** The ended period's overspent categories (category budgets never carry; the period's whole result is settled in the review), and budgets worth raising. */
export function OverspendReview({ monthLabel, raiseApplies, overspent, suggestions, current, apply }: OverspendReviewProps) {
  // The suggestions as first shown: once one is applied the refreshed page stops suggesting it,
  // but its confirmation stays for this visit.
  const { m } = useI18n();
  const r = m.review;
  const [shown] = useState(suggestions);
  return (
    <div className="flex flex-col gap-4">
      <Card as="section" className="flex flex-col gap-3">
        <h2 id="overspent-title" className="text-title font-semibold text-text">
          {r.overBudget}
        </h2>
        {overspent.length === 0 ? (
          <p className="text-body text-muted">{r.nothingOver(monthLabel)}</p>
        ) : (
          <>
            <ul aria-label={r.overIn(monthLabel)} className="flex flex-col divide-y divide-border">
              {overspent.map((o) => (
                <li key={o.categoryId} className="flex items-center justify-between gap-3 py-3 text-body">
                  <span className="min-w-0 truncate text-text">{o.name}</span>
                  <span className="flex items-baseline gap-1 text-danger-fg">
                    <Money pence={o.overPence} tone="neutral" />
                    <span className="text-caption">{r.over}</span>
                  </span>
                </li>
              ))}
            </ul>
            <p className="text-caption text-muted">{r.freshEachMonth}</p>
          </>
        )}
      </Card>

      {shown.length > 0 ? (
        <Card as="section" className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <h2 id="raise-title" className="text-title font-semibold text-text">
              {r.raiseTitle}
            </h2>
            <p className="text-caption text-muted">
              {r.raiseBody(shown.length)}
            </p>
          </div>
          {shown.map((s) => (
            <RaiseRow key={s.categoryId} suggestion={s} current={current} applies={raiseApplies} apply={apply} />
          ))}
        </Card>
      ) : null}
    </div>
  );
}

function RaiseRow({
  suggestion,
  current,
  applies,
  apply,
}: {
  suggestion: RaiseSuggestion;
  current: CurrentFigures;
  applies: OverspendReviewProps["raiseApplies"];
  apply: OverspendReviewProps["apply"];
}) {
  const { fmt, m } = useI18n();
  const r = m.review;
  const [text, setText] = useState(() => fmt.inputText(suggestion.suggestedPence));
  const [applied, setApplied] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const pence = fmt.parse(text);

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
            {r.raised(suggestion.name, fmt.money(applied))}
          </p>
        </Notice>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-md border border-border p-4">
      <AmountInput
        label={r.newBudget(suggestion.name)}
        value={text}
        onChange={(t) => {
          setText(t);
          setError(null);
        }}
        hint={r.nowSuggested(fmt.money(suggestion.currentPence))}
      />
      {after ? (
        after.overAllocatedPence > 0 ? (
          <p className="text-caption text-danger-fg">
            {r.wouldBeOver(fmt.money(after.overAllocatedPence))}
          </p>
        ) : (
          <p className="text-caption text-muted">
            {r.unallocated(fmt.money(before.unallocatedPence), fmt.money(after.unallocatedPence))}
          </p>
        )
      ) : null}
      {error ? (
        <div role="alert">
          <Notice tone="danger">{error}</Notice>
        </div>
      ) : null}
      <Button variant="secondary" onClick={onApply} disabled={busy || pence === null}>
        {busy ? m.common.saving : r.raiseTo(suggestion.name, pence === null ? "…" : fmt.money(pence))}
      </Button>
      <p className="text-caption text-muted">
        {applies.nextLabel
          ? r.appliesWithNext(applies.currentLabel, applies.nextLabel)
          : r.appliesFrom(applies.currentLabel)}
      </p>
    </div>
  );
}

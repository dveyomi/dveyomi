"use client";

import { AddCategoryForm, AllocationRows, AllocationSummary, kindTabs } from "@/components/AllocationEditor";
import { Card, SegmentedTabs } from "@/components/ui";
import { allocationTotals } from "@/lib/calc";
import { useI18n } from "@/i18n/client";
import { livePence, type CategoryDraft } from "./draft";
import { StepHeading } from "./StepHeading";

type Kind = CategoryDraft["kind"];

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
  const { currency, m } = useI18n();
  const totals = allocationTotals(
    incomePence,
    savingsPence,
    categories.map((c) => ({ kind: c.kind, amountPence: livePence(c.amountText, currency) })),
  );

  return (
    <section aria-labelledby="step-heading" className="flex flex-col gap-6">
      <StepHeading
        title={m.onboarding.spendingTitle}
        body={m.onboarding.spendingBody}
      />

      <AllocationSummary
        totals={totals}
        caption={savingsEntered ? undefined : m.onboarding.beforeSavings}
        hasCategories={categories.length > 0}
      />

      <SegmentedTabs label={m.allocation.categoryType} options={kindTabs(m)} value={tab} onChange={onTab} />

      <Card className="flex flex-col gap-4">
        <AllocationRows
          kind={tab}
          rows={categories.filter((c) => c.kind === tab).map((c) => ({ key: c.id, name: c.name, amountText: c.amountText }))}
          onAmount={(key, text) => onAmount(key as number, text)}
          onRemove={(key) => onRemove(key as number)}
        />
        <AddCategoryForm
          key={tab}
          kind={tab}
          taken={categories.map((c) => c.name)}
          onAdd={(name, amountText) => onAdd(name, tab, amountText)}
        />
      </Card>
    </section>
  );
}

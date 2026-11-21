"use client";

import { AddCategoryForm, AllocationRows, AllocationSummary, KIND_TABS } from "@/components/AllocationEditor";
import { Card, SegmentedTabs } from "@/components/ui";
import { allocationTotals } from "@/lib/calc";
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
  const totals = allocationTotals(
    incomePence,
    savingsPence,
    categories.map((c) => ({ kind: c.kind, amountPence: livePence(c.amountText) })),
  );

  return (
    <section aria-labelledby="step-heading" className="flex flex-col gap-6">
      <StepHeading
        title="Your spending budget"
        body="Give each category an amount. Needs are the bills and essentials; wants are everything else."
      />

      <AllocationSummary
        totals={totals}
        caption={savingsEntered ? undefined : "Before savings"}
        hasCategories={categories.length > 0}
      />

      <SegmentedTabs label="Category type" options={KIND_TABS} value={tab} onChange={onTab} />

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

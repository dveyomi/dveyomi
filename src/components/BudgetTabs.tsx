"use client";

import { useI18n } from "@/i18n/client";
import { useState, type ReactNode } from "react";
import { SegmentedTabs } from "@/components/ui";

export type BudgetTab = "spending" | "saving";


type BudgetTabsProps = { initial: BudgetTab; spending: ReactNode; saving: ReactNode };

/** Spending | Saving. The tab lives in `?tab=saving` so it can be linked to. */
export function BudgetTabs({ initial, spending, saving }: BudgetTabsProps) {
  const { m } = useI18n();
  const options = [
    { value: "spending" as const, label: m.budget.tabs.spending },
    { value: "saving" as const, label: m.budget.tabs.saving },
  ];
  const [tab, setTab] = useState(initial);

  function change(next: BudgetTab) {
    setTab(next);
    const url = new URL(window.location.href);
    if (next === "saving") url.searchParams.set("tab", "saving");
    else url.searchParams.delete("tab");
    // Next.js keeps its router in sync with history.replaceState; no server round trip.
    window.history.replaceState(null, "", url);
  }

  return (
    <div className="flex flex-col gap-4">
      <SegmentedTabs label={m.budget.view} options={options} value={tab} onChange={change} />
      <div role="tabpanel" aria-label={m.budget.tabs[tab]}>
        {tab === "saving" ? saving : spending}
      </div>
    </div>
  );
}

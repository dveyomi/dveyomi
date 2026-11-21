"use client";

import { useState, type ReactNode } from "react";
import { SegmentedTabs } from "@/components/ui";

export type BudgetTab = "spending" | "saving";

const options = [
  { value: "spending" as const, label: "Spending" },
  { value: "saving" as const, label: "Saving" },
];

type BudgetTabsProps = { initial: BudgetTab; spending: ReactNode; saving: ReactNode };

/** Spending | Saving. The tab lives in `?tab=saving` so it can be linked to. */
export function BudgetTabs({ initial, spending, saving }: BudgetTabsProps) {
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
      <SegmentedTabs label="Budget view" options={options} value={tab} onChange={change} />
      <div role="tabpanel" aria-label={tab === "saving" ? "Saving" : "Spending"}>
        {tab === "saving" ? saving : spending}
      </div>
    </div>
  );
}

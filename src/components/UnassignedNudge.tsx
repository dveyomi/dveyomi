"use client";

import { useI18n } from "@/i18n/client";
import { useState } from "react";
import { dismissNudgeAction } from "@/app/(app)/review/actions";
import { ButtonLink, Card, IconButton } from "@/components/ui";

/**
 * "Give every pound a job": shown on the Budget tab after a leftover was kept
 * unassigned, until dismissed here or the budget is edited. The money stays
 * spendable (§5.5); this only suggests giving it a category or a fund.
 */
export function UnassignedNudge({ amountPence }: { amountPence: number }) {
  const { m, fmt, currency } = useI18n();
  const b = m.budget;
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  async function dismiss() {
    setDismissed(true);
    // The button is about to go: keep keyboard and screen-reader users on the page's heading.
    document.getElementById("budget-heading")?.focus();
    try {
      await dismissNudgeAction();
    } catch (e) {
      console.error("dismissNudge failed", e);
    }
  }

  return (
    <section aria-labelledby="nudge-title">
      <Card className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h2 id="nudge-title" className="text-body font-semibold text-text">
              {b.nudgeTitle[currency]}
            </h2>
            <p className="text-caption text-muted">
              {b.nudgeBody(fmt.money(amountPence))}
            </p>
          </div>
          <IconButton icon="close" label={b.dismiss} onClick={dismiss} />
        </div>
        <div className="flex flex-wrap gap-2">
          <ButtonLink href="/budget/edit" variant="secondary" icon="edit">
            {b.editBudget}
          </ButtonLink>
          <ButtonLink href="/budget?tab=saving" variant="secondary" icon="savings">
            {b.addToFund}
          </ButtonLink>
        </div>
      </Card>
    </section>
  );
}

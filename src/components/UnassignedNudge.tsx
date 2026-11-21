"use client";

import { useState } from "react";
import { dismissNudgeAction } from "@/app/(app)/review/actions";
import { ButtonLink, Card, IconButton, Money } from "@/components/ui";

/**
 * "Give every pound a job": shown on the Budget tab after a leftover was kept
 * unassigned, until dismissed here or the budget is edited. The money stays
 * spendable (§5.5); this only suggests giving it a category or a fund.
 */
export function UnassignedNudge({ amountPence }: { amountPence: number }) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  async function dismiss() {
    setDismissed(true);
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
              Give every pound a job
            </h2>
            <p className="text-caption text-muted">
              <Money pence={amountPence} tone="neutral" /> of this budget isn&apos;t assigned to anything. You can still spend it,
              but giving it a category or a fund helps you plan.
            </p>
          </div>
          <IconButton icon="close" label="Dismiss" onClick={dismiss} />
        </div>
        <div className="flex flex-wrap gap-2">
          <ButtonLink href="/budget/edit" variant="secondary" icon="edit">
            Edit budget
          </ButtonLink>
          <ButtonLink href="/budget?tab=saving" variant="secondary" icon="savings">
            Add to a fund
          </ButtonLink>
        </div>
      </Card>
    </section>
  );
}

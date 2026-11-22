"use client";

import { useI18n } from "@/i18n/client";
import type { ReactNode } from "react";
import { Card, Money } from "@/components/ui";
import { allocationTotals, periodContaining, type IsoDate } from "@/lib/calc";
import type { OnboardingInput } from "@/lib/data/onboarding";
import { StepHeading } from "./StepHeading";

/** Step 4: a short summary of the budget about to go live. */
export function Live({ input, today }: { input: OnboardingInput; today: IsoDate }) {
  const { fmt, m } = useI18n();
  const o = m.onboarding;
  const totals = allocationTotals(input.incomePence, input.savingsPence, input.categories);
  const nextOn = fmt.weekdayDate(periodContaining(today, input.startDay).nextStart);

  return (
    <section aria-labelledby="step-heading" className="flex flex-col gap-6">
      <StepHeading title={o.liveTitle} body={o.liveBody(o.resets(input.startDay), nextOn)} />

      <Card>
        <dl className="flex flex-col divide-y divide-border">
          <Row label={o.monthlyIncome} value={<Money pence={input.incomePence} />} />
          <Row label={o.payYourselfFirst} value={<Money pence={input.savingsPence} />} />
          <Row label={o.toSpendEachMonth} value={<Money pence={totals.poolPence} />} strong />
          <Row label={m.kinds.plural.need} value={<Money pence={totals.needsPence} />} />
          <Row label={m.kinds.plural.want} value={<Money pence={totals.wantsPence} />} />
          {totals.overAllocatedPence > 0 ? (
            <Row label={o.overAllocated} value={<span className="text-danger-fg">{fmt.money(totals.overAllocatedPence)}</span>} />
          ) : (
            <Row label={o.leftToAllocate} value={<Money pence={totals.unallocatedPence} />} />
          )}
        </dl>
      </Card>

      {input.funds.length > 0 ? (
        <Card>
          <h2 className="text-body font-semibold text-text">{o.funds}</h2>
          <dl className="mt-2 flex flex-col divide-y divide-border">
            {input.funds.map((f) => (
              <Row
                key={f.name}
                label={f.name}
                sub={f.alreadySavedPence > 0 ? o.alreadySavedAmount(fmt.money(f.alreadySavedPence)) : undefined}
                value={input.savingsPence > 0 ? <span><Money pence={f.amountPence} /> {o.aMonth}</span> : null}
              />
            ))}
          </dl>
        </Card>
      ) : null}
    </section>
  );
}

function Row({ label, sub, value, strong }: { label: string; sub?: string; value: ReactNode; strong?: boolean }) {
  return (
    <div className="flex min-h-12 items-center justify-between gap-4 py-3">
      <dt className="flex flex-col">
        <span className={`text-body ${strong ? "font-semibold text-text" : "text-muted"}`}>{label}</span>
        {sub ? <span className="text-caption text-muted">{sub}</span> : null}
      </dt>
      <dd className={`text-body tabular-nums ${strong ? "font-semibold text-accent-fg" : "text-text"}`}>{value}</dd>
    </div>
  );
}

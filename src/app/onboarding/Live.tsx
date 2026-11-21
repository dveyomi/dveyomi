import type { ReactNode } from "react";
import { Card, Money } from "@/components/ui";
import { allocationTotals, formatGBP, formatWeekdayDate, periodContaining, startDayLabel, type IsoDate } from "@/lib/calc";
import type { OnboardingInput } from "@/lib/data/onboarding";
import { StepHeading } from "./StepHeading";

/** Step 4: a short summary of the budget about to go live. */
export function Live({ input, today }: { input: OnboardingInput; today: IsoDate }) {
  const totals = allocationTotals(input.incomePence, input.savingsPence, input.categories);
  const nextOn = formatWeekdayDate(periodContaining(today, input.startDay).nextStart);
  const resets = input.startDay === 1 ? "on the first day of each month" : `on the ${startDayLabel(input.startDay)} of each month`;

  return (
    <section aria-labelledby="step-heading" className="flex flex-col gap-6">
      <StepHeading title="You're live" body={`Your budget resets ${resets}, next on ${nextOn}. You can change any of this later.`} />

      <Card>
        <dl className="flex flex-col divide-y divide-border">
          <Row label="Monthly income" value={<Money pence={input.incomePence} />} />
          <Row label="Pay yourself first" value={<Money pence={input.savingsPence} />} />
          <Row label="To spend each month" value={<Money pence={totals.poolPence} />} strong />
          <Row label="Needs" value={<Money pence={totals.needsPence} />} />
          <Row label="Wants" value={<Money pence={totals.wantsPence} />} />
          {totals.overAllocatedPence > 0 ? (
            <Row label="Over allocated" value={<span className="text-danger-fg">{formatGBP(totals.overAllocatedPence)}</span>} />
          ) : (
            <Row label="Left to allocate" value={<Money pence={totals.unallocatedPence} />} />
          )}
        </dl>
      </Card>

      {input.funds.length > 0 ? (
        <Card>
          <h2 className="text-body font-semibold text-text">Savings funds</h2>
          <dl className="mt-2 flex flex-col divide-y divide-border">
            {input.funds.map((f) => (
              <Row
                key={f.name}
                label={f.name}
                sub={f.alreadySavedPence > 0 ? `${formatGBP(f.alreadySavedPence)} already saved` : undefined}
                value={input.savingsPence > 0 ? <span><Money pence={f.amountPence} /> a month</span> : null}
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

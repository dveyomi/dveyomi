"use client";

import { AmountInput, Card, Select } from "@/components/ui";
import { useI18n } from "@/i18n/client";
import { periodContaining, type IsoDate } from "@/lib/calc";
import { StepHeading } from "./StepHeading";


type IncomeProps = {
  today: IsoDate;
  startDay: number;
  onStartDay: (day: number) => void;
  incomeText: string;
  onIncome: (text: string) => void;
  incomeError: string | null;
};

/** Step 1: the budget period (fixed to monthly), its start day and the monthly income. */
export function Income({ today, startDay, onStartDay, incomeText, onIncome, incomeError }: IncomeProps) {
  const { m, fmt } = useI18n();
  const o = m.onboarding;
  const dayOptions = Array.from({ length: 31 }, (_, i) => ({ value: String(i + 1), label: m.dates.startDay(i + 1) }));
  const nextOn = fmt.weekdayDate(periodContaining(today, startDay).nextStart);
  return (
    <section aria-labelledby="step-heading" className="flex flex-col gap-6">
      <StepHeading
        title={o.basicsTitle}
        body={o.basicsBody}
      />
      <Card className="flex flex-col gap-5">
        <dl className="flex flex-col gap-2">
          <dt className="text-caption font-medium text-muted">{o.budgetPeriod}</dt>
          <dd className="text-body text-text">{o.monthly}</dd>
        </dl>
        <div className="flex flex-col gap-2">
          <Select
            label={o.startingOn}
            options={dayOptions}
            value={String(startDay)}
            onChange={(e) => onStartDay(Number(e.target.value))}
          />
          <p aria-live="polite" className="text-caption text-muted">
            {o.nextOn(nextOn)}
          </p>
        </div>
      </Card>
      <Card>
        <AmountInput
          label={o.monthlyIncome}
          value={incomeText}
          onChange={onIncome}
          hint={o.incomeHint}
          error={incomeError}
        />
      </Card>
    </section>
  );
}

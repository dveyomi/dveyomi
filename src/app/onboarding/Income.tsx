"use client";

import { AmountInput, Card, Select } from "@/components/ui";
import { formatWeekdayDate, periodContaining, startDayLabel, type IsoDate } from "@/lib/calc";
import { StepHeading } from "./StepHeading";

const dayOptions = Array.from({ length: 31 }, (_, i) => ({ value: String(i + 1), label: startDayLabel(i + 1) }));

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
  const nextOn = formatWeekdayDate(periodContaining(today, startDay).nextStart);
  return (
    <section aria-labelledby="step-heading" className="flex flex-col gap-6">
      <StepHeading
        title="Start with the basics"
        body="We recommend using the same budget period as your regular income."
      />
      <Card className="flex flex-col gap-5">
        <dl className="flex flex-col gap-2">
          <dt className="text-caption font-medium text-muted">Budget period</dt>
          <dd className="text-body text-text">Monthly</dd>
        </dl>
        <div className="flex flex-col gap-2">
          <Select
            label="Starting on"
            options={dayOptions}
            value={String(startDay)}
            onChange={(e) => onStartDay(Number(e.target.value))}
          />
          <p aria-live="polite" className="text-caption text-muted">
            so budget next on {nextOn}
          </p>
        </div>
      </Card>
      <Card>
        <AmountInput
          label="Monthly income"
          value={incomeText}
          onChange={onIncome}
          hint="What reaches your account each month, after tax."
          error={incomeError}
        />
      </Card>
    </section>
  );
}

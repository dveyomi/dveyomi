"use client";

import { Select, Toggle } from "@/components/ui";
import type { Frequency } from "@/lib/calc";
import { FREQUENCIES } from "@/lib/validation/expense";

/** How each frequency reads to people. */
export const FREQUENCY_LABELS: Record<Frequency, string> = {
  weekly: "Weekly",
  fortnightly: "Every 2 weeks",
  monthly: "Monthly",
  quarterly: "Every 3 months",
  annually: "Yearly",
};

type RepeatFieldsProps = {
  /** How often it repeats, or null when Repeat is off. */
  value: Frequency | null;
  onChange: (value: Frequency | null) => void;
};

/**
 * The Add expense form's Repeat switch (off by default). On, it asks how
 * often (monthly to start with); saving then makes the expense the first
 * payment of a recurring payment that is added automatically from then on.
 */
export function RepeatFields({ value, onChange }: RepeatFieldsProps) {
  return (
    <div className="flex flex-col gap-3">
      <Toggle
        label="Repeat"
        description="Add it again automatically, e.g. a subscription."
        checked={value !== null}
        onChange={(on) => onChange(on ? "monthly" : null)}
      />
      {value !== null ? (
        <Select
          label="How often"
          value={value}
          onChange={(e) => onChange(e.target.value as Frequency)}
          options={FREQUENCIES.map((f) => ({ value: f, label: FREQUENCY_LABELS[f] }))}
        />
      ) : null}
    </div>
  );
}

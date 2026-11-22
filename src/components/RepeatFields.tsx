"use client";

import { useI18n } from "@/i18n/client";
import { Select, Toggle } from "@/components/ui";
import type { Frequency } from "@/lib/calc";
import { FREQUENCIES } from "@/lib/validation/expense";

/** How each frequency reads to people. */

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
  const { m } = useI18n();
  return (
    <div className="flex flex-col gap-3">
      <Toggle
        label={m.repeat.label}
        description={m.repeat.description}
        checked={value !== null}
        onChange={(on) => onChange(on ? "monthly" : null)}
      />
      {value !== null ? (
        <Select
          label={m.repeat.howOften}
          value={value}
          onChange={(e) => onChange(e.target.value as Frequency)}
          options={FREQUENCIES.map((f) => ({ value: f, label: m.repeat.frequency[f] }))}
        />
      ) : null}
    </div>
  );
}

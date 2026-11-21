"use client";

import { useId, type SelectHTMLAttributes } from "react";
import { borderFor, controlBox, describedBy, FieldShell } from "./field";
import { Icon } from "./Icon";

export type SelectOption = { value: string; label: string };
export type SelectGroup = { label: string; options: SelectOption[] };

type SelectProps = Omit<
  SelectHTMLAttributes<HTMLSelectElement>,
  "style" | "className" | "id" | "children"
> & {
  label: string;
  options: SelectOption[];
  /** Labelled groups of options (e.g. Needs, Wants), listed before `options`; empty groups are left out. */
  groups?: SelectGroup[];
  /** Shown as a disabled first option when nothing is chosen yet. */
  placeholder?: string;
  hint?: string;
  error?: string | null;
};

export function Select({ label, options, groups = [], placeholder, hint, error, ...rest }: SelectProps) {
  const id = useId();
  return (
    <FieldShell id={id} label={label} hint={hint} error={error}>
      <div className="relative">
        <select
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(id, hint, error)}
          className={`h-12 appearance-none pr-10 ${controlBox} ${borderFor(error)}`}
          {...rest}
        >
          {placeholder ? (
            <option value="" disabled>
              {placeholder}
            </option>
          ) : null}
          {groups
            .filter((g) => g.options.length > 0)
            .map((g) => (
              <optgroup key={g.label} label={g.label}>
                {g.options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </optgroup>
            ))}
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-muted">
          <Icon name="chevron-down" size="sm" />
        </span>
      </div>
    </FieldShell>
  );
}

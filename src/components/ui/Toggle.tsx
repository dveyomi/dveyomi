"use client";

import { useId } from "react";
import { focusRing } from "./focus";

type ToggleProps = {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  description?: string;
  disabled?: boolean;
};

/** A switch whose whole row (at least 44px tall) is the tap target. */
export function Toggle({ label, checked, onChange, description, disabled }: ToggleProps) {
  const id = useId();
  return (
    <label
      className={`flex min-h-11 items-center justify-between gap-4 ${disabled ? "cursor-not-allowed opacity-40" : "cursor-pointer"}`}
    >
      <span className="flex flex-col">
        <span id={`${id}-label`} className="text-body text-text">
          {label}
        </span>
        {description ? (
          <span id={`${id}-description`} className="text-caption text-muted">
            {description}
          </span>
        ) : null}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={`${id}-label`}
        aria-describedby={description ? `${id}-description` : undefined}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-pill p-0.5 transition-colors ${focusRing} ${checked ? "bg-accent" : "bg-border-strong"}`}
      >
        <span
          aria-hidden="true"
          className={`size-6 rounded-pill transition-transform ${checked ? "translate-x-5 bg-accent-ink" : "translate-x-0 bg-text"}`}
        />
      </button>
    </label>
  );
}

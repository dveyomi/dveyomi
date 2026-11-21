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

export function Toggle({ label, checked, onChange, description, disabled }: ToggleProps) {
  const id = useId();
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex flex-col">
        <span id={`${id}-label`} className="text-body text-text">
          {label}
        </span>
        {description ? <span className="text-caption text-muted">{description}</span> : null}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={`${id}-label`}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-pill p-0.5 transition-colors disabled:opacity-40 ${focusRing} ${checked ? "bg-accent" : "bg-border"}`}
      >
        <span
          aria-hidden="true"
          className={`size-6 rounded-pill transition-transform ${checked ? "translate-x-5 bg-accent-ink" : "translate-x-0 bg-text"}`}
        />
      </button>
    </div>
  );
}

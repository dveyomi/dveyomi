"use client";

import type { ReactNode } from "react";
import { Icon } from "./Icon";

type CheckboxProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** The checkbox's name, and the rest of the row it ticks (at least 44px tall). */
  children: ReactNode;
  disabled?: boolean;
};

/**
 * Tick one item in a list: a native checkbox (Space toggles it, forms read it)
 * drawn as a rounded box with a check, and its whole row as the tap target.
 * The ticked box is an --accent fill with an --accent-fg edge, like Toggle.
 * Focus scrolls it clear of a sticky header or footer (scroll margin).
 */
export function Checkbox({ checked, onChange, children, disabled }: CheckboxProps) {
  return (
    <label
      className={`flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-sm has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-accent-fg ${disabled ? "cursor-not-allowed opacity-40" : "cursor-pointer"}`}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="sr-only scroll-my-32"
      />
      <span
        aria-hidden="true"
        className={`flex size-6 shrink-0 items-center justify-center rounded-sm border-2 transition-colors ${checked ? "border-accent-fg bg-accent text-accent-ink" : "border-border-strong"}`}
      >
        {checked ? <Icon name="check" size="sm" /> : null}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">{children}</span>
    </label>
  );
}

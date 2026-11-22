"use client";

import { useI18n } from "@/i18n/client";
import { drawnPercent } from "./percent";

type ProgressBarProps = {
  percent: number;
  /** "over" draws the bar full in danger, whatever the percent. */
  state: "normal" | "over";
  /** Accessible name, e.g. the category. */
  label: string;
  /** Layout only. */
  className?: string;
};

export function ProgressBar({ percent, state, label, className = "" }: ProgressBarProps) {
  const { m } = useI18n();
  const drawn = drawnPercent(percent, state);
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={drawn}
      aria-valuetext={state === "over" ? m.ui.overBudget : undefined}
      className={`h-2 w-full overflow-hidden rounded-pill bg-card-raised ${className}`}
    >
      <div
        className={`h-full rounded-pill transition-[width] duration-300 ${state === "over" ? "bg-danger-fg" : "bg-accent-fg"}`}
        style={{ width: `${drawn}%` }}
      />
    </div>
  );
}

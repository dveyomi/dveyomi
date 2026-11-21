import type { ReactNode } from "react";
import { drawnPercent } from "./percent";

/** A 270° arc (centre 50,50, radius 35) opening at the bottom; the centre holds the headline figure. */
const ARC = "M 25.25 74.75 A 35 35 0 1 1 74.75 74.75";

type GaugeProps = {
  percent: number;
  /** "over" draws the arc full in danger, whatever the percent. */
  state: "normal" | "over";
  /** Accessible name for the meter. */
  label: string;
  children?: ReactNode;
};

export function Gauge({ percent, state, label, children }: GaugeProps) {
  const drawn = drawnPercent(percent, state);
  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={drawn}
      aria-valuetext={state === "over" ? "Over budget" : undefined}
      className="relative mx-auto aspect-[100/82] w-full max-w-72"
    >
      <svg viewBox="0 0 100 82" className="size-full" aria-hidden="true">
        <path d={ARC} fill="none" strokeWidth={7} strokeLinecap="round" className="stroke-card-raised" />
        {drawn > 0 ? (
          <path
            d={ARC}
            fill="none"
            strokeWidth={7}
            strokeLinecap="round"
            pathLength={100}
            strokeDasharray={`${drawn} 100`}
            className={state === "over" ? "stroke-danger-fg" : "stroke-accent-fg"}
          />
        ) : null}
      </svg>
      {/* pt-[18%] moves the content's centre down to the arc's centre (y=50 of 82). */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 pt-[18%] text-center">
        {children}
      </div>
    </div>
  );
}

"use client";

import { useRef, type KeyboardEvent } from "react";
import { focusRing } from "./focus";
import type { Segment } from "./SegmentedTabs";

type RadioSegmentsProps<T extends string> = {
  /** Accessible name for the group, e.g. "Theme". */
  label: string;
  options: Segment<T>[];
  value: T;
  onChange: (value: T) => void;
};

const STEP: Partial<Record<string, number>> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };

/**
 * Pick one of a few settings, shown as a segmented pill: a radiogroup with one
 * tab stop where the arrow keys (and Home / End) move and select. Works on bg and inside a Card.
 * For switching between views use SegmentedTabs. The checked option is a lime
 * fill with an --accent-fg edge: lime alone is under 3:1 against the light track.
 */
export function RadioSegments<T extends string>({ label, options, value, onChange }: RadioSegmentsProps<T>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  function onKeyDown(e: KeyboardEvent, index: number) {
    const step = STEP[e.key];
    const next =
      e.key === "Home" ? 0 : e.key === "End" ? options.length - 1 : step ? (index + step + options.length) % options.length : -1;
    if (next === -1) return;
    e.preventDefault();
    onChange(options[next].value);
    refs.current[next]?.focus();
  }

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="flex w-full gap-1 rounded-pill border border-border bg-bg p-1"
    >
      {options.map((o, i) => {
        const checked = o.value === value;
        return (
          <button
            key={o.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={checked ? 0 : -1}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={`min-h-11 flex-1 rounded-pill border px-2 text-caption font-semibold transition-colors ${focusRing} ${checked ? "border-accent-fg bg-accent text-accent-ink" : "border-transparent text-muted hover:text-text"}`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

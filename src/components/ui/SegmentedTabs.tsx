"use client";

import { useRef, type KeyboardEvent } from "react";
import { focusRing } from "./focus";

export type Segment<T extends string> = { value: T; label: string };

type SegmentedTabsProps<T extends string> = {
  /** Accessible name for the group, e.g. "Period". */
  label: string;
  options: Segment<T>[];
  value: T;
  onChange: (value: T) => void;
};

export function SegmentedTabs<T extends string>({
  label,
  options,
  value,
  onChange,
}: SegmentedTabsProps<T>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  function onKeyDown(e: KeyboardEvent, index: number) {
    const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = (index + step + options.length) % options.length;
    onChange(options[next].value);
    refs.current[next]?.focus();
  }

  return (
    <div role="tablist" aria-label={label} className="flex w-full gap-1 rounded-pill bg-card p-1">
      {options.map((o, i) => {
        const selected = o.value === value;
        return (
          <button
            key={o.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="tab"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={`h-9 flex-1 rounded-pill px-3 text-caption font-semibold transition-colors ${focusRing} ${selected ? "bg-card-raised text-text" : "text-muted hover:text-text"}`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

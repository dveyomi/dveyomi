"use client";

import { useId } from "react";

export type RadioCardOption<T extends string> = { value: T; title: string; description?: string };

type RadioCardsProps<T extends string> = {
  /** Accessible name for the group, e.g. "Where your leftover goes". */
  label: string;
  options: RadioCardOption<T>[];
  /** The checked option; null for none yet. */
  value: T | null;
  onChange: (value: T) => void;
};

/**
 * Pick one of a few choices that each need a line of explanation: a stack of
 * cards, each a native radio (so arrow keys and forms work as usual) with a
 * title and an optional description. The checked card has an --accent-fg
 * edge and a filled dot. For short settings use RadioSegments.
 */
export function RadioCards<T extends string>({ label, options, value, onChange }: RadioCardsProps<T>) {
  const id = useId();
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-col gap-3">
      {options.map((o) => {
        const checked = o.value === value;
        const titleId = `${id}-${o.value}-title`;
        const descriptionId = `${id}-${o.value}-description`;
        return (
          <label
            key={o.value}
            className={`flex min-h-11 cursor-pointer items-start gap-3 rounded-md border bg-card-raised p-4 transition-colors has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-accent-fg ${checked ? "border-accent-fg" : "border-border hover:border-border-strong"}`}
          >
            <input
              type="radio"
              name={id}
              value={o.value}
              checked={checked}
              onChange={() => onChange(o.value)}
              aria-labelledby={titleId}
              aria-describedby={o.description ? descriptionId : undefined}
              className="sr-only"
            />
            <span
              aria-hidden="true"
              className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-pill border-2 ${checked ? "border-accent-fg" : "border-border-strong"}`}
            >
              {checked ? <span className="size-2.5 rounded-pill bg-accent-fg" /> : null}
            </span>
            <span className="flex min-w-0 flex-col gap-1">
              <span id={titleId} className="text-body font-semibold text-text">
                {o.title}
              </span>
              {o.description ? (
                <span id={descriptionId} className="text-caption text-muted">
                  {o.description}
                </span>
              ) : null}
            </span>
          </label>
        );
      })}
    </div>
  );
}

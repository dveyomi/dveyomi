import type { ReactNode } from "react";

const tones = {
  neutral: "bg-card-raised text-muted",
  positive: "bg-positive/15 text-positive-fg",
  warning: "bg-warning/15 text-warning-fg",
  danger: "bg-danger/15 text-danger-fg",
} as const;

export type BadgeTone = keyof typeof tones;

export function Badge({ tone, children }: { tone: BadgeTone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-pill px-2.5 py-1 text-caption font-semibold ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

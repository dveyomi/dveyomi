import type { ReactNode } from "react";
import { Icon, type IconName } from "./Icon";

const tones = {
  danger: { className: "bg-danger/15 text-danger-fg", icon: "alert" },
  warning: { className: "bg-warning/15 text-warning-fg", icon: "alert" },
  neutral: { className: "bg-card-raised text-text", icon: "info" },
} as const satisfies Record<string, { className: string; icon: IconName }>;

/** A tinted callout for a state the user should notice, e.g. allocations over the total. */
export function Notice({ tone, children }: { tone: keyof typeof tones; children: ReactNode }) {
  const { className, icon } = tones[tone];
  return (
    <div data-tone={tone} className={`flex items-start gap-3 rounded-md p-4 text-body ${className}`}>
      <Icon name={icon} />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

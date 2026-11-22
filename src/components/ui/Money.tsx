"use client";

import { useI18n } from "@/i18n/client";
import type { CSSProperties } from "react";

const sizes = {
  inherit: "",
  display: "text-display font-semibold tracking-tight",
  title: "text-title font-semibold",
  body: "text-body",
  caption: "text-caption",
  /** Display size, made smaller for longer amounts so it fits the nearest `@container` (a Gauge's centre). */
  fit: "font-semibold tracking-tight leading-(--leading-display)",
} as const;

type MoneyProps = {
  pence: number;
  /** "auto" shows negatives in danger; "neutral" inherits the surrounding colour. */
  tone?: "auto" | "neutral";
  size?: keyof typeof sizes;
};

/** Display size, or less: the container's width shared between the characters, at 0.55em each (a little over a tabular digit). */
const fitTo = (text: string): CSSProperties => ({
  fontSize: `min(var(--text-display), calc(100cqi / ${(text.length * 0.55).toFixed(2)}))`,
});

export function Money({ pence, tone = "auto", size = "inherit" }: MoneyProps) {
  const { fmt } = useI18n();
  const danger = tone === "auto" && pence < 0;
  const text = fmt.money(pence);
  return (
    <span
      className={`tabular-nums whitespace-nowrap ${sizes[size]} ${danger ? "text-danger-fg" : ""}`}
      style={size === "fit" ? fitTo(text) : undefined}
    >
      {text}
    </span>
  );
}

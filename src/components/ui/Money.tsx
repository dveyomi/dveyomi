import { formatGBP } from "@/lib/calc";

const sizes = {
  inherit: "",
  display: "text-display font-semibold tracking-tight",
  title: "text-title font-semibold",
  body: "text-body",
  caption: "text-caption",
} as const;

type MoneyProps = {
  pence: number;
  /** "auto" shows negatives in danger; "neutral" inherits the surrounding colour. */
  tone?: "auto" | "neutral";
  size?: keyof typeof sizes;
};

export function Money({ pence, tone = "auto", size = "inherit" }: MoneyProps) {
  const danger = tone === "auto" && pence < 0;
  return (
    <span className={`tabular-nums ${sizes[size]} ${danger ? "text-danger-fg" : ""}`}>
      {formatGBP(pence)}
    </span>
  );
}

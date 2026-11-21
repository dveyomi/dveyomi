import type { ButtonHTMLAttributes } from "react";
import { focusRing } from "./focus";
import { Icon, type IconName } from "./Icon";

type IconButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "style" | "className" | "children" | "aria-label"
> & {
  icon: IconName;
  /** Accessible name; icon-only buttons must say what they do. */
  label: string;
  /** "primary": the screen's main action (e.g. save); "neutral" by default. */
  variant?: "neutral" | "primary";
};

const variants = {
  neutral: "bg-card-raised text-text hover:bg-border",
  primary: "bg-accent text-accent-ink hover:bg-accent/90",
} as const;

export function IconButton({ icon, label, variant = "neutral", type = "button", ...rest }: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={`inline-flex size-11 shrink-0 items-center justify-center rounded-pill transition-colors disabled:opacity-40 ${variants[variant]} ${focusRing}`}
      {...rest}
    >
      <Icon name={icon} />
    </button>
  );
}

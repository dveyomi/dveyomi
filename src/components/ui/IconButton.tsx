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
};

export function IconButton({ icon, label, type = "button", ...rest }: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={`inline-flex size-11 shrink-0 items-center justify-center rounded-pill bg-card-raised text-text transition-colors hover:bg-border disabled:opacity-40 ${focusRing}`}
      {...rest}
    >
      <Icon name={icon} />
    </button>
  );
}

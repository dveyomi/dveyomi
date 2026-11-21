import type { ButtonHTMLAttributes } from "react";
import { focusRing } from "./focus";

const variants = {
  primary: "bg-accent text-accent-ink hover:bg-accent/90",
  secondary: "bg-card-raised text-text hover:bg-border",
  danger: "bg-danger text-accent-ink hover:bg-danger/90",
  ghost: "bg-transparent text-text hover:bg-card-raised",
} as const;

const sizes = {
  md: "h-11 px-5 text-body",
  lg: "h-14 px-6 text-body",
} as const;

type ButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "style"> & {
  variant: keyof typeof variants;
  size?: keyof typeof sizes;
  fullWidth?: boolean;
};

export function Button({
  variant,
  size = "md",
  fullWidth = false,
  type = "button",
  className = "",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center gap-2 rounded-pill font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${focusRing} ${variants[variant]} ${sizes[size]} ${fullWidth ? "w-full" : ""} ${className}`}
      {...rest}
    />
  );
}

import Link from "next/link";
import type { ReactNode } from "react";
import { buttonClasses, type ButtonSize, type ButtonVariant } from "./Button";
import { Icon, type IconName } from "./Icon";

type ButtonLinkProps = {
  href: string;
  variant: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  /** Leading icon. */
  icon?: IconName;
  children: ReactNode;
  /** On phones (under the sm breakpoint) show only the icon, in a 44px square; the label stays for screen readers. Needs `icon`. */
  iconOnlyOnPhone?: boolean;
};

/** A link that looks like a Button, for actions that navigate. */
export function ButtonLink({ href, variant, size = "md", fullWidth = false, icon, children, iconOnlyOnPhone = false }: ButtonLinkProps) {
  return (
    <Link
      href={href}
      className={`${buttonClasses(variant, size, fullWidth)} ${iconOnlyOnPhone && icon ? "max-sm:size-11 max-sm:gap-0 max-sm:px-0" : ""}`}
    >
      {icon ? <Icon name={icon} /> : null}
      {iconOnlyOnPhone && icon ? <span className="max-sm:sr-only">{children}</span> : children}
    </Link>
  );
}

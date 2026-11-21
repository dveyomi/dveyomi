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
};

/** A link that looks like a Button, for actions that navigate. */
export function ButtonLink({ href, variant, size = "md", fullWidth = false, icon, children }: ButtonLinkProps) {
  return (
    <Link href={href} className={buttonClasses(variant, size, fullWidth)}>
      {icon ? <Icon name={icon} /> : null}
      {children}
    </Link>
  );
}

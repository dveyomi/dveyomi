import Link from "next/link";
import type { ReactNode } from "react";
import { focusRing } from "./focus";
import { Icon, type IconName } from "./Icon";

type ListRowProps = {
  title: ReactNode;
  subtitle?: ReactNode;
  icon?: IconName;
  /** Right-hand content, usually <Money /> or a <Badge />. */
  trailing?: ReactNode;
  /** Makes the row a link. */
  href?: string;
  /** Makes the row a button (ignored when href is set). */
  onClick?: () => void;
};

export function ListRow({ title, subtitle, icon, trailing, href, onClick }: ListRowProps) {
  const interactive = Boolean(href || onClick);
  const content = (
    <>
      {icon ? (
        <span className="flex size-10 shrink-0 items-center justify-center rounded-pill bg-card-raised text-text">
          <Icon name={icon} />
        </span>
      ) : null}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-body text-text">{title}</span>
        {subtitle ? <span className="truncate text-caption text-muted">{subtitle}</span> : null}
      </span>
      {trailing ? <span className="shrink-0 text-right text-body text-text">{trailing}</span> : null}
      {interactive ? (
        <span className="text-muted">
          <Icon name="chevron-right" size="sm" />
        </span>
      ) : null}
    </>
  );
  const row = `flex w-full items-center gap-3 rounded-sm px-2 py-3 text-left ${interactive ? `transition-colors hover:bg-card-raised ${focusRing}` : ""}`;

  if (href) {
    return (
      <Link href={href} className={row}>
        {content}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={row}>
        {content}
      </button>
    );
  }
  return <div className={row}>{content}</div>;
}

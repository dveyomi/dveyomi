import type { ReactNode } from "react";
import { Icon, type IconName } from "./Icon";

type EmptyStateProps = {
  title: string;
  body: string;
  /** Usually a <Button /> that starts the missing thing. */
  action?: ReactNode;
  icon?: IconName;
};

export function EmptyState({ title, body, action, icon = "info" }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
      <span className="flex size-12 items-center justify-center rounded-pill bg-card-raised text-muted">
        <Icon name={icon} size="lg" />
      </span>
      <h3 className="text-title font-semibold text-text">{title}</h3>
      <p className="max-w-xs text-body text-muted">{body}</p>
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

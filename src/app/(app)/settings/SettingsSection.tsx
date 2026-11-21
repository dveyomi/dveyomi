import type { ReactNode } from "react";
import { Card } from "@/components/ui";

/**
 * One Settings group: a card with a heading (and an optional line under it).
 * On a phone the heading sits above the controls; from 768px it moves to a
 * left column beside them, like a desktop preferences pane.
 */
export function SettingsSection({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <Card as="section" className="md:grid md:grid-cols-3 md:gap-8 md:p-6">
      <div className="mb-4 md:mb-0">
        <h2 className="text-body font-semibold text-text">
          {title}
        </h2>
        {description ? <p className="mt-1 text-body text-muted">{description}</p> : null}
      </div>
      <div className="md:col-span-2">{children}</div>
    </Card>
  );
}

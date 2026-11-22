"use client";

import { focusRing } from "@/components/ui/focus";
import { useI18n } from "@/i18n/client";

/** The first stop for keyboard users: jumps past the navigation to the page. */
export function SkipLink() {
  const { m } = useI18n();
  return (
    <a
      href="#main"
      className={`sr-only z-40 rounded-pill bg-accent font-semibold text-accent-ink focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:px-5 focus:py-3 ${focusRing}`}
    >
      {m.shell.skipToContent}
    </a>
  );
}

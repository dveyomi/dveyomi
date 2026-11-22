"use client";

import { useEffect } from "react";
import { Notice } from "@/components/ui";
import { useI18n } from "@/i18n/client";
import type { Messages } from "@/i18n/messages";

export type SavedNoticeKind = keyof Messages["notices"];

/**
 * A short confirmation after the editor or the ⋯ menu sends the user back to
 * /budget with ?saved=1, ?deleted=1 or (after the review) ?reviewed=1. The parameter is cleared from the
 * address once shown (history.replaceState, as BudgetTabs does: no server
 * round trip), so a reload does not confirm again.
 */
export function SavedNotice({ notice }: { notice?: SavedNoticeKind }) {
  const { m } = useI18n();
  useEffect(() => {
    if (!notice) return;
    const url = new URL(window.location.href);
    url.searchParams.delete("saved");
    url.searchParams.delete("deleted");
    url.searchParams.delete("reviewed");
    window.history.replaceState(window.history.state, "", url);
  }, [notice]);

  return (
    <div role="status">
      {notice ? (
        <Notice tone="neutral">
          <p>{m.notices[notice]}</p>
        </Notice>
      ) : null}
    </div>
  );
}

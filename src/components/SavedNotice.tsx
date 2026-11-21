"use client";

import { useEffect } from "react";
import { Notice } from "@/components/ui";

const messages = { saved: "Budget saved.", deleted: "Category deleted.", reviewed: "Review done." } as const;

export type SavedNoticeKind = keyof typeof messages;

/**
 * A short confirmation after the editor or the ⋯ menu sends the user back to
 * /budget with ?saved=1, ?deleted=1 or (after the review) ?reviewed=1. The parameter is cleared from the
 * address once shown (history.replaceState, as BudgetTabs does: no server
 * round trip), so a reload does not confirm again.
 */
export function SavedNotice({ notice }: { notice?: SavedNoticeKind }) {
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
          <p>{messages[notice]}</p>
        </Notice>
      ) : null}
    </div>
  );
}

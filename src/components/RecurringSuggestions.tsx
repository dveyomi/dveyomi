"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { acceptDetectionAction, dismissDetectionAction } from "@/app/(app)/expenses/recurring/actions";
import { Button, Card, Icon, Notice } from "@/components/ui";
import type { DetectionSuggestion } from "@/lib/data/recurring";
import { FREQUENCY_LABELS } from "./RepeatFields";

/**
 * Detection cards on the Expenses tab (§5.8): for each name paid three times
 * at an even interval with no recurring payment yet, "Is <name> a recurring
 * payment?" "Yes, repeat it" makes one from the latest payment and links the
 * three; "No" means it is never asked again.
 */
export function RecurringSuggestions({ suggestions }: { suggestions: DetectionSuggestion[] }) {
  const router = useRouter();
  const [answered, setAnswered] = useState<ReadonlySet<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  /** Announced politely once a card is answered, since it simply disappears. */
  const [status, setStatus] = useState("");
  const [busy, startBusy] = useTransition();
  const left = suggestions.filter((s) => !answered.has(s.nameKey));
  const live = (
    <p role="status" className="sr-only">
      {status}
    </p>
  );
  if (left.length === 0) return live;

  function answer(key: string, done: string, run: (key: string) => Promise<{ error?: string }>) {
    setError(null);
    startBusy(async () => {
      try {
        const result = await run(key);
        if (result.error) return setError(result.error);
      } catch {
        return setError("We couldn't save your answer. Check your connection and try again.");
      }
      setAnswered((a) => new Set(a).add(key));
      setStatus(done);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {live}
      {error ? (
        <div role="alert">
          <Notice tone="danger">{error}</Notice>
        </div>
      ) : null}
      {left.map((s) => (
        <Card key={s.nameKey} as="section" className="flex flex-col gap-4 md:flex-row md:items-center">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-pill bg-card-raised text-accent-fg">
              <Icon name="repeat" />
            </span>
            <div className="flex min-w-0 flex-col">
              <h2 className="text-body font-semibold text-text">Is {s.name} a recurring payment?</h2>
              <p className="text-caption text-muted">
                You paid it 3 times, {FREQUENCY_LABELS[s.frequency].toLowerCase()}. We can add it for you when it&rsquo;s due.
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <Button variant="secondary" disabled={busy} onClick={() => answer(s.nameKey, `We won’t ask about ${s.name} again`, dismissDetectionAction)}>
              No
            </Button>
            <Button variant="primary" disabled={busy} onClick={() => answer(s.nameKey, `${s.name} is now a recurring payment`, acceptDetectionAction)}>
              Yes, repeat it
            </Button>
          </div>
        </Card>
      ))}
    </div>
  );
}

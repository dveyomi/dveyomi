"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { Button, Card, Icon, IconButton } from "@/components/ui";
import { buttonClasses } from "@/components/ui/Button";
import type { IsoDate } from "@/lib/calc";
import { promptKey, suggestedTrip, tripPrompt, type CurrentTrip } from "@/lib/trips";

const STORAGE_PREFIX = "trip-prompt:";

/** Storage can be blocked (private windows, previews): the prompt then just shows until dismissed on this page. */
function wasDismissed(key: string): boolean {
  try {
    return window.localStorage.getItem(STORAGE_PREFIX + key) !== null;
  } catch {
    return false;
  }
}
function rememberDismissed(key: string) {
  try {
    window.localStorage.setItem(STORAGE_PREFIX + key, "1");
  } catch {
    // Not critical: it shows again next visit.
  }
}

type TripPromptProps = {
  /** The browser's IANA zone. Only zones are compared; the device's location is never asked for. */
  deviceZone: string;
  /** The profile's home zone. */
  homeZone: string;
  today: IsoDate;
  /** The trip whose dates include today, if any. */
  currentTrip: CurrentTrip | null;
  /** Ends `id` today (a server action). */
  endTrip: (id: string) => Promise<{ error?: string }>;
};

/**
 * "Are you travelling? Start a trip?" when the device zone differs from the
 * home zone and no trip covers today (once per zone), and "Back home? End
 * your trip?" when back in the home zone during a trip (once per trip).
 * Floats above the phone nav; bottom right on desktop.
 */
export function TripPrompt({ deviceZone, homeZone, today, currentTrip, endTrip }: TripPromptProps) {
  const router = useRouter();
  const headingId = useId();
  const [hidden, setHidden] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ending, startEnding] = useTransition();
  const state = tripPrompt({ deviceZone, homeZone, today, currentTrip, dismissed: wasDismissed });
  if (!state || hidden) return null;

  const key = promptKey(state);
  function dismiss() {
    rememberDismissed(key);
    setHidden(true);
  }
  function end(id: string) {
    startEnding(async () => {
      const result = await endTrip(id);
      if (result.error) return setError(result.error);
      dismiss();
      router.refresh();
    });
  }

  const suggestion = state.kind === "start" ? suggestedTrip(state.zone, today) : null;
  const newTripHref = suggestion
    ? `/expenses/trips/new?${new URLSearchParams({ place: suggestion.place, start: suggestion.start, end: suggestion.end })}`
    : "";

  return (
    <section
      aria-labelledby={headingId}
      className="fixed inset-x-4 bottom-nav-clearance z-20 mx-auto max-w-phone md:inset-x-auto md:right-8 md:bottom-8 md:w-96"
    >
      <div className="rounded-md shadow-float">
      <Card raised className="flex flex-col gap-3">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-pill bg-card text-accent-fg">
            <Icon name="plane" />
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <h2 id={headingId} className="text-body font-semibold text-text">
              {state.kind === "start" ? "Are you travelling?" : "Back home?"}
            </h2>
            <p className="text-caption text-muted">
              {state.kind === "start"
                ? "Start a trip? Your expenses while away are grouped under it. Your budget stays the same."
                : `End your trip “${state.trip.name}” today?`}
            </p>
          </div>
          <IconButton icon="close" label="Dismiss" onClick={dismiss} />
        </div>
        {error ? (
          <p role="alert" className="text-caption text-danger-fg">
            {error}
          </p>
        ) : null}
        <div className="flex gap-3">
          <Button variant="ghost" onClick={dismiss}>
            Not now
          </Button>
          {state.kind === "start" ? (
            <Link href={newTripHref} onClick={dismiss} className={`${buttonClasses("primary")} flex-1`}>
              Start a trip
            </Link>
          ) : (
            <Button variant="primary" className="flex-1" onClick={() => end(state.trip.id)} disabled={ending}>
              {ending ? "Ending…" : "End trip"}
            </Button>
          )}
        </div>
      </Card>
      </div>
    </section>
  );
}

"use client";

import { useRef, useState, useTransition } from "react";
import type { SaveResult } from "./settingsActions";

/**
 * A setting that saves as soon as it changes. The new value shows at once.
 * Only the latest change decides what is shown: if it fails, the value goes
 * back to the last one the server confirmed (not simply the one before the
 * change, which may never have saved) and `error` says why. `status` is what
 * a polite live region announces ("Saving…", then "Saved.").
 */
export function useAutoSave<T>(saved: T, save: (value: T) => Promise<SaveResult>) {
  const [value, setValue] = useState(saved);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();
  const confirmed = useRef(saved);
  const latest = useRef(0);

  function change(next: T) {
    const request = ++latest.current;
    setValue(next);
    setError(null);
    setDone(false);
    startTransition(async () => {
      const result = await save(next);
      const ok = !("error" in result);
      if (ok) confirmed.current = next;
      if (request !== latest.current) return;
      if (ok) {
        setDone(true);
      } else {
        setValue(confirmed.current);
        setError(result.error);
      }
    });
  }

  return { value, change, error, status: pending ? "Saving…" : done ? "Saved." : "" };
}

"use client";

import { useState, useTransition } from "react";
import type { SaveResult } from "./settingsActions";

/**
 * A setting that saves as soon as it changes. The new value shows at once; if
 * the save fails it goes back to the saved one and `error` says why. `status`
 * is what a polite live region announces ("Saving…", then "Saved.").
 */
export function useAutoSave<T>(saved: T, save: (value: T) => Promise<SaveResult>) {
  const [value, setValue] = useState(saved);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  function change(next: T) {
    const previous = value;
    setValue(next);
    setError(null);
    setDone(false);
    startTransition(async () => {
      const result = await save(next);
      if ("error" in result) {
        setValue(previous);
        setError(result.error);
      } else {
        setDone(true);
      }
    });
  }

  return { value, change, error, status: pending ? "Saving…" : done ? "Saved." : "" };
}

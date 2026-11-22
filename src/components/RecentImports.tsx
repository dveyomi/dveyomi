"use client";

import { useI18n } from "@/i18n/client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { undoImportAction } from "@/app/(app)/settings/import/actions";
import { Button, ConfirmDialog } from "@/components/ui";
import { type IsoDate } from "@/lib/calc";

/** A past import as the list shows it: `importedOn` is the day it was imported, in the user's zone. */
export type RecentImport = { id: string; filename: string; importedOn: IsoDate; rowCount: number };


/**
 * The latest imports, each with "Undo import": after a confirmation it
 * removes that import's expenses (including any edited since) and the import.
 */
export function RecentImports({ imports }: { imports: RecentImport[] }) {
  const { m, fmt } = useI18n();
  const w = m.importer;
  const router = useRouter();
  const [confirming, setConfirming] = useState<RecentImport | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function undo() {
    if (!confirming) return;
    const batch = confirming;
    setConfirming(null);
    setError(null);
    setBusy(true);
    try {
      const result = await undoImportAction(batch.id);
      if ("error" in result) setError(result.error);
      else router.refresh();
    } catch {
      setError(w.undoFailed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {imports.length === 0 ? (
        <p className="text-body text-muted">{w.noImports}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {imports.map((b) => (
            <li key={b.id} className="flex min-h-11 items-center justify-between gap-3 py-2">
              <div className="flex min-w-0 flex-col">
                <span translate="no" className="truncate text-body text-text">
                  {b.filename}
                </span>
                <span className="text-caption text-muted">
                  {w.importLine(fmt.dayMonthYear(b.importedOn), w.count(b.rowCount, "expense"))}
                </span>
              </div>
              <Button
                variant="ghost"
                aria-label={w.undoOf(b.filename)}
                disabled={busy}
                onClick={() => setConfirming(b)}
              >
                {w.undo}
              </Button>
            </li>
          ))}
        </ul>
      )}
      {error ? (
        <p role="alert" className="text-caption text-danger-fg">
          {error}
        </p>
      ) : null}
      <ConfirmDialog
        open={confirming !== null}
        title={w.undoTitle}
        body={
          confirming
            ? w.undoBody(w.count(confirming.rowCount, "expense"), confirming.filename)
            : ""
        }
        confirmLabel={w.undoImport}
        tone="danger"
        onConfirm={undo}
        onCancel={() => setConfirming(null)}
      />
    </div>
  );
}

"use client";

import { useI18n } from "@/i18n/client";
import { BottomSheet, Button } from "@/components/ui";
import type { AmountScope } from "@/lib/validation/expense";

export type { AmountScope } from "@/lib/validation/expense";

type EditRecurringPromptProps = {
  open: boolean;
  /** The payment's name, e.g. Spotify. */
  name: string;
  onChoose: (scope: AmountScope) => void;
  onCancel: () => void;
};

/**
 * Asked when the amount of a recurring payment is edited (§5.8): change just
 * this payment, or this one and the ones after it (the new price from this
 * date). Earlier payments keep their amounts either way.
 */
export function EditRecurringPrompt({ open, name, onChoose, onCancel }: EditRecurringPromptProps) {
  const { m } = useI18n();
  return (
    <BottomSheet open={open} onClose={onCancel} title={m.repeat.changeTitle(name)} role="alertdialog">
      <div className="flex flex-col gap-5">
        <p className="text-body text-muted">
          {m.repeat.changeBody}
        </p>
        <div className="flex flex-col gap-3">
          <Button variant="secondary" fullWidth onClick={() => onChoose("this")}>
            {m.repeat.justThis}
          </Button>
          <Button variant="primary" fullWidth onClick={() => onChoose("this_and_future")}>
            {m.repeat.thisAndFuture}
          </Button>
        </div>
      </div>
    </BottomSheet>
  );
}

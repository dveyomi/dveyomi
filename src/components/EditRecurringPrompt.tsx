"use client";

import { BottomSheet, Button } from "@/components/ui";

export type AmountScope = "this" | "this_and_future";

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
  return (
    <BottomSheet open={open} onClose={onCancel} title={`Change the amount for ${name}?`} role="alertdialog">
      <div className="flex flex-col gap-5">
        <p className="text-body text-muted">
          It&rsquo;s a recurring payment. Payments before this one keep their amounts either way.
        </p>
        <div className="flex flex-col gap-3">
          <Button variant="secondary" fullWidth onClick={() => onChoose("this")}>
            Just this payment
          </Button>
          <Button variant="primary" fullWidth onClick={() => onChoose("this_and_future")}>
            This and future payments
          </Button>
        </div>
      </div>
    </BottomSheet>
  );
}
